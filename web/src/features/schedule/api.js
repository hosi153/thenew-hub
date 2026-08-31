import { db } from '../../config/firebase.js';
import {
  deleteWithFallback,
  firestoreRestList,
  readWithFallback,
  withTimeout,
  writeWithFallback,
} from '../../data/firestore-rest.js';

const COLLECTION = 'hallSchedule';

export async function scheduleCollectionIsEmpty(){
  const snap = await withTimeout(db.collection(COLLECTION).limit(1).get(), 8000);
  return snap.empty;
}

export async function seedSchedules(items){
  const batch = db.batch();
  items.forEach(item=>{
    const {id, ...data} = item;
    batch.set(db.collection(COLLECTION).doc(id), data);
  });
  await withTimeout(batch.commit(), 10000);
}

export async function loadSchedulePage({ after, limit, from }){
  let query = db.collection(COLLECTION).where('datetime','>=',from).orderBy('datetime').limit(limit);
  if(after) query = query.startAfter(after);
  const snap = await withTimeout(query.get(), 8000);
  return {
    items: snap.docs.map(doc=>({id:doc.id, ...doc.data()})),
    lastDoc: snap.docs.length ? snap.docs[snap.docs.length-1] : after,
    hasMore: snap.docs.length === limit,
  };
}

export async function loadUndatedSchedules(){
  const snap = await withTimeout(db.collection(COLLECTION).where('datetime','==','').get(), 8000);
  return snap.docs.map(doc=>({id:doc.id, ...doc.data()}));
}

export function loadAllSchedules(){
  return readWithFallback(COLLECTION);
}

export async function loadScheduleMonth(start, end){
  try{
    const snap = await withTimeout(
      db.collection(COLLECTION).where('datetime','>=',start).where('datetime','<',end).get(),
      8000
    );
    return snap.docs.map(doc=>({id:doc.id, ...doc.data()}));
  }catch(error){
    console.error('loadScheduleMonth query failed, trying REST list fallback:', error);
    const all = await firestoreRestList(COLLECTION);
    return all.filter(item=>item.datetime && item.datetime>=start && item.datetime<end);
  }
}

export function createScheduleId(){
  return db.collection(COLLECTION).doc().id;
}

export function saveSchedule(id, data, onStatus){
  return writeWithFallback(COLLECTION, id, data, onStatus);
}

export function deleteSchedule(id, onStatus){
  return deleteWithFallback(COLLECTION, id, onStatus);
}
