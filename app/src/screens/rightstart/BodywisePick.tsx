import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { BodywiseProductId } from '../../contracts';
import { costIsEstimate, pregnancyQuestionNeeded, productPrice } from '../../engine';
import { BOTTLE_DAYS, DEFAULT_ANCHOR_PRODUCT, TRIAL_USE_DAYS } from '../../engine/config';
import { useTour } from '../../state/tour';
import { track } from '../../state';
import { answerPregnancy, firstTime, pickFor, savePlan, useRightStart } from '../../state/rightStart';
import { AppShell, BottomBar, CornerRibbon, DrMehr, Icon, PlaceholderRulesNote, PrimaryButton, ResultCard, Sheet, TextLink } from '../../ui';
import { FitGuard } from './components/FitGuard';
import { ProductArt } from './components/ProductArt';
import { RANGE_NAMES } from './components/rangeNames';
import { amazonUrl, bodywiseUrl, DOCTOR_URL, rupees } from './components/links';
import { match as t } from './copy';
import styles from './BodywisePick.module.css';

/** Screen 05b: Your Be Bodywise match. One recommended product, an honest line for every other, the cost to know. Never a gate. */
export default function BodywisePick() {
  return (
    <FitGuard>
      <Match />
    </FitGuard>
  );
}

function Match() {
  const s = useRightStart();
  const navigate = useNavigate();
  const demo = useTour().on;
  const { pick, fitResult, input } = pickFor(s);
  const [pregnancyDismissed, setPregnancyDismissed] = useState(false);
  const [hormoneOpen, setHormoneOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  const askPregnancy = pregnancyQuestionNeeded(input) && !pregnancyDismissed;

  const target: BodywiseProductId = pick.pick ?? DEFAULT_ANCHOR_PRODUCT;
  const signature = `${pick.pick}|${pick.ruleRow}|${pick.variant ?? ''}`;

  useEffect(() => {
    if (!firstTime(`pick:${signature}`)) return;
    track('pick_shown', '05b', {
      product_id: pick.pick,
      variant: pick.variant ?? null,
      rule_row: pick.ruleRow,
      base_row: pick.baseRow,
      hormone_note: pick.hormoneNote,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  function answer(value: 'yes' | 'no' | 'prefer-not') {
    answerPregnancy(value);
    track('conditional_answered', '05b', { question: 'pregnancy', answer: value });
  }

  function openHormone() {
    const next = !hormoneOpen;
    setHormoneOpen(next);
    if (next) track('hormone_note_expanded', '05b', {});
  }

  async function save() {
    await savePlan();
    void navigate('/start');
  }

  const doctorLink = (from: 'hormone-note' | 'stop-ask') => (
    <TextLink href={DOCTOR_URL} external onClick={() => track('doctor_link_clicked', '05b', { from })} data-testid="doctor-link">
      {t.doctor}
    </TextLink>
  );

  const price = productPrice(target);
  const kit = pick.pick !== null && costIsEstimate(pick.pick);
  const bottles = Math.ceil(TRIAL_USE_DAYS / BOTTLE_DAYS);
  const weeks = TRIAL_USE_DAYS / 7;
  const cost = bottles * price;

  const headline = pick.headline;
  const noPick = pick.pick === null;
  const meta = [pick.variant === 'no-fragrance' ? 'No Fragrance' : null, kit ? 'Kit' : pick.pick === 'bw-repair-cream' ? null : '50 ml', `Rs\u00A0${rupees(price)}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <AppShell screen="05b" header={{ back: '/check/shelf/answer', title: t.runningHead }}>
      <h1 className={styles.title}>{headline}</h1>

      {pick.doctorFirst ? <div className={styles.doctorFirst}>{doctorLink('stop-ask')}</div> : null}

      {noPick ? (
        <p className={styles.noPick} data-testid="no-pick-line">
          {pick.why[0]}
        </p>
      ) : (
        <ResultCard
          highlight
          padding="none"
          ribbon={<CornerRibbon kind="label">Best<br />for you</CornerRibbon>}
          className={styles.best}
          data-testid="best-card"
        >
          <div className={styles.bestHead}>
            <ProductArt id={pick.pick as BodywiseProductId} size={72} />
            <div className={styles.bestText}>
              <p className={styles.bestName} data-testid="best-name">
                {RANGE_NAMES[pick.pick as BodywiseProductId]}
              </p>
              <p className={styles.bestMeta} data-testid="best-meta">
                {meta}
              </p>
            </div>
          </div>
          <ul className={styles.why}>
            {pick.why.map((line) => (
              <li key={line}>
                <Icon name="check" size={16} />
                <span>{line}</span>
              </li>
            ))}
          </ul>
          {pick.alsoOffer ? (
            <p className={styles.addOn} data-testid="add-on">
              {`Add at night: ${RANGE_NAMES[pick.alsoOffer]} · Rs ${rupees(productPrice(pick.alsoOffer))}`}
            </p>
          ) : null}
        </ResultCard>
      )}

      {!noPick ? (
        <>
          <div className={styles.strip} data-testid="cost-strip">
            <span>
              <b>{weeks}</b> weeks to judge
            </span>
            <span>{kit ? <><b>{bottles}</b> kits</> : <><b>{bottles}</b> bottles</>}</span>
            <span>
              {kit ? 'About ' : null}
              <b>{`Rs ${rupees(cost)}`}</b> to know
            </span>
          </div>
          <p className={styles.costNote}>{kit ? t.costKitNote(rupees(price)) : `${t.listPrice(rupees(price))} ${t.costNote}`}</p>
        </>
      ) : null}

      <div className={styles.skin} data-testid="your-skin">
        <p className={styles.skinLine}>{fitResult.outcome === 'good-with-habit' ? t.yourSkinHabit : t.yourSkinGood}</p>
        {fitResult.habit ? <p className={styles.habit}>{fitResult.habit}</p> : null}
        {fitResult.hormoneNote ? (
          <div className={styles.hormone}>
            <button type="button" className={styles.hormoneButton} aria-expanded={hormoneOpen} onClick={openHormone} data-testid="hormone-note">
              <DrMehr pose="avatar" size={36} alt="" />
              <span>{t.hormoneCollapsed}</span>
              <Icon name="chevron" size={18} className={hormoneOpen ? styles.open : undefined} />
            </button>
            {hormoneOpen ? (
              <div className={styles.hormoneBody} data-testid="hormone-body">
                <p>{t.hormoneBody}</p>
                {doctorLink('hormone-note')}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* With a pick, the rest of the range folds behind one tap so the screen fits a phone; with no pick it is the answer. */}
      {noPick ? (
        <h2 className={styles.others}>{t.othersTitle}</h2>
      ) : (
        <h2 className={styles.others}>
          <button type="button" className={styles.othersToggle} aria-expanded={rangeOpen} onClick={() => setRangeOpen((o) => !o)} data-testid="range-toggle">
            <span>{`${t.othersTitle} (${pick.whyNot.length})`}</span>
            <Icon name="chevron" size={18} className={rangeOpen ? styles.open : undefined} />
          </button>
        </h2>
      )}
      <ul className={styles.range} hidden={!noPick && !rangeOpen}>
        {pick.whyNot.map((w) => (
          <li key={w.productId} className={styles.rangeRow} data-testid="range-row">
            <ProductArt id={w.productId} size={46} />
            <div>
              <p className={styles.rangeName}>{RANGE_NAMES[w.productId]}</p>
              <p className={styles.rangeLine}>{w.line}</p>
            </div>
            <span className={styles.rangePrice}>{`Rs ${rupees(w.priceInr)}`}</span>
          </li>
        ))}
      </ul>

      <div className={styles.note}>
        <PlaceholderRulesNote />
      </div>

      <BottomBar sticky>
        {demo ? (
          <p className={styles.demoNote} data-testid="demo-buy-note">
            Demo: buying is acted out here, then the trial begins.
          </p>
        ) : null}
        <PrimaryButton
          size="md"
          {...(demo ? {} : { href: bodywiseUrl(target), external: true })}
          onClick={() => {
            track('buy_clicked', '05b', { store: 'bodywise', product_id: target });
            if (demo) void save();
          }}
        >
          {t.buy}
        </PrimaryButton>
        <div className={styles.two}>
          <PrimaryButton
            size="sm"
            variant="secondary"
            {...(demo ? {} : { href: amazonUrl(target), external: true })}
            data-testid="amazon"
            onClick={() => {
              track('buy_clicked', '05b', { store: 'amazon', product_id: target });
              if (demo) void save();
            }}
          >
            {t.amazon}
          </PrimaryButton>
          <PrimaryButton size="sm" variant="secondary" onClick={() => void save()} data-testid="save-plan">
            {t.save}
          </PrimaryButton>
        </div>
      </BottomBar>

      <Sheet open={askPregnancy} onClose={() => setPregnancyDismissed(true)} title={t.pregnancyQ}>
        <p className={styles.why2}>{t.pregnancyWhy}</p>
        <div className={styles.preg}>
          <PrimaryButton size="sm" variant="secondary" onClick={() => answer('yes')} data-testid="pregnancy-yes">
            {t.pregnancyYes}
          </PrimaryButton>
          <PrimaryButton size="sm" variant="secondary" onClick={() => answer('no')} data-testid="pregnancy-no">
            {t.pregnancyNo}
          </PrimaryButton>
          <PrimaryButton size="sm" variant="secondary" onClick={() => answer('prefer-not')} data-testid="pregnancy-prefer-not">
            {t.pregnancyPreferNot}
          </PrimaryButton>
        </div>
      </Sheet>
    </AppShell>
  );
}
