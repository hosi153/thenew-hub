import { createCollectionRepository } from '../../data/collection-repository.js';

const COLLECTION = 'matchingCodes';
const repo = createCollectionRepository(COLLECTION);

export const matchingCodeCollectionIsEmpty = () => repo.isEmpty();
export const seedMatchingCodes = (items) => repo.seed(items);
export const loadAllMatchingCodes = () => repo.loadAll();
export const createMatchingCodeId = () => repo.createId();
export const saveMatchingCode = (id, data, onStatus) => repo.save(id, data, onStatus);
export const deleteMatchingCode = (id, onStatus) => repo.delete(id, onStatus);

export async function loadMatchingCodePage({ after, limit }){
  /* global firebase */
  return repo.loadPage({
    after,
    limit,
    buildQuery: (collection) => collection.orderBy(firebase.firestore.FieldPath.documentId()),
  });
}
