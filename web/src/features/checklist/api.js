import { createCollectionRepository } from '../../data/collection-repository.js';

const COLLECTION = 'prepChecklist';
const repo = createCollectionRepository(COLLECTION);

/* Checklist stays a small, non-paginated collection by design (one entry
   per couple), so it only uses the non-paginated slice of the shared
   repository — loadPage()/isEmpty()/seed() aren't needed here. */
export const loadAllChecklists = () => repo.loadAll();
export const createChecklistId = () => repo.createId();
export const saveChecklist = (id, data, onStatus) => repo.save(id, data, onStatus);
export const deleteChecklist = (id, onStatus) => repo.delete(id, onStatus);
