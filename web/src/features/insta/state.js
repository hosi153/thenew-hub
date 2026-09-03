/* Insta-share-owned state. Small, community-curated list — like the
   checklist feature, loaded in full (no pagination) and sorted newest-first
   on every render. */
export const instaState = {
  items: [],
  viewingId: null,
  editingId: null,
};

export function replaceInstaItems(items){
  instaState.items = items.slice();
}
