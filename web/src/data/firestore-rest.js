/* Extracted in stage 3 of docs/PERFORMANCE_REFACTORING_PLAN.md. */
import { db, firebaseConfig } from '../config/firebase.js';

/* ============ FIRESTORE REST FALLBACK ============
   The Firestore SDK's normal channel (streaming or long-polling) can be silently
   blackholed by some carrier proxies / ad blockers / VPNs, causing writes to hang
   forever instead of failing fast. As a fallback, we can talk to Firestore over
   plain HTTPS via its REST API, which behaves like any normal fetch() request and
   is far less likely to be specifically blocked. */

/* ---- Transport tuning (perf refactor plan, stage 1) ----
   Once the SDK's realtime channel proves unreachable this session, skip
   straight to REST for subsequent calls instead of re-paying a fresh SDK
   timeout every single time. */
let sdkTransportBlocked = false;
const SDK_ATTEMPT_MS = 2000;
const REST_ATTEMPT_MS = 8000;

function withAbortTimeout(ms){
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), ms);
  return { signal: controller.signal, clear: ()=>clearTimeout(timer) };
}
/* Best-effort mapping from an HTTP status to a Firestore-style error code, so
   callers can distinguish "no permission" from "network unreachable" etc. */
function classifyRestError(status, bodyText){
  let code = 'unknown';
  if(status===403) code = 'permission-denied';
  else if(status===404) code = 'not-found';
  else if(status===429) code = 'resource-exhausted';
  else if(status>=500) code = 'unavailable';
  const err = new Error(`rest-${status}${bodyText ? ': '+bodyText.slice(0,150) : ''}`);
  err.code = code;
  return err;
}

function toFirestoreValue(v){
  if(v === null || v === undefined) return {nullValue: null};
  if(typeof v === 'boolean') return {booleanValue: v};
  if(typeof v === 'number') return Number.isInteger(v) ? {integerValue: String(v)} : {doubleValue: v};
  if(typeof v === 'string') return {stringValue: v};
  if(Array.isArray(v)) return {arrayValue: {values: v.map(toFirestoreValue)}};
  if(typeof v === 'object') return {mapValue: {fields: toFirestoreFields(v)}};
  return {stringValue: String(v)};
}
function toFirestoreFields(obj){
  const fields = {};
  Object.entries(obj || {}).forEach(([k,v])=>{ fields[k] = toFirestoreValue(v); });
  return fields;
}
async function firestoreRestSet(collection, docId, data, ms=REST_ATTEMPT_MS){
  const {signal, clear} = withAbortTimeout(ms);
  try{
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ fields: toFirestoreFields(data) }),
      signal
    });
    if(!res.ok){ const t = await res.text().catch(()=> ''); throw classifyRestError(res.status, t); }
  }finally{ clear(); }
}
async function firestoreRestDelete(collection, docId, ms=REST_ATTEMPT_MS){
  const {signal, clear} = withAbortTimeout(ms);
  try{
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, { method: 'DELETE', signal });
    if(!res.ok){ const t = await res.text().catch(()=> ''); throw classifyRestError(res.status, t); }
  }finally{ clear(); }
}
async function firestoreRestMerge(collection, docId, changes, ms=REST_ATTEMPT_MS){
  const {signal, clear} = withAbortTimeout(ms);
  try{
    const mask = Object.keys(changes).map(k=>`updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?${mask}&key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fields: toFirestoreFields(changes)}), signal });
    if(!res.ok){ const t = await res.text().catch(()=> ''); throw classifyRestError(res.status, t); }
  }finally{ clear(); }
}

/* ---- Writes go over REST only (no SDK) ----
   The SDK queues every write and keeps retrying it in the background. When an
   SDK write "timed out" and we fell back to REST, the queued SDK write was
   still alive and could land LATER, after a newer REST edit or delete, which
   resurrected deleted data / reverted edits ("새로고침하면 데이터가 살아난다").
   A plain HTTPS request has no hidden retry queue: when it succeeds the server
   really has the change, and when it fails nothing will be applied later. */
const WRITE_ATTEMPT_MS = 9000;
const VERIFY_ATTEMPT_MS = 2500;

async function firestoreRestExists(collection, docId){
  const {signal, clear} = withAbortTimeout(VERIFY_ATTEMPT_MS);
  try{
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, { signal, cache:'no-store' });
    if(res.status===404) return false;
    if(res.ok) return true;
    return null; /* unknown (e.g. read denied): don't fail the delete over it */
  }catch(e){ return null; }
  finally{ clear(); }
}

function failure(label, e){
  console.error(label, e);
  return {ok:false, error:(e && e.message) || String(e), code: e && e.code};
}

export async function writeWithFallback(collection, docId, data, onStatus){
  try{
    if(onStatus) onStatus('저장 중');
    await firestoreRestSet(collection, docId, data, WRITE_ATTEMPT_MS);
    return {ok:true};
  }catch(e){ return failure('REST write failed:', e); }
}
export async function deleteWithFallback(collection, docId, onStatus){
  try{
    if(onStatus) onStatus('삭제 중');
    await firestoreRestDelete(collection, docId, WRITE_ATTEMPT_MS);
  }catch(e){ return failure('REST delete failed:', e); }
  /* Make sure the server really dropped it before the UI says "deleted". */
  if(await firestoreRestExists(collection, docId) === true){
    return failure('REST delete not applied:', new Error('delete-not-applied'));
  }
  return {ok:true};
}
/* Partial-field update (merge) — doesn't require the full document to already
   be loaded locally. Used by admin patches so they work correctly even when
   the target document isn't part of the currently-paginated data in memory. */
export async function mergeWithFallback(collection, docId, changes, onStatus){
  try{
    if(onStatus) onStatus('저장 중');
    await firestoreRestMerge(collection, docId, changes, WRITE_ATTEMPT_MS);
    return {ok:true};
  }catch(e){ return failure('REST merge failed:', e); }
}

function fromFirestoreValue(v){
  if(!v) return null;
  if('stringValue' in v) return v.stringValue;
  if('booleanValue' in v) return v.booleanValue;
  if('integerValue' in v) return parseInt(v.integerValue,10);
  if('doubleValue' in v) return v.doubleValue;
  if('nullValue' in v) return null;
  if('mapValue' in v) return fromFirestoreFields((v.mapValue && v.mapValue.fields) || {});
  if('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(fromFirestoreValue);
  return null;
}
function fromFirestoreFields(fields){
  const obj = {};
  Object.entries(fields || {}).forEach(([k,v])=>{ obj[k] = fromFirestoreValue(v); });
  return obj;
}
export async function firestoreRestList(collection){
  const documents = [];
  let pageToken = '';
  do{
    const {signal, clear} = withAbortTimeout(REST_ATTEMPT_MS);
    try{
      const params = new URLSearchParams({pageSize:'300', key:firebaseConfig.apiKey});
      if(pageToken) params.set('pageToken', pageToken);
      const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}?${params}`;
      const res = await fetch(url, {signal, cache:'no-store'});
      if(!res.ok){ const t = await res.text().catch(()=> ''); throw classifyRestError(res.status, t); }
      const json = await res.json();
      (json.documents || []).forEach(doc=>{
        const id = doc.name.split('/').pop();
        documents.push({ id, ...fromFirestoreFields(doc.fields || {}) });
      });
      pageToken = json.nextPageToken || '';
    }finally{ clear(); }
  }while(pageToken);
  return documents;
}
/* Try the SDK first (fast path, short budget); if it fails or hangs, switch
   this session to REST for subsequent calls too. */
export async function readWithFallback(collection){
  if(!sdkTransportBlocked){
    try{
      const snap = await withTimeout(db.collection(collection).get(), SDK_ATTEMPT_MS);
      return snap.docs.map(d=>({id:d.id, ...d.data()}));
    }catch(e1){
      console.warn(`SDK read of ${collection} failed, switching to REST for this session:`, e1);
      sdkTransportBlocked = true;
    }
  }
  return await firestoreRestList(collection);
}

/* Wraps a promise so it never hangs forever — rejects after `ms` if unresolved (e.g. stuck network) */
export function withTimeout(promise, ms=15000){
  return Promise.race([
    promise,
    new Promise((_,reject)=> setTimeout(()=>reject(new Error('timeout')), ms))
  ]);
}
