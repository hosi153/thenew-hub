/* Checklist-owned state. Small collection, no pagination needed — unlike
   schedule/codes it's loaded in full on init. */
export const checklistState = {
  items: [],
  viewingId: null,
  editingId: null,
};

export function replaceChecklistItems(items){
  checklistState.items = items.slice();
}
