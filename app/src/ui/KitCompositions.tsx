import { useState } from 'react';
import {
  AppShell,
  BottomBar,
  CornerRibbon,
  DrMehr,
  Mascot,
  OptionGroup,
  OptionRow,
  PlaceholderRulesNote,
  PrimaryButton,
  ResultCard,
  TextLink,
  TimelineBar,
  TrafficLight,
  TrialCard,
  VerdictBadge,
  VerdictReason,
} from './index';

/*
 * Reference compositions of canvas artboards, built only from kit components. They exist so /kit can
 * be compared against engineering/handoff/screens/png/. Screen engineers: copy the structure, not the copy.
 */

const H1: React.CSSProperties = {
  margin: 0,
  fontFamily: 'var(--font-display)',
  fontWeight: 800,
  color: 'var(--ink-display)',
};

export function Comp03() {
  const [sel, setSel] = useState('razor');
  return (
    <AppShell screen="03" header={{ back: '/kit', title: 'Right Start · 2 of 5', step: { current: 2, total: 5 } }}>
      <DrMehr pose="curious" size={150} alt="Dr. Mehr, curious" style={{ position: 'absolute', right: -6, top: 64, zIndex: 1 }} />
      <h1 style={{ ...H1, padding: '30px 0 0', width: 225, position: 'relative', zIndex: 2, fontSize: 30, lineHeight: 1.08, letterSpacing: '-0.01em', textWrap: 'balance' }}>
        How do you usually remove underarm hair?
      </h1>
      <div style={{ paddingTop: 44, position: 'relative', zIndex: 3 }}>
        <OptionGroup label="How do you usually remove underarm hair?">
          <OptionRow value="razor" label="Razor" selected={sel === 'razor'} onSelect={setSel} right={<Mascot id="razor" size={44} alt="" />} />
          <OptionRow value="wax" label="Wax" selected={sel === 'wax'} onSelect={setSel} />
          <OptionRow value="cream" label="Hair removal cream" selected={sel === 'cream'} onSelect={setSel} />
          <OptionRow value="laser" label="Laser" selected={sel === 'laser'} onSelect={setSel} />
          <OptionRow value="none" label="I don't remove it" selected={sel === 'none'} onSelect={setSel} />
        </OptionGroup>
      </div>
      <div style={{ marginTop: 'auto', paddingBottom: 28 }}>
        <DrMehr pose="avatar" say="Shaving can darken underarm skin on its own, so this changes how you start." />
      </div>
    </AppShell>
  );
}

export function Comp11() {
  return (
    <AppShell screen="11" header={{ title: 'Fair Trial · Day 23 of 56', planCode: 'FT-4K7Q' }}>
      <div style={{ paddingTop: 16 }}>
        <TrialCard day={23} judgeBy="Judge on 12 Dec" paused={[10, 11, 12]} reaction={[9]} />
      </div>
      <div style={{ paddingTop: 16 }}>
        <DrMehr pose="avatar" say={<><b>Nothing to do today.</b> Too early to judge. Most change shows after week 6.</>} />
      </div>
      <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <ResultCard size="sm" padding="none" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, padding: '0 16px', fontWeight: 800, color: 'var(--ink-display)' }}>
          Used it last night
          <span style={{ width: 48, height: 28, borderRadius: 14, background: 'var(--primary)', position: 'relative' }}>
            <span style={{ position: 'absolute', right: 3, top: 3, width: 22, height: 22, borderRadius: '50%', background: '#fff' }} />
          </span>
        </ResultCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <PrimaryButton variant="secondary" size="sm" to="/kit">My skin file</PrimaryButton>
          <PrimaryButton variant="secondary" size="sm" to="/kit">My routine</PrimaryButton>
        </div>
      </div>
      <BottomBar feelsOff="/kit" />
    </AppShell>
  );
}

export function Comp13() {
  return (
    <AppShell screen="13" ground="plain" header={{ back: '/kit', title: 'What to do' }}>
      <div style={{ paddingTop: 16 }}>
        <TrafficLight level="amber" title="Pause for 3 days." art={<DrMehr pose="concerned" size={108} alt="Dr. Mehr, calm and caring" />}>
          <p>Then use it every other night for a week before going back to every night.</p>
        </TrafficLight>
      </div>
      <div style={{ paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PlaceholderRulesNote />
      </div>
      <BottomBar>
        <PrimaryButton to="/kit">Got it</PrimaryButton>
        <TextLink to="/kit">Open my skin file</TextLink>
      </BottomBar>
    </AppShell>
  );
}

export function Comp17() {
  return (
    <AppShell screen="17" ground="plain" overlayHeader header={{ title: 'Your verdict · 56 days', planCode: 'FT-4K7Q', titleColor: 'var(--teal-deep)' }}>
      <VerdictBadge outcome="working" sub="Keep going. Check again in 8 weeks.">
        <VerdictReason>Your underarm moved closer to your inner-arm shade, more than normal photo difference.</VerdictReason>
        <VerdictReason>Your blind pick agrees: you chose today's photo.</VerdictReason>
        <VerdictReason>Used on 51 of 56 days, enough to judge fairly.</VerdictReason>
      </VerdictBadge>
      <BottomBar>
        <PrimaryButton to="/kit">Continue</PrimaryButton>
        <TextLink to="/kit">Open my skin file</TextLink>
      </BottomBar>
    </AppShell>
  );
}

export function Comp18() {
  return (
    <AppShell screen="18" ground="plain" overlayHeader header={{ title: 'Your verdict · 54 days used', planCode: 'FT-4K7Q' }}>
      <VerdictBadge outcome="not-for-you" sub="You gave it a fair trial. You can stop here.">
        <VerdictReason mark="dash">Used on 54 of 56 days. A fair trial.</VerdictReason>
        <VerdictReason mark="dash">No change beyond normal photo difference.</VerdictReason>
        <VerdictReason mark="dash">Your blind pick agrees: they looked the same.</VerdictReason>
        <ResultCard size="sm" padding="sm" style={{ marginTop: 4 }}>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--ink-display)' }}>
            This is about the product and your skin, not you.
          </p>
          <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 600, color: 'var(--ink-soft)' }}>
            Underarm darkness has other causes, like friction, hormones or genetics. A doctor can look at yours.
          </p>
        </ResultCard>
      </VerdictBadge>
      <BottomBar>
        <PrimaryButton size="md" to="/kit">Continue</PrimaryButton>
        <PrimaryButton size="sm" variant="secondary" to="/kit">Talk to a Be Bodywise doctor</PrimaryButton>
      </BottomBar>
    </AppShell>
  );
}

export function Comp05b() {
  return (
    <AppShell screen="05b" header={{ back: '/kit', title: 'Right Start · Your match' }}>
      <h1 style={{ ...H1, padding: '8px 0 0', fontSize: 30, lineHeight: 1.04, letterSpacing: '-0.01em' }}>Start gentle. Step up later.</h1>
      <div style={{ marginTop: 10 }}>
        <ResultCard
          highlight
          padding="none"
          ribbon={<CornerRibbon kind="label">Best<br />for you</CornerRibbon>}
          style={{ padding: '16px 16px 14px', borderRadius: 26 }}
        >
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingRight: 58 }}>
            <Mascot id="rollon" size={72} alt="4% roll-on" />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, lineHeight: 1.05, color: 'var(--ink-display)' }}>4% AHA BHA Underarm Roll On</p>
              <p style={{ margin: '3px 0 0', fontSize: 13, fontWeight: 800, color: 'var(--violet)' }}>No Fragrance · 50 ml · Rs 329</p>
            </div>
          </div>
        </ResultCard>
      </div>
      <p style={{ margin: 0, padding: '12px 4px 6px', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--ink-display)' }}>
        Also in the range, and why not now
      </p>
      <ResultCard size="sm" padding="sm" style={{ display: 'grid', gridTemplateColumns: '52px minmax(0,1fr) auto', gap: 10, alignItems: 'center', borderRadius: 18 }}>
        <Mascot id="rollon-strong" size={46} alt="" style={{ margin: '0 auto' }} />
        <div>
          <p style={{ margin: 0, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, lineHeight: 1.1, color: 'var(--ink-display)' }}>6% AHA BHA Roll On</p>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, lineHeight: 1.25, color: 'var(--ink-muted)' }}>Step up at week 8 if your skin is calm but change is slow.</p>
        </div>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--ink-muted)' }}>Rs 399</span>
      </ResultCard>
      <BottomBar>
        <PrimaryButton size="md" href="#">Buy on Be Bodywise</PrimaryButton>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <PrimaryButton size="sm" variant="secondary" href="#">Buy on Amazon</PrimaryButton>
          <PrimaryButton size="sm" variant="secondary" href="#">Save my plan</PrimaryButton>
        </div>
      </BottomBar>
    </AppShell>
  );
}

/** Not a canvas screen: the use-day dots at the 390 px width, for the TimelineBar review. */
export function TimelineDemo() {
  return <TimelineBar day={23} paused={[10, 11, 12]} reaction={[9]} legend />;
}
