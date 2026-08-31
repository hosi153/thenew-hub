import { db } from '../../config/firebase.js';
import { createCollectionRepository } from '../../data/collection-repository.js';
import { firestoreRestList, withTimeout } from '../../data/firestore-rest.js';

const COLLECTION = 'hallSchedule';
const repo = createCollectionRepository(COLLECTION);

export const scheduleCollectionIsEmpty = () => repo.isEmpty();
export const seedSchedules = (items) => repo.seed(items);
export const loadAllSchedules = () => repo.loadAll();
export const createScheduleId = () => repo.createId();
export const saveSchedule = (id, data, onStatus) => repo.save(id, data, onStatus);
export const deleteSchedule = (id, onStatus) => repo.delete(id, onStatus);

export async function loadSchedulePage({ after, limit, from }){
  return repo.loadPage({
    after,
    limit,
    buildQuery: (collection) => collection.where('datetime','>=',from).orderBy('datetime'),
  });
}

/* Schedule-specific query shapes that don't fit the generic repository
   (undated items, and a single calendar month's range) stay here, still
   using the shared db/transport helpers directly. */
export async function loadUndatedSchedules(){
  const snap = await withTimeout(db.collection(COLLECTION).where('datetime','==','').get(), 8000);
  return snap.docs.map(doc=>({id:doc.id, ...doc.data()}));
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
