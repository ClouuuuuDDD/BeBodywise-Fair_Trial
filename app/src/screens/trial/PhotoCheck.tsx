import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import type { PhotoCapture, PhotoFailure, PhotoRegion } from '../../contracts';
import { FIX_LINE } from '../../photo';
import { noiseBandFromBursts } from '../../photo/measure';
import { loadMeasure, photoUrl, removePhoto } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, DrMehr, Icon, PrimaryButton, TextLink } from '../../ui';
import { latest } from './components/capture';
import { ExamplePhoto } from './components/ExamplePhoto';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

type Tick = { label: string; failures: PhotoFailure[] };

function PhotoCard({ photo, plate, tone, example, region }: { photo: PhotoCapture | undefined; plate: string; tone: 'blue' | 'violet'; example: boolean; region: PhotoRegion }) {
  const src = photoUrl(photo);
  return (
    <div className={styles.photoCard}>
      <div className={styles.photoFrame}>
        {src ? <img src={src} alt={`${plate} photo, on this phone`} /> : example ? <ExamplePhoto region={region} moment="day0" alt={`${plate} example photo`} /> : null}
      </div>
      <span className={`${styles.plate} ${tone === 'blue' ? styles.plateBlue : styles.plateViolet}`}>{plate}</span>
    </div>
  );
}

/** Screen 09: both photos usable? Ticks, the inner-arm explanation, retake. */
export default function PhotoCheck() {
  const s = useTrialScreen();
  const navigate = useNavigate();
  const under = latest(s.photos, 'day0', 'underarm');
  const inner = latest(s.photos, 'day0', 'inner-arm');
  const ready = s.isExample || (under && inner);

  const qual = (p: PhotoCapture | undefined) => (p ? loadMeasure(p.id)?.measurement.quality.failures ?? [] : []);
  const failures: PhotoFailure[] = [...qual(under), ...qual(inner)];
  const ticks: Tick[] = [
    { label: 'Even light, no flash', failures: failures.filter((f) => f === 'dark' || f === 'warm') },
    { label: 'In focus', failures: failures.filter((f) => f === 'blur') },
    { label: 'White card in both', failures: failures.filter((f) => f === 'card-missing') },
  ];
  const failingSite = qual(under).length > 0 ? 'underarm' : qual(inner).length > 0 ? 'inner-arm' : undefined;
  const failing = failingSite !== undefined && !s.isExample;

  useEffect(() => {
    if (!ready || failing || !s.plan) return;
    const u = under && loadMeasure(under.id);
    const i = inner && loadMeasure(inner.id);
    // Placeholder cut points until the kill test sets them (events.md: noise_band_bucket).
    const band = u && i ? noiseBandFromBursts([{ underarm: u.frameIta, innerArm: i.frameIta }]) : null;
    const bucket = !band || band.itaDeg <= 2.5 ? 'narrow' : band.itaDeg <= 5 ? 'medium' : 'wide';
    track('baseline_saved', '09', { noise_band_bucket: bucket });
  }, [ready, failing, under, inner, s.plan]);

  if (s.gate !== undefined) return s.gate;
  if (!s.plan) return null;
  if (!ready) return <Navigate to="/start/photo?site=underarm" replace />;

  async function retakeOne() {
    const photo = failingSite === 'underarm' ? under : inner;
    if (photo) await removePhoto(photo.id);
    void navigate(`/start/photo?site=${failingSite ?? 'underarm'}`);
  }

  return (
    <AppShell screen="09" banner={s.banner} header={{ back: '/start/photo?site=inner-arm', title: 'Day 0 · Both photos', planCode: s.plan.planCode }}>
      <h1 className={styles.h1}>{failing ? 'One photo needs a retake.' : 'Both photos look good.'}</h1>
      <div className={styles.photoPair}>
        <PhotoCard photo={under} plate="Underarm" tone="blue" example={s.isExample} region="underarm" />
        <PhotoCard photo={inner} plate="Inner arm" tone="violet" example={s.isExample} region="inner-arm" />
      </div>
      <ul className={styles.ticks}>
        {ticks.map((t) => {
          const bad = t.failures.length > 0 && !s.isExample;
          return (
            <li key={t.label} className={bad ? styles.tickBad : undefined}>
              <span className={styles.tickDot}>{bad ? <span aria-hidden="true">!</span> : <Icon name="check" size={16} strokeWidth={3} />}</span>
              <span>
                {t.label}
                {bad ? <em className={styles.fix}>{t.failures.map((f) => FIX_LINE[f]).join(' ')}</em> : null}
              </span>
            </li>
          );
        })}
      </ul>
      <DrMehr pose="avatar" say="Your inner arm is the comparison. In 8 weeks I check whether your underarm moved closer to it." />
      <BottomBar>
        {failing ? (
          <PrimaryButton onClick={() => void retakeOne()}>{`Retake ${failingSite === 'underarm' ? 'underarm' : 'inner arm'}`}</PrimaryButton>
        ) : (
          <PrimaryButton to="/start/date">Continue</PrimaryButton>
        )}
        <TextLink to="/start/photo?site=underarm" data-testid="secondary">
          Retake photos
        </TextLink>
      </BottomBar>
    </AppShell>
  );
}
