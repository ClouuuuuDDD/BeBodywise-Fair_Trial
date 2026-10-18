#!/usr/bin/env node
// Copies solution/data/*.json (the source of truth) into app/src/data/.
// Runs automatically before dev, build, test, typecheck and lint. Never hand-edit the copies:
// they are gitignored and overwritten on every run. Change solution/data/ instead.
import { copyFileSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'solution', 'data');
const dest = join(root, 'app', 'src', 'data');

mkdirSync(dest, { recursive: true });
const files = readdirSync(src).filter((f) => f.endsWith('.json'));
if (files.length === 0) {
  console.error(`sync-data: no .json files in ${src}`);
  process.exit(1);
}
for (const f of files) {
  // Fail loudly on malformed JSON rather than shipping a broken copy.
  JSON.parse(readFileSync(join(src, f), 'utf8'));
  copyFileSync(join(src, f), join(dest, f));
}
console.log(`sync-data: copied ${files.length} file(s) to app/src/data/: ${files.join(', ')}`);
