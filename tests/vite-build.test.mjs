// Stage 2 (docs/PERFORMANCE_REFACTORING_PLAN.md) — verifies the parallel Vite
// build under web/ actually produces a working, deployable bundle, without
// touching or depending on anything about the currently-live root index.html.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const root = new URL('..', import.meta.url).pathname;
const distDir = join(root, 'dist');

test('vite build succeeds and produces dist/', () => {
  execFileSync('npx', ['vite', 'build'], { cwd: root, stdio: 'pipe' });
  assert.ok(existsSync(join(distDir, 'index.html')), 'dist/index.html should exist after build');
});

test('build output references hashed CSS and JS assets that actually exist', () => {
  const html = readFileSync(join(distDir, 'index.html'), 'utf8');
  const cssMatch = html.match(/assets\/(index-[\w-]+\.css)/);
  const jsMatch = html.match(/assets\/(index-[\w-]+\.js)/);
  assert.ok(cssMatch, 'index.html should link a hashed CSS bundle');
  assert.ok(jsMatch, 'index.html should reference a hashed JS bundle');
  assert.ok(existsSync(join(distDir, 'assets', cssMatch[1])), 'referenced CSS file should exist on disk');
  assert.ok(existsSync(join(distDir, 'assets', jsMatch[1])), 'referenced JS file should exist on disk');
});

test('every inline onclick/oninput/onchange handler function is exposed on window in the bundle', () => {
  const webHtml = readFileSync(join(root, 'web', 'index.html'), 'utf8');
  const handlerAttrs = [...webHtml.matchAll(/\son(?:click|input|change|submit)="([^"]+)"/g)].map((m) => m[1]);
  const fnNames = new Set();
  handlerAttrs.forEach((h) => {
    const m = h.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/);
    if (m) fnNames.add(m[1]);
  });
  assert.ok(fnNames.size > 0, 'expected to find inline handler function references in web/index.html');

  const assetFiles = readdirSync(join(distDir, 'assets'));
  const jsFile = assetFiles.find((f) => f.endsWith('.js'));
  assert.ok(jsFile, 'built JS bundle should exist');
  const js = readFileSync(join(distDir, 'assets', jsFile), 'utf8');

  const missing = [...fnNames].filter((name) => !new RegExp(`window\\.${name}\\s*=`).test(js));
  assert.deepEqual(missing, [], `these inline-handler functions are not exposed on window in the built bundle: ${missing.join(', ')}`);
});

test('HTML element ids in the Vite entry are unique (same invariant as the live index.html)', () => {
  const webHtml = readFileSync(join(root, 'web', 'index.html'), 'utf8');
  const staticMarkup = webHtml.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const ids = [...staticMarkup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('stage 3 schedule feature owns its API, state, and view modules', () => {
  const main = readFileSync(join(root, 'web', 'src', 'main.js'), 'utf8');
  const api = readFileSync(join(root, 'web', 'src', 'features', 'schedule', 'api.js'), 'utf8');
  const state = readFileSync(join(root, 'web', 'src', 'features', 'schedule', 'state.js'), 'utf8');
  const view = readFileSync(join(root, 'web', 'src', 'features', 'schedule', 'view.js'), 'utf8');

  assert.match(main, /from '\.\/features\/schedule\/state\.js'/);
  assert.match(main, /from '\.\/features\/schedule\/view\.js'/);
  assert.doesNotMatch(main, /let halls\s*=|let hallPage\s*=|let hallFilter\s*=/);
  assert.match(api, /const COLLECTION = 'hallSchedule'/);
  assert.match(state, /export const scheduleState/);
  assert.match(view, /export async function initializeSchedules/);
  assert.match(view, /document\.getElementById\('hallForm'\)\.addEventListener\('submit'/);
});

test('stage 3 matching-code feature owns its API, state, and view modules', () => {
  const main = readFileSync(join(root, 'web', 'src', 'main.js'), 'utf8');
  const api = readFileSync(join(root, 'web', 'src', 'features', 'codes', 'api.js'), 'utf8');
  const state = readFileSync(join(root, 'web', 'src', 'features', 'codes', 'state.js'), 'utf8');
  const view = readFileSync(join(root, 'web', 'src', 'features', 'codes', 'view.js'), 'utf8');

  assert.match(main, /from '\.\/features\/codes\/state\.js'/);
  assert.match(main, /from '\.\/features\/codes\/view\.js'/);
  assert.doesNotMatch(main, /let codes\s*=|let codePage\s*=|let codeFilter\s*=/);
  assert.match(api, /const COLLECTION = 'matchingCodes'/);
  assert.match(state, /export const matchingCodeState/);
  assert.match(view, /export async function initializeMatchingCodes/);
  assert.match(view, /document\.getElementById\('codeForm'\)\.addEventListener\('submit'/);
});
