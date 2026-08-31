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
