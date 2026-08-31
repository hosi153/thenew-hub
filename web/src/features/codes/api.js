import { db } from '../../config/firebase.js';
import {
  deleteWithFallback,
  readWithFallback,
  withTimeout,
  writeWithFallback,
} from '../../data/firestore-rest.js';

const COLLECTION = 'matchingCodes';

export async function matchingCodeCollectionIsEmpty(){
  const snap = await withTimeout(db.collection(COLLECTION).limit(1).get(), 8000);
  return snap.empty;
}

export async function seedMatchingCodes(items){
  const batch = db.batch();
  items.forEach(item=>{
    const {id, ...data} = item;
    batch.set(db.collection(COLLECTION).doc(id), data);
  });
  await withTimeout(batch.commit(), 10000);
}

export async function loadMatchingCodePage({after, limit}){
  /* global firebase */
  let query = db.collection(COLLECTION).orderBy(firebase.firestore.FieldPath.documentId()).limit(limit);
  if(after) query = query.startAfter(after);
  const snap = await withTimeout(query.get(), 8000);
  return {
    items: snap.docs.map(doc=>({id:doc.id, ...doc.data()})),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length-1] : after,
    hasMore: snap.docs.length === limit,
  };
}

export function loadAllMatchingCodes(){
  return readWithFallback(COLLECTION);
}

export function createMatchingCodeId(){
  return db.collection(COLLECTION).doc().id;
}

export function saveMatchingCode(id, data, onStatus){
  return writeWithFallback(COLLECTION, id, data, onStatus);
}

export function deleteMatchingCode(id, onStatus){
  return deleteWithFallback(COLLECTION, id, onStatus);
}
