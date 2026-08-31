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

test('stage 3 checklist feature owns its API, state, and view modules', () => {
  const main = readFileSync(join(root, 'web', 'src', 'main.js'), 'utf8');
  const api = readFileSync(join(root, 'web', 'src', 'features', 'checklist', 'api.js'), 'utf8');
  const state = readFileSync(join(root, 'web', 'src', 'features', 'checklist', 'state.js'), 'utf8');
  const view = readFileSync(join(root, 'web', 'src', 'features', 'checklist', 'view.js'), 'utf8');

  assert.match(main, /from '\.\/features\/checklist\/state\.js'/);
  assert.match(main, /from '\.\/features\/checklist\/view\.js'/);
  assert.doesNotMatch(main, /let checklists\s*=|let viewingChecklistId\s*=|let editingChecklistId\s*=|const CHECKLIST_TEMPLATE\s*=/);
  assert.match(api, /const COLLECTION = 'prepChecklist'/);
  assert.match(state, /export const checklistState/);
  assert.match(view, /export async function initializeChecklists/);
  assert.match(view, /document\.getElementById\('checklistForm'\)\.addEventListener\('submit'/);
  assert.match(view, /const CHECKLIST_TEMPLATE = \[/);
});

test('stage 4: schedule, codes, and checklist share one collection-repository data layer', () => {
  const repository = readFileSync(join(root, 'web', 'src', 'data', 'collection-repository.js'), 'utf8');
  assert.match(repository, /export function createCollectionRepository\(collectionName\)/);
  assert.match(repository, /isEmpty\(\)/);
  assert.match(repository, /async seed\(items\)/);
  assert.match(repository, /async loadPage\(/);
  assert.match(repository, /async loadAll\(\)/);
  assert.match(repository, /createId\(\)/);
  assert.match(repository, /save\(id, data, onStatus\)/);
  assert.match(repository, /delete\(id, onStatus\)/);

  const scheduleApi = readFileSync(join(root, 'web', 'src', 'features', 'schedule', 'api.js'), 'utf8');
  const codesApi = readFileSync(join(root, 'web', 'src', 'features', 'codes', 'api.js'), 'utf8');
  const checklistApi = readFileSync(join(root, 'web', 'src', 'features', 'checklist', 'api.js'), 'utf8');

  [scheduleApi, codesApi, checklistApi].forEach((source) => {
    assert.match(source, /from '\.\.\/\.\.\/data\/collection-repository\.js'/);
    assert.match(source, /createCollectionRepository\(COLLECTION\)/);
  });

  // Each feature's api.js should no longer hand-roll its own Firestore
  // existence-check / batch-seed / save / delete logic — that now lives
  // once in collection-repository.js.
  [scheduleApi, codesApi, checklistApi].forEach((source) => {
    assert.doesNotMatch(source, /db\.batch\(\)/);
    assert.doesNotMatch(source, /writeWithFallback\(collectionName|writeWithFallback\(COLLECTION,/);
  });
});

test('stage 4: loadAll() de-duplicates concurrent calls and caches the last result', () => {
  const repository = readFileSync(join(root, 'web', 'src', 'data', 'collection-repository.js'), 'utf8');
  assert.match(repository, /let inFlightLoadAll/);
  assert.match(repository, /let lastLoadAllResult/);
  assert.match(repository, /if\(inFlightLoadAll\) return inFlightLoadAll;/);
  assert.match(repository, /if\(lastLoadAllResult\) return lastLoadAllResult\.slice\(\);/);
  assert.match(repository, /invalidateLoadAllCache/);
});

test('stage 4: required Firestore composite/range indexes are documented', () => {
  const indexDocsPath = join(root, 'docs', 'FIRESTORE_INDEXES.md');
  assert.ok(existsSync(indexDocsPath), 'docs/FIRESTORE_INDEXES.md should exist');
  const content = readFileSync(indexDocsPath, 'utf8');
  assert.match(content, /hallSchedule/);
  assert.match(content, /matchingCodes/);
  assert.match(content, /datetime/);
});

test('stage 5: search inputs are debounced instead of re-rendering on every keystroke', () => {
  const webHtml = readFileSync(join(root, 'web', 'index.html'), 'utf8');
  assert.match(webHtml, /id="hallSearch"[^>]*oninput="handleHallSearchInput\(\)"/);
  assert.match(webHtml, /id="codeSearch"[^>]*oninput="handleCodeSearchInput\(\)"/);

  const debounceUtil = readFileSync(join(root, 'web', 'src', 'ui', 'debounce.js'), 'utf8');
  assert.match(debounceUtil, /export function debounce\(fn, wait = 150\)/);

  const scheduleView = readFileSync(join(root, 'web', 'src', 'features', 'schedule', 'view.js'), 'utf8');
  const codesView = readFileSync(join(root, 'web', 'src', 'features', 'codes', 'view.js'), 'utf8');
  assert.match(scheduleView, /from '\.\.\/\.\.\/ui\/debounce\.js'/);
  assert.match(scheduleView, /export const handleHallSearchInput = debounce\(/);
  assert.match(codesView, /from '\.\.\/\.\.\/ui\/debounce\.js'/);
  assert.match(codesView, /export const handleCodeSearchInput = debounce\(/);
});

test('stage 5: list renders skip redundant DOM writes when markup is unchanged', () => {
  const scheduleView = readFileSync(join(root, 'web', 'src', 'features', 'schedule', 'view.js'), 'utf8');
  const codesView = readFileSync(join(root, 'web', 'src', 'features', 'codes', 'view.js'), 'utf8');
  const checklistView = readFileSync(join(root, 'web', 'src', 'features', 'checklist', 'view.js'), 'utf8');

  assert.match(scheduleView, /let lastHallListHtml = null;/);
  assert.match(scheduleView, /if\(html !== lastHallListHtml\)/);
  assert.match(codesView, /let lastCodeListHtml = null;/);
  assert.match(codesView, /if\(html !== lastCodeListHtml\)/);
  assert.match(checklistView, /let lastChecklistListHtml = null;/);
  assert.match(checklistView, /if\(html !== lastChecklistListHtml\)/);
});

test('stage 5: calendar cache is only invalidated at genuine data-mutation points, not on every render', () => {
  const scheduleView = readFileSync(join(root, 'web', 'src', 'features', 'schedule', 'view.js'), 'utf8');
  const main = readFileSync(join(root, 'web', 'src', 'main.js'), 'utf8');

  // resetScheduleCalendarCache() must NOT appear inside renderHalls() or
  // renderCalendar() themselves — only around save/delete/full-load/patch
  // completion, where the underlying data actually changed.
  const renderHallsBody = scheduleView.slice(
    scheduleView.indexOf('export function renderHalls()'),
    scheduleView.indexOf('export const handleHallSearchInput'),
  );
  assert.doesNotMatch(renderHallsBody, /resetScheduleCalendarCache\(\)/);

  const renderCalendarBody = scheduleView.slice(
    scheduleView.indexOf('export async function renderCalendar()'),
    scheduleView.indexOf('export function calSelectDate'),
  );
  assert.doesNotMatch(renderCalendarBody, /resetScheduleCalendarCache\(\)/);

  // It *should* be called after data-mutating operations.
  const callSites = [...scheduleView.matchAll(/resetScheduleCalendarCache\(\);/g)].length
    + [...main.matchAll(/resetScheduleCalendarCache\(\);/g)].length;
  assert.ok(callSites >= 3, `expected calendar cache invalidation at save/delete/patch sites, found ${callSites}`);
});

test('stage 5: virtual scrolling decision is documented with a re-evaluation trigger', () => {
  const plan = readFileSync(join(root, 'docs', 'PERFORMANCE_REFACTORING_PLAN.md'), 'utf8');
  assert.match(plan, /가상 스크롤 도입 여부 판단/);
  assert.match(plan, /지금은 도입하지 않는다/);
  assert.match(plan, /재검토 조건/);
});

test('stage 5: modal focus management, keyboard handling, and reduced-motion are covered', () => {
  const modal = readFileSync(join(root, 'web', 'src', 'ui', 'modal.js'), 'utf8');
  assert.match(modal, /setAttribute\('aria-hidden','false'\)/);
  assert.match(modal, /setAttribute\('aria-hidden','true'\)/);
  assert.match(modal, /\.focus\(\)/);
  assert.match(modal, /addEventListener\('keydown'/);

  const css = readFileSync(join(root, 'web', 'src', 'style.css'), 'utf8');
  assert.match(css, /prefers-reduced-motion\s*:\s*reduce/);
});
