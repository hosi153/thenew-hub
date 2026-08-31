import { db } from '../../config/firebase.js';
import { deleteWithFallback, readWithFallback, writeWithFallback } from '../../data/firestore-rest.js';

const COLLECTION = 'prepChecklist';

export function loadAllChecklists(){
  return readWithFallback(COLLECTION);
}

export function createChecklistId(){
  return db.collection(COLLECTION).doc().id;
}

export function saveChecklist(id, data, onStatus){
  return writeWithFallback(COLLECTION, id, data, onStatus);
}

export function deleteChecklist(id, onStatus){
  return deleteWithFallback(COLLECTION, id, onStatus);
}
