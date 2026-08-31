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
async function firestoreRestSet(collection, docId, data){
  const {signal, clear} = withAbortTimeout(REST_ATTEMPT_MS);
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
async function firestoreRestDelete(collection, docId){
  const {signal, clear} = withAbortTimeout(REST_ATTEMPT_MS);
  try{
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, { method: 'DELETE', signal });
    if(!res.ok){ const t = await res.text().catch(()=> ''); throw classifyRestError(res.status, t); }
  }finally{ clear(); }
}
async function firestoreRestMerge(collection, docId, changes){
  const {signal, clear} = withAbortTimeout(REST_ATTEMPT_MS);
  try{
    const mask = Object.keys(changes).map(k=>`updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/${collection}/${encodeURIComponent(docId)}?${mask}&key=${firebaseConfig.apiKey}`;
    const res = await fetch(url, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({fields: toFirestoreFields(changes)}), signal });
    if(!res.ok){ const t = await res.text().catch(()=> ''); throw classifyRestError(res.status, t); }
  }finally{ clear(); }
}

/* Try the SDK first (fast path, short budget); if it fails or hangs, switch
   this session to REST and use it for the rest of the session too, so we
   don't keep re-paying a losing SDK attempt on every subsequent call. */
export async function writeWithFallback(collection, docId, data, onStatus){
  if(!sdkTransportBlocked){
    try{
      if(onStatus) onStatus('저장 중');
      await withTimeout(db.collection(collection).doc(docId).set(data), SDK_ATTEMPT_MS);
      return {ok:true};
    }catch(e1){
      console.warn(`SDK write to ${collection}/${docId} failed, switching to REST for this session:`, e1);
      sdkTransportBlocked = true;
    }
  }
  try{
    if(onStatus) onStatus('연결 재시도 중');
    await firestoreRestSet(collection, docId, data);
    return {ok:true};
  }catch(e2){
    console.error('REST fallback write failed:', e2);
    return {ok:false, error:(e2 && e2.message) || String(e2), code: e2 && e2.code};
  }
}
export async function deleteWithFallback(collection, docId, onStatus){
  if(!sdkTransportBlocked){
    try{
      if(onStatus) onStatus('삭제 중');
      await withTimeout(db.collection(collection).doc(docId).delete(), SDK_ATTEMPT_MS);
      return {ok:true};
    }catch(e1){
      console.warn(`SDK delete of ${collection}/${docId} failed, switching to REST for this session:`, e1);
      sdkTransportBlocked = true;
    }
  }
  try{
    if(onStatus) onStatus('연결 재시도 중');
    await firestoreRestDelete(collection, docId);
    return {ok:true};
  }catch(e2){
    console.error('REST fallback delete failed:', e2);
    return {ok:false, error:(e2 && e2.message) || String(e2), code: e2 && e2.code};
  }
}
/* Partial-field update (merge) — doesn't require the full document to already
   be loaded locally. Used by admin patches so they work correctly even when
   the target document isn't part of the currently-paginated data in memory. */
export async function mergeWithFallback(collection, docId, changes, onStatus){
  if(!sdkTransportBlocked){
    try{
      if(onStatus) onStatus('저장 중');
      await withTimeout(db.collection(collection).doc(docId).set(changes, {merge:true}), SDK_ATTEMPT_MS);
      return {ok:true};
    }catch(e1){
      console.warn(`SDK merge to ${collection}/${docId} failed, switching to REST for this session:`, e1);
      sdkTransportBlocked = true;
    }
  }
  try{
    if(onStatus) onStatus('연결 재시도 중');
    await firestoreRestMerge(collection, docId, changes);
    return {ok:true};
  }catch(e2){
    console.error('REST fallback merge failed:', e2);
    return {ok:false, error:(e2 && e2.message) || String(e2), code: e2 && e2.code};
  }
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
      const res = await fetch(url, {signal});
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
