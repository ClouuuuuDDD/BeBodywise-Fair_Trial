import { useState, type CSSProperties, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AppHeader,
  AppShell,
  BottomBar,
  CheckChip,
  CornerRibbon,
  DR_MEHR_POSES,
  DrMehr,
  ExampleBanner,
  FeelsOffPill,
  MASCOTS,
  Mascot,
  OptionGroup,
  OptionRow,
  PlaceholderRulesNote,
  PlanCodeTag,
  PrimaryButton,
  PrivacyChip,
  ResultCard,
  Sheet,
  Sparkle,
  StepProgress,
  TextLink,
  TimelineBar,
  TrafficLight,
  TrialCard,
  VerdictBadge,
  VerdictReason,
  type DrMehrPose,
  type MascotId,
  type VerdictOutcome,
} from './index';
import { Comp03, Comp05b, Comp11, Comp13, Comp17, Comp18 } from './KitCompositions';

/**
 * /kit: every UI-kit component in its states, for design review. Dev server only, not linked.
 * ?view=03 | 05b | 11 | 13 | 17 | 18 shows a canvas artboard rebuilt from kit components;
 * ?view=verdicts shows all five verdict outcomes one after another.
 */

const section: CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: '24px 0', borderTop: '2px dashed var(--lilac-line)' };
const h2: CSSProperties = { margin: 0, fontSize: 20 };
const cap: CSSProperties = { margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--ink-muted)' };

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section style={section} data-kit={title}>
      <h2 style={h2}>{title}</h2>
      {note ? <p style={cap}>{note}</p> : null}
      {children}
    </section>
  );
}

const COMPS: Record<string, () => ReactNode> = {
  '03': Comp03,
  '05b': Comp05b,
  '11': Comp11,
  '13': Comp13,
  '17': Comp17,
  '18': Comp18,
};

export default function Kit() {
  const [params] = useSearchParams();
  const view = params.get('view') ?? '';
  const Comp = COMPS[view];
  if (Comp) return <Comp />;
  if (view === 'verdicts') return <VerdictsView />;
  return <Overview />;
}

const OUTCOMES: VerdictOutcome[] = ['working', 'not-yet', 'cant-call', 'not-for-you', 'see-doctor'];

function VerdictsView() {
  return (
    <div>
      {OUTCOMES.map((o) => (
        <div key={o} style={{ minHeight: 640 }}>
          <AppShell screen={`verdict-${o}`} ground="plain" overlayHeader header={{ title: `Your verdict · ${o}`, planCode: 'FT-4K7Q' }}>
            <VerdictBadge outcome={o} sub="One plain line goes here.">
              <VerdictReason mark={o === 'working' ? 'tick' : 'dash'}>A reason, in plain words.</VerdictReason>
            </VerdictBadge>
          </AppShell>
        </div>
      ))}
    </div>
  );
}

function Overview() {
  const [opt, setOpt] = useState('');
  const [checks, setChecks] = useState<Record<string, boolean>>({ a: true });
  const [sheet, setSheet] = useState(false);
  const [bounce, setBounce] = useState(false);
  const [retired, setRetired] = useState(false);
  const [pose, setPose] = useState<DrMehrPose>('wave');
  const tog = (k: string) => setChecks((c) => ({ ...c, [k]: !c[k] }));

  return (
    <AppShell screen="kit" header={{ title: 'UI kit · dev only', concept: true }}>
      <h1 style={{ ...h2, fontSize: 28, paddingTop: 12 }}>Fair Trial kit</h1>
      <p style={cap}>Every component, every state. Reduced motion: toggle it in your OS or DevTools rendering panel.</p>

      <Block title="AppHeader" note="Variants: back + step dots, back + plan code, brand + concept, privacy chip, no back + plan code.">
        <div style={{ margin: '0 -20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <AppHeader back="/kit" title="Right Start · 2 of 5" step={{ current: 2, total: 5 }} />
          <AppHeader back="/kit" title="Day 0 · Photo 1 of 2" planCode="FT-4K7Q" privacyLabel="Photos never leave this phone" />
          <AppHeader brand="Fair Trial" concept />
          <AppHeader title="Fair Trial · Day 23 of 56" planCode="FT-4K7Q" />
        </div>
      </Block>

      <Block title="StepProgress + PlanCodeTag + PrivacyChip">
        <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <StepProgress current={1} total={5} />
          <StepProgress current={4} total={5} showText />
          <PlanCodeTag code="FT-4K7Q" />
          <PrivacyChip>Photos never leave this phone</PrivacyChip>
        </div>
      </Block>

      <Block title="OptionRow" note="Advances on tap: onSelect fires after the 250 ms bounce. Row, row + art, row + meter, segment.">
        <OptionGroup label="Demo options">
          <OptionRow value="same" label="About the same" selected={opt === 'same'} onSelect={setOpt} meter={0} />
          <OptionRow value="clear" label="Clearly darker" selected={opt === 'clear'} onSelect={setOpt} meter={2} />
          <OptionRow value="razor" label="Razor" selected={opt === 'razor'} onSelect={setOpt} right={<Mascot id="razor" size={44} alt="" />} />
          <OptionRow value="off" label="Selected (stored answer)" selected onSelect={() => undefined} />
          <OptionRow value="dis" label="Disabled" onSelect={() => undefined} disabled />
        </OptionGroup>
        <OptionGroup label="How bad" columns={3}>
          <OptionRow variant="segment" value="mild" label="Mild" selected={opt === 'mild'} onSelect={setOpt} />
          <OptionRow variant="segment" value="bother" label="Bothering me" selected={opt === 'bother'} onSelect={setOpt} />
          <OptionRow variant="segment" value="pain" label="Painful" selected onSelect={() => undefined} />
        </OptionGroup>
        <p style={cap}>Last tapped: {opt || 'nothing yet'}</p>
      </Block>

      <Block title="CheckChip" note="Pill (symptoms) and card (shelf chip with mascot: grayscale off, hops and colours on).">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <CheckChip value="a" label="Stinging" checked={!!checks.a} onChange={() => tog('a')} />
          <CheckChip value="b" label="Redness" checked={!!checks.b} onChange={() => tog('b')} />
          <CheckChip value="c" label="Darker than before" checked={!!checks.c} onChange={() => tog('c')} />
          <CheckChip value="d" label="Yes, yesterday" compact checked={!!checks.d} onChange={() => tog('d')} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CheckChip variant="card" mascot="toner" label="Glycolic toner" checked={!!checks.t} onChange={() => tog('t')} />
          <CheckChip variant="card" mascot="deodorant" label="Deodorant" checked={!!checks.u} onChange={() => tog('u')} />
        </div>
      </Block>

      <Block title="ResultCard + CornerRibbon" note="Tones: white, mint, peach, rose, lilac, butter. Highlight = blue keyline. Ribbon: number or label.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 6 }}>
          <ResultCard ribbon={<CornerRibbon>1</CornerRibbon>}>
            <p style={{ margin: '0 0 0 44px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--ink-display)' }}>Numbered ribbon</p>
          </ResultCard>
          <ResultCard highlight ribbon={<CornerRibbon kind="label">Best<br />for you</CornerRibbon>}>
            <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: 'var(--ink-display)' }}>Highlighted, label ribbon</p>
          </ResultCard>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {(['mint', 'peach', 'rose', 'lilac', 'butter', 'white'] as const).map((t) => (
              <ResultCard key={t} tone={t} size="sm" padding="sm">
                <span style={{ fontWeight: 800, color: 'var(--ink-display)' }}>{t}</span>
              </ResultCard>
            ))}
          </div>
        </div>
      </Block>

      <Block title="PrimaryButton / TextLink" note="Primary 60, md 58, sm 50, secondary, help, icon, loading, disabled.">
        <PrimaryButton>Primary, 60 px</PrimaryButton>
        <PrimaryButton size="md">Medium, 58 px</PrimaryButton>
        <PrimaryButton variant="secondary" size="sm">Secondary, 50 px</PrimaryButton>
        <PrimaryButton variant="secondary" size="sm" icon={<Sparkle size={16} />}>With icon</PrimaryButton>
        <PrimaryButton loading>Loading</PrimaryButton>
        <PrimaryButton disabled>Disabled</PrimaryButton>
        <TextLink to="/kit">Block text link</TextLink>
        <TextLink onClick={() => undefined} tone="muted">Muted text link</TextLink>
        <p style={{ margin: 0 }}>
          An <TextLink to="/kit" layout="inline">inline link</TextLink> inside a sentence.
        </p>
      </Block>

      <Block title="BottomBar + FeelsOffPill" note="Thumb-zone block; on trial screens it carries Something feels off.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <FeelsOffPill to="/kit" />
        </div>
      </Block>

      <Block title="TimelineBar / TrialCard" note="Day 23 with a reaction on day 9 and a pause on 10 to 12. The card is the home hero.">
        <TimelineBar day={23} paused={[10, 11, 12]} reaction={[9]} legend />
        <TimelineBar day={56} />
        <TimelineBar day={0} />
        <TrialCard day={23} judgeBy="Judge on 12 Dec" paused={[10, 11, 12]} reaction={[9]} />
        <TrialCard day={40} mascot="rollon-sleepy" plate="Running low" judgeBy="Judge on 15 Dec" suffix=" / 56 days" />
      </Block>

      <Block title="TrafficLight" note="Reaction answer. Calm: no sparkles.">
        <TrafficLight level="green" title="Keep going.">
          <p>Mild stinging is common in the first two weeks.</p>
        </TrafficLight>
        <TrafficLight level="amber" title="Pause for 3 days." art={<DrMehr pose="concerned" size={108} alt="Dr. Mehr, calm and caring" />}>
          <p>Then use it every other night for a week before going back to every night.</p>
        </TrafficLight>
        <TrafficLight level="red" title="Stop. See a doctor.">
          <p>Blisters or spreading redness need a doctor's eye.</p>
        </TrafficLight>
        <PlaceholderRulesNote />
      </Block>

      <Block title="VerdictBadge" note="Five outcomes. Full-screen views: /kit?view=verdicts and ?view=17, ?view=18.">
        <div style={{ margin: '0 -20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {OUTCOMES.map((o) => (
            <div key={o} style={{ position: 'relative', background: 'var(--ground)', paddingBottom: 12, overflow: 'hidden' }}>
              <VerdictBadge outcome={o} sub="One plain line." />
            </div>
          ))}
        </div>
      </Block>

      <Block title="Mascot" note="Every product character. Tap one to bounce; toggle retired / muted.">
        <div style={{ display: 'flex', gap: 8 }}>
          <PrimaryButton size="sm" variant="secondary" onClick={() => setBounce((b) => !b)}>Bounce</PrimaryButton>
          <PrimaryButton size="sm" variant="secondary" onClick={() => setRetired((r) => !r)}>Retire</PrimaryButton>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          {(Object.keys(MASCOTS) as MascotId[]).map((id) => (
            <figure key={id} style={{ margin: 0, textAlign: 'center' }}>
              <Mascot id={id} size={72} bounce={bounce} retired={retired} />
              <figcaption style={{ ...cap, maxWidth: 80 }}>{id}</figcaption>
            </figure>
          ))}
          <figure style={{ margin: 0, textAlign: 'center' }}>
            <Mascot id="rollon" size={40} muted />
            <figcaption style={cap}>muted</figcaption>
          </figure>
        </div>
      </Block>

      <Block title="DrMehr" note="Ten poses; the avatar with a bubble (lines reveal one by one).">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {(Object.keys(DR_MEHR_POSES) as DrMehrPose[]).map((p) => (
            <CheckChip key={p} label={p} compact checked={pose === p} onChange={() => setPose(p)} />
          ))}
        </div>
        <DrMehr pose={pose} size={pose === 'avatar' ? 64 : 140} />
        <DrMehr pose="avatar" say="Shaving can darken underarm skin on its own, so this changes how you start." />
        <DrMehr pose="avatar" say={['Too early to judge.', 'Most change shows after week 6.']} />
      </Block>

      <Block title="ExampleBanner" note="Butter strip: Example tag, Jump to day (opens a sheet), Leave the example.">
        <div style={{ margin: '0 -20px' }}>
          <ExampleBanner
            jumps={[
              { key: 'day-0', label: 'Day 0', hint: 'Routine and first photo' },
              { key: 'day-23', label: 'Day 23', hint: 'The quiet middle' },
              { key: 'day-56-working', label: 'Day 56', hint: 'Verdict: working' },
            ]}
            onJump={() => undefined}
            leaveTo="/kit"
          />
        </div>
      </Block>

      <Block title="Sheet" note="Focus trap, Escape, backdrop tap, scroll lock, focus returns to the button.">
        <PrimaryButton size="sm" variant="secondary" onClick={() => setSheet(true)}>Open sheet</PrimaryButton>
        <Sheet
          open={sheet}
          onClose={() => setSheet(false)}
          title="A sheet"
          footer={<PrimaryButton size="md" onClick={() => setSheet(false)}>Done</PrimaryButton>}
        >
          <p style={{ margin: 0 }}>Bottom sheets hold the pregnancy question, the stop reason, the calendar choice and the share preview.</p>
        </Sheet>
      </Block>

      <Block title="Compositions" note="Canvas artboards rebuilt from the kit, for pixel comparison at 390 x 844.">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {['03', '05b', '11', '13', '17', '18', 'verdicts'].map((v) => (
            <TextLink key={v} to={`/kit?view=${v}`} layout="inline">
              {v}
            </TextLink>
          ))}
        </div>
      </Block>

      <BottomBar>
        <PrimaryButton to="/kit">Bottom bar primary</PrimaryButton>
        <TextLink to="/kit">Text link</TextLink>
      </BottomBar>
    </AppShell>
  );
}
