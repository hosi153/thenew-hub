import { createCollectionRepository } from '../../data/collection-repository.js';

const COLLECTION = 'instaShares';
const repo = createCollectionRepository(COLLECTION);

/* Small, non-paginated collection, same shape as the checklist feature —
   plus seeding support since this feature launches with real starter data. */
export const instaCollectionIsEmpty = () => repo.isEmpty();
export const seedInstaShares = (items) => repo.seed(items);
export const loadAllInstaShares = () => repo.loadAll();
export const createInstaShareId = () => repo.createId();
export const saveInstaShare = (id, data, onStatus) => repo.save(id, data, onStatus);
export const deleteInstaShare = (id, onStatus) => repo.delete(id, onStatus);
