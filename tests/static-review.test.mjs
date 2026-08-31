import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)];
const appScript = inlineScripts.at(-1)?.[1] ?? '';
const staticMarkup = html.replace(/<script\b[\s\S]*?<\/script>/gi, '').replace(/<style\b[\s\S]*?<\/style>/gi, '');

test('inline application JavaScript parses', () => {
  assert.ok(appScript.length > 1000);
  assert.doesNotThrow(() => new Function(appScript));
});

test('HTML ids are unique', () => {
  const ids = [...staticMarkup.matchAll(/\sid="([^"]+)"/g)].map(match => match[1]);
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  assert.deepEqual([...new Set(duplicates)], []);
});

test('REST fallback consumes every Firestore page', () => {
  assert.match(appScript, /json\.nextPageToken/);
  assert.match(appScript, /while\(pageToken\)/);
});

test('new passwords use salted PBKDF2 while legacy verification remains', () => {
  assert.match(appScript, /name:'PBKDF2'/);
  assert.match(appScript, /crypto\.getRandomValues/);
  assert.match(appScript, /hashPwLegacy/);
});

test('Firestore document ids are not interpolated into inline handlers', () => {
  assert.doesNotMatch(appScript, /onclick="(?:openHallDetail|openCodeDetail|openChecklistDetail)\('\$\{/);
  assert.match(appScript, /data-action="hall-detail"/);
  assert.match(appScript, /data-action="code-detail"/);
  assert.match(appScript, /data-action="checklist-detail"/);
  assert.match(appScript, /escapeHtml\(c\.category\)/);
});

test('every modal exposes dialog semantics', () => {
  const overlays = [...html.matchAll(/<div class="overlay"[^>]*>/g)].map(match => match[0]);
  const dialogs = [...html.matchAll(/<div class="modal"[^>]*role="dialog"[^>]*>/g)].map(match => match[0]);
  assert.ok(overlays.length > 0);
  assert.equal(dialogs.length, overlays.length);
  overlays.forEach(overlay => assert.match(overlay, /aria-hidden="true"/));
});

test('external HTTP links are not present', () => {
  assert.doesNotMatch(html, /href="http:\/\//);
});

test('hall schedule uses separate mobile-safe date and time controls', () => {
  assert.match(html, /id="h_date"[^>]*type="date"|type="date"[^>]*id="h_date"/);
  assert.match(html, /id="h_time"[^>]*type="time"|type="time"[^>]*id="h_time"/);
  assert.doesNotMatch(html, /id="h_datetime"/);
  assert.match(html, /@media \(max-width:420px\)[\s\S]*?\.datetime-fields\{ grid-template-columns:minmax\(0,1fr\); \}/);
  assert.match(appScript, /const datetime = date && time \? `\$\{date\}T\$\{time\}` : '';/);
});

test('calendar is the default hall schedule view', () => {
  assert.match(html, /id="viewToggleCal"[^>]*class="[^"]*active|class="[^"]*active[^"]*"[^>]*id="viewToggleCal"/);
  assert.match(html, /id="viewToggleCal"[^>]*aria-pressed="true"/);
  assert.match(html, /id="hallListView"[^>]*style="display:none;"/);
  assert.match(appScript, /let hallView = 'calendar';/);
  assert.match(appScript, /classList\.contains\('active'\) && hallView==='calendar'\) renderCalendar\(\)/);
});

test('Miyu Snap partner entry and 2027 packages are present', () => {
  assert.match(html, /data-partner="miyu"/);
  assert.match(html, /id="partner-miyu"/);
  assert.match(html, /미유스냅/);
  assert.match(html, /https:\/\/open\.kakao\.com\/o\/sB6PHYWg/);
  assert.match(html, /스탠다드 30만원 · 프리미엄 35만원/);
  assert.match(html, /<h3>18만원<\/h3>/);
  assert.match(html, /<h3>22만원<\/h3>/);
});

test('YELOVE partner entry, benefits, products, and links are present', () => {
  assert.match(html, /data-partner="yelove"/);
  assert.match(html, /id="partner-yelove"/);
  assert.match(html, /YELOVE 예러브/);
  assert.match(html, /식전영상과 식중영상 동시 구매 시 20,000원 할인/);
  assert.match(html, /디어러브/);
  assert.match(html, /로즈러브/);
  assert.match(html, /데이지러브/);
  assert.match(html, /https:\/\/pf\.kakao\.com\/_fxlswn/);
  assert.match(html, /https:\/\/www\.instagram\.com\/yelove_wedding/);
});

test('perf plan stage 1: SDK attempt budget is short and REST fallback remembers session state', () => {
  assert.match(appScript, /const SDK_ATTEMPT_MS = 2000;/);
  assert.match(appScript, /const REST_ATTEMPT_MS = 8000;/);
  assert.match(appScript, /let sdkTransportBlocked = false;/);
  // once the SDK is marked blocked, later calls must skip straight to REST
  assert.match(appScript, /if\(!sdkTransportBlocked\)\{[\s\S]*?sdkTransportBlocked = true;/);
});

test('perf plan stage 1: REST requests use AbortController instead of a dangling timer', () => {
  assert.match(appScript, /function withAbortTimeout\(ms\)\{/);
  assert.match(appScript, /new AbortController\(\)/);
  assert.match(appScript, /signal: controller\.signal/);
  assert.match(appScript, /fetch\(url, \{[\s\S]*?signal\s*\}\)|fetch\(url, \{signal\}\)/);
});

test('perf plan stage 1: REST error responses are classified into Firestore-style codes', () => {
  assert.match(appScript, /function classifyRestError\(status, bodyText\)\{/);
  assert.match(appScript, /code = 'permission-denied'/);
  assert.match(appScript, /code = 'resource-exhausted'/);
});

test('perf plan stage 1: save/delete flows surface staged status text', () => {
  assert.match(appScript, /'비밀번호 처리 중'/);
  assert.match(appScript, /'연결 재시도 중'/);
});
