export const matchingCodeState = {
  items: [],
  filter: '전체',
  editingId: null,
  viewingId: null,
  page: { lastDoc:null, hasMore:true, loading:false, error:null },
  fullyLoaded: false,
  fullLoading: false,
};

export function replaceMatchingCodes(items){
  matchingCodeState.items = items.slice();
}

export function appendUniqueMatchingCodes(items){
  items.forEach(item=>{
    if(!matchingCodeState.items.some(existing=>existing.id===item.id)) matchingCodeState.items.push(item);
  });
}
