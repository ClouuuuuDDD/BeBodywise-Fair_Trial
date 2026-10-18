# Fair Trial: a concept for Be Bodywise

A phone web app that gives a Be Bodywise buyer a fair answer to "is this working for me?", starting with the underarm AHA BHA roll-on. Built for the Mosaic Wellness Fellowship Builder Challenge.

> **Concept only.** Not made by, or affiliated with, Mosaic Wellness or Be Bodywise. All rules are placeholders, to be set and signed by a dermatologist. The insights dashboard uses sample data.

## What it does

The app opens in a **guided demo**, so anyone can play the whole journey in a few minutes. Chapter cards explain each phase, and a day control skips through the 8 weeks.

| Phase | What happens |
|---|---|
| **1 · Before she buys** (Right Start) | Five quick fit questions. She photographs the labels of what is already on her shelf; the app reads the ingredients, checks how they get along with the roll-on, and picks the Be Bodywise product that fits, even when the cheaper one is enough |
| **2 · The day it arrives** | A routine built around her own shelf, two starting photos (underarm and inner arm, with a white paper card for colour), and a judge-by date with the cost to get there |
| **3 · While she uses it** | One quiet home screen, days of use, a reaction desk ("Something feels off"), a halfway photo and a refill reminder |
| **4 · The verdict** | The same two photos, measured against her own inner arm, plus a blind pick. The answer can be Working, Not yet, Can't call it, Not for you, or See a doctor |
| **5 · After the verdict** | Keep going with a check every 8 weeks, or stop well with a clear next step. She chooses whether to share an anonymous result |
| **For Be Bodywise** | What opted-in, anonymous results would show the brand (sample data) |

## Privacy by design

- **Skin photos never leave the phone.** They are stored in IndexedDB and measured in a Web Worker in the browser.
- **Label photos** are sent to one serverless function (`functions/api/read-label.ts`), which asks Google Gemini to transcribe the ingredient list. Nothing is stored and the image is never logged.
- **The AI only reads labels.** Every decision (clashes, product pick, verdict) is made by plain rules in `app/src/engine`.
- No login, no account, no tracking of names or numbers.

## Run it locally

Needs Node 22 or newer.

```bash
npm install
cp .dev.vars.example .dev.vars        # then put your Gemini key in GEMINI_API_KEY
npm run preview                       # builds the app and serves it with the label reader on http://localhost:8788
```

For live reload while developing, use two terminals:

```bash
npm run dev:api                       # the label reader (wrangler) on :8788
npm run dev                           # the app (Vite) on :5173, /api is proxied to :8788
```

A free Gemini key comes from https://aistudio.google.com/apikey. Without a key the app still runs: "Type the name" and "A Be Bodywise one" work without the label reader.

To build the plain app without the guided demo, set `VITE_GUIDED_DEMO=0` at build time.

## Deploy (Cloudflare Pages)

1. In Cloudflare, go to **Workers & Pages → Create → Pages → Connect to Git** and pick this repo.
2. Use these build settings:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `app/dist`
   - **Environment variable:** `NODE_VERSION` = `22`
3. Under **Settings → Variables and Secrets**, add the secret `GEMINI_API_KEY` for Production and Preview, then redeploy.

`OPENROUTER_API_KEY` is an optional backup reader. Every push to `main` redeploys.

## Tests

```bash
npm test                 # unit tests (Vitest): rules engine, photo maths, label reader
npm run test:e2e         # browser tests (Playwright) at 360, 390 and 480 px, including accessibility and "fits without scrolling"
node scripts/judge-walk.mjs out   # the whole journey as a judge, with screenshots (needs `npm run preview` running)
```

## Project layout

```
app/                React + Vite + TypeScript phone app
  src/engine/       rules: fit check, shelf pair rules, product pick, trial clock, verdict
  src/photo/        camera capture, white-card colour correction, ITA° measurement (Web Worker)
  src/screens/      Right Start, Fair Trial, Keep Going, example trial, insights
  src/ui/           shared components, guided demo (ui/tour)
functions/api/      read-label: the one serverless function (Cloudflare Pages Function)
solution/data/      product catalogue and ingredient rules (source of truth, copied into the app on build)
e2e/                Playwright tests
scripts/            data sync, judge walk
```
