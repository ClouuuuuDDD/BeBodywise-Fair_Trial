import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { PhotoCapture, Plan } from '../../contracts';
import { productName } from '../../engine';
import { leaveExample } from '../../state/example';
import { deleteEverything, photoUrl } from '../../state/trial';
import { track } from '../../state/vault';
import { AppShell, BottomBar, Mascot, PrimaryButton, Sheet, TextLink, type MascotId } from '../../ui';
import { MASCOTS } from '../../ui';
import { latest } from './components/capture';
import { ExamplePhoto } from './components/ExamplePhoto';
import { DOCTOR_URL, DURATION_WORDS, HAIR_WORDS, longDate, shortDate, shortName } from './components/format';
import { useTrialScreen } from './components/useTrialScreen';
import styles from './components/trial.module.css';

const PDF_FOOTER = 'Fair Trial · Concept for Be Bodywise · Not a diagnosis. Placeholder rules, to be signed by a dermatologist.';

const OUTCOME_WORDS: Record<string, string> = {
  working: 'Working',
  'not-yet': 'Not yet',
  'cant-call': "Can't call it",
  'not-for-you': 'Not for you',
  'see-doctor': 'See a doctor',
};

const asMascot = (key: string | undefined): MascotId | undefined =>
  key && Object.prototype.hasOwnProperty.call(MASCOTS, key) ? (key as MascotId) : undefined;

function alsoUses(plan: Plan): string {
  const apart = new Map(plan.startPlan?.keepApart.map((k) => [k.ref, k]) ?? []);
  const parts = plan.shelf
    .filter((i) => i.catalogId === undefined || i.areas.includes('underarm'))
    .map((i) => {
      const noun = shortName(i, true);
      const k = apart.get(i.id);
      const label = noun.charAt(0).toUpperCase() + noun.slice(1);
      if (k && /face only/i.test(k.reason)) return `${label} (face only now)`;
      if (k) return `${label} (kept apart)`;
      return label;
    });
  return parts.length > 0 ? parts.join(' · ') : 'Nothing else on her shelf';
}

/** Screen 15: one printable page for her or a doctor. */
export default function SkinFile() {
  const s = useTrialScreen();
  const { state } = useLocation();
  const [withPhotos, setWithPhotos] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [making, setMaking] = useState(false);

  useEffect(() => {
    if (s.plan) track('skin_file_opened', '15', { from: (state as { from?: string } | null)?.from ?? 'link' });
    // once per visit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!s.plan]);

  if (s.gate !== undefined) return s.gate;
  const plan = s.plan;
  if (!plan) return null;

  const trial = s.trial;
  const product = productName(s.product);
  const reactions = plan.reactions.map((r) => {
    const symptoms = r.report.symptoms.map((x) => (x === 'bumps-rash' ? 'bumps or rash' : x)).join(', ');
    const sev = r.report.severity === 'bothering' ? 'bothering' : r.report.severity;
    const paused = r.result.pauseDays ? ` Paused ${r.result.pauseDays} days.` : r.result.light === 'red' ? ' Paused.' : '';
    return `Day ${r.report.useDay}: ${symptoms}, ${sev}.${paused}`;
  });

  const slots: (PhotoCapture | undefined)[] = [
    latest(s.photos, 'day0', 'underarm'),
    latest(s.photos, 'day0', 'inner-arm'),
    latest(s.photos, 'verdict', 'underarm'),
    latest(s.photos, 'verdict', 'inner-arm'),
  ];
  const seeded = plan.photoIds.length;
  const exampleFilled = s.isExample ? [seeded >= 1, seeded >= 2, seeded >= 4, seeded >= 4] : [];

  function makePdf() {
    setMaking(true);
    track('skin_file_exported', '15', { with_photos: withPhotos });
    // The PDF is the browser's own "Save as PDF" over a print stylesheet: made on this phone, no network.
    window.setTimeout(() => {
      window.print();
      setMaking(false);
    }, 150);
  }

  async function wipe() {
    if (s.isExample) leaveExample();
    else await deleteEverything();
    window.location.assign('/');
  }

  return (
    <AppShell screen="15" banner={s.banner} header={{ back: true, title: 'For you or your doctor' }}>
      <article className={`${styles.file} printRoot`} data-testid="skin-file">
        <header className={styles.fileHead}>
          <div>
            <h1 className={styles.fileTitle}>My skin file</h1>
            <p className={styles.fileCode}>Plan {plan.planCode}</p>
          </div>
          <div className={styles.cast} aria-hidden="true">
            <Mascot id="rollon" size={40} alt="" />
            {plan.shelf.slice(0, 2).map((i) => {
              const m = asMascot(i.mascot);
              return m ? <Mascot key={i.id} id={m} size={36} alt="" /> : null;
            })}
          </div>
        </header>
        <dl className={styles.dl}>
          <div><dt>Product</dt><dd>{product}</dd></div>
          <div>
            <dt>Started</dt>
            <dd>{plan.day0 && trial ? `${shortDate(plan.day0)} · ${trial.useDaysSoFar} days used` : 'Not started'}</dd>
          </div>
          <div>
            <dt>Concern</dt>
            <dd>
              Darker underarms
              {plan.fit.duration ? `, ${DURATION_WORDS[plan.fit.duration]}` : ''}
              {plan.fit.hairRemoval ? ` · ${HAIR_WORDS[plan.fit.hairRemoval]}` : ''}
            </dd>
          </div>
          <div><dt>Also uses</dt><dd>{alsoUses(plan)}</dd></div>
          <div>
            <dt>Reactions</dt>
            <dd>{reactions.length > 0 ? reactions.map((r) => <span key={r} className={styles.block}>{r}</span>) : 'None logged'}</dd>
          </div>
          <div><dt>Judge on</dt><dd>{trial ? longDate(trial.judgeByDate) : 'Not started'}</dd></div>
          {plan.verdict ? <div><dt>Verdict</dt><dd data-testid="file-verdict">{OUTCOME_WORDS[plan.verdict.outcome]}</dd></div> : null}
        </dl>

        <div className={withPhotos ? undefined : styles.photosHideInPrint}>
          <p className={styles.photosLabel}>Photos, on this phone only</p>
          <div className={styles.thumbs}>
            {slots.map((p, i) => {
              const src = photoUrl(p);
              const filled = !!src || exampleFilled[i];
              return (
                <div key={i} className={filled ? styles.thumb : `${styles.thumb} ${styles.thumbEmpty}`}>
                  {src ? <img src={src} alt={i < 2 ? 'Day 0 photo' : 'Verdict photo'} /> : exampleFilled[i] ? <ExamplePhoto compact region={i % 2 === 0 ? 'underarm' : 'inner-arm'} moment={i < 2 ? 'day0' : 'verdict'} lighter={plan.blindPick?.says === 'now-lighter'} alt={`${i < 2 ? 'Day 0' : 'Verdict day'} ${i % 2 === 0 ? 'underarm' : 'inner arm'} example photo`} /> : null}
                </div>
              );
            })}
          </div>
        </div>
        <p className={styles.pdfFooter}>{PDF_FOOTER}</p>
      </article>

      <label className={`${styles.check} noPrint`}>
        <input type="checkbox" data-testid="include-photos" checked={withPhotos} onChange={(e) => setWithPhotos(e.target.checked)} />
        <span>Include my photos in the PDF</span>
      </label>

      <BottomBar>
        <PrimaryButton loading={making} onClick={makePdf}>
          Share as PDF
        </PrimaryButton>
        <PrimaryButton variant="secondary" size="sm" href={DOCTOR_URL} external onClick={() => track('doctor_link_clicked', '15', { from: 'skin-file' })}>
          Talk to the Bodywise in-app doctor
        </PrimaryButton>
        <TextLink tone="muted" onClick={() => setDeleteOpen(true)} data-testid="delete-all">
          Delete everything from this phone
        </TextLink>
      </BottomBar>

      <Sheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete everything?"
        footer={
          <>
            <PrimaryButton size="md" data-testid="delete-confirm" onClick={() => void wipe()}>
              Delete everything
            </PrimaryButton>
            <TextLink onClick={() => setDeleteOpen(false)}>Keep it</TextLink>
          </>
        }
      >
        <p>This deletes your plan, shelf, photos and dates from this phone. It can&apos;t be undone.</p>
      </Sheet>
    </AppShell>
  );
}
