import { db } from '../config/firebase.js';
import { deleteWithFallback, readWithFallback, withTimeout, writeWithFallback } from './firestore-rest.js';

/* ============ SHARED COLLECTION REPOSITORY ============
   Stage 4 of docs/PERFORMANCE_REFACTORING_PLAN.md.

   Every feature (schedule, matching codes, checklist) used to duplicate the
   same handful of Firestore operations in its own api.js: existence check,
   seeding, cursor-based pagination, full load, id generation, save, delete.
   This factory centralizes that shape so each feature's api.js only has to
   describe what's actually different about it (its collection name and,
   for paginated features, how a page query is built).

   It also centralizes de-duplication for loadAll(): if two different parts
   of the UI ask to fully load the same collection around the same time
   (e.g. typing in search right as a filter chip is tapped), they now share
   a single in-flight request and its result, instead of firing two separate
   reads against Firestore. */
export function createCollectionRepository(collectionName){
  const collection = () => db.collection(collectionName);

  let inFlightLoadAll = null;
  let lastLoadAllResult = null;
  /* Bumped on every successful write/delete. A read that started before a
     mutation may carry the OLD data (e.g. a slow full load still running when
     the admin deletes an item), so such reads are re-run or filtered below
     instead of letting them bring deleted items back. */
  let mutationEpoch = 0;
  const deletedIds = new Set();
  const withoutDeleted = items => items.filter(item=>!deletedIds.has(item.id));

  return {
    async isEmpty(){
      const snap = await withTimeout(collection().limit(1).get(), 8000);
      return snap.empty;
    },

    async seed(items){
      const batch = db.batch();
      items.forEach(item=>{
        const { id, ...data } = item;
        batch.set(collection().doc(id), data);
      });
      await withTimeout(batch.commit(), 10000);
    },

    /* buildQuery(collectionRef) lets each feature add its own where/orderBy
       clauses (schedule orders by datetime with a lower bound; codes orders
       by document id) before the shared limit/startAfter cursor logic runs. */
    async loadPage({ after, limit, buildQuery }){
      let query = (buildQuery ? buildQuery(collection()) : collection()).limit(limit);
      if(after) query = query.startAfter(after);
      const snap = await withTimeout(query.get(), 8000);
      return {
        items: withoutDeleted(snap.docs.map(doc=>({id:doc.id, ...doc.data()}))),
        lastDoc: snap.docs.length ? snap.docs[snap.docs.length-1] : after,
        hasMore: snap.docs.length === limit,
      };
    },

    /* De-duplicated + cached full load. Concurrent callers share one request;
       once it resolves, the result is kept so an immediate second call
       (e.g. a re-render triggered right after the first finishes) doesn't
       re-hit Firestore. Call invalidate() after a write/delete that should
       be reflected on the next full load. */
    async loadAll(){
      if(inFlightLoadAll) return inFlightLoadAll;
      if(lastLoadAllResult) return lastLoadAllResult.slice();
      inFlightLoadAll = (async ()=>{
        for(let attempt=0; ; attempt++){
          const epochAtStart = mutationEpoch;
          const items = withoutDeleted(await readWithFallback(collectionName));
          if(epochAtStart === mutationEpoch || attempt >= 2){
            if(epochAtStart === mutationEpoch) lastLoadAllResult = items;
            return items;
          }
          /* something was saved/deleted while we were reading: read again */
        }
      })().finally(()=>{ inFlightLoadAll = null; });
      return inFlightLoadAll;
    },
    invalidateLoadAllCache(){
      lastLoadAllResult = null;
    },

    createId(){
      return collection().doc().id;
    },

    async save(id, data, onStatus){
      lastLoadAllResult = null;
      const result = await writeWithFallback(collectionName, id, data, onStatus);
      if(result.ok){ mutationEpoch++; deletedIds.delete(id); lastLoadAllResult = null; }
      return result;
    },

    async delete(id, onStatus){
      lastLoadAllResult = null;
      const result = await deleteWithFallback(collectionName, id, onStatus);
      if(result.ok){ mutationEpoch++; deletedIds.add(id); lastLoadAllResult = null; }
      return result;
    },
  };
}
