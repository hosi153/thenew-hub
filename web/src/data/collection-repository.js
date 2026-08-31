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
        items: snap.docs.map(doc=>({id:doc.id, ...doc.data()})),
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
      inFlightLoadAll = readWithFallback(collectionName)
        .then(items=>{ lastLoadAllResult = items; return items; })
        .finally(()=>{ inFlightLoadAll = null; });
      return inFlightLoadAll;
    },
    invalidateLoadAllCache(){
      lastLoadAllResult = null;
    },

    createId(){
      return collection().doc().id;
    },

    save(id, data, onStatus){
      lastLoadAllResult = null;
      return writeWithFallback(collectionName, id, data, onStatus);
    },

    delete(id, onStatus){
      lastLoadAllResult = null;
      return deleteWithFallback(collectionName, id, onStatus);
    },
  };
}
