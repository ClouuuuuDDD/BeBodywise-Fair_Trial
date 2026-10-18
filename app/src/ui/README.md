# UI kit (Shelf Cast)

Import from `../../ui` (barrel `index.ts`). Tokens: `app/src/styles/tokens.css`. Review every state at `/kit` (dev server only; `?view=03|05b|11|13|17|18|verdicts` show canvas artboards rebuilt from the kit). Components use CSS modules; no animation library, only CSS transitions, all with a `prefers-reduced-motion` fallback (150 ms fade).

| Component | Key props |
|---|---|
| `AppShell` | `screen` (data-screen), `header` (AppHeader props), `ground` "dots"/"plain", `overlayHeader` (verdict stages), `banner`. Body has 20 px gutters; end with `BottomBar`. |
| `AppHeader` | `back` (true / path / fn), `title` (running head), `step {current,total}`, `planCode`, `privacyLabel`, `brand`, `concept` ("Concept for Be Bodywise"), `right` |
| `StepProgress` | `current`, `total`, `showText` |
| `OptionRow` / `OptionGroup` | `value`, `label`, `selected`, `onSelect(value)` (fires after the 250 ms bounce = advance on tap), `variant` row/segment, `right`, `meter` 0-3. Test id `option-<value>`. |
| `CheckChip` | `label`, `checked`, `onChange`, `variant` pill/card, `mascot`, `value`, `compact` |
| `ResultCard` / `CornerRibbon` | `tone` white/mint/peach/rose/lilac/butter, `highlight`, `ribbon`, `size` lg/sm, `padding` |
| `PrimaryButton` | `to` / `href` / `onClick`, `variant` primary/secondary/help, `size` lg 60 / md 58 / sm 50, `icon`, `loading`, `disabled`. Test ids `primary`, `secondary`. |
| `TextLink` | `to` / `href` / `onClick`, `layout` block/inline, `tone` muted |
| `BottomBar` / `FeelsOffPill` | `children`, `feelsOff` (true, path or fn), `sticky`. Test id `feels-off`. |
| `TimelineBar` | `day`, `total`=56, `paused[]`, `reaction[]`, `legend` |
| `TrialCard` | `day`, `judgeBy`, `paused`, `reaction`, `mascot`, `plate`, `suffix` |
| `TrafficLight` | `level` green/amber/red, `title`, children, `art` |
| `VerdictBadge` / `VerdictReason` | `outcome` working/not-yet/cant-call/not-for-you/see-doctor, `headline`, `sub`, children; reason `mark` tick/dash |
| `Sheet` | `open`, `onClose`, `title`, `footer` (portal, focus trap, Esc, scroll lock) |
| `Mascot` | `id` (art manifest), `size` (css width), `muted`, `retired`, `bounce`, `alt`; `mascotForProductType(type)` |
| `DrMehr` | `pose` (wave, curious, clipboard, point, camera, calendar, concerned, proud, open-palms, avatar), `size`, `say` (string or array of lines = doctor bubble), `style` |
| `ExampleBanner` | `jumps[{key,label,hint}]`, `onJump`, `onJumpClick`, `leaveTo`. Test id `example-tag`. |
| `PlaceholderRulesNote` | none; prints `PLACEHOLDER_RULES_LABEL`. Test id `placeholder-rules`. |
| also | `PlanCodeTag`, `PrivacyChip`, `Icon`, `Sparkle`, `useReducedMotion` |

```tsx
<AppShell screen="03" header={{ back: '/check/1', title: 'Right Start · 2 of 5', step: { current: 2, total: 5 } }}>
  <h1>...</h1>
  <OptionGroup label="How do you remove hair?">
    <OptionRow value="razor" label="Razor" selected={a === 'razor'} onSelect={save} right={<Mascot id="razor" size={44} alt="" />} />
  </OptionGroup>
  <DrMehr pose="avatar" say="Shaving can darken underarm skin." />
</AppShell>
```

Art: `app/public/art/` (WebP q82, @1x/@2x, `thumb/` for mascots), sizes in `art.ts`. Notes: radio ring uses `--grey-cast` (3:1) rather than the canvas's lighter grey; buttons are 60/58/50 px (canvas varies 56-60).
