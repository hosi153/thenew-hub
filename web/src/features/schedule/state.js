/* Schedule-owned state. Keep mutable data behind one stable object so other
   features can read or update schedules without recreating module globals. */
export const scheduleState = {
  items: [],
  filter: '전체',
  showPast: false,
  view: 'calendar',
  editingId: null,
  viewingId: null,
  page: { lastDoc:null, hasMore:true, loading:false, error:null },
  fullyLoaded: false,
  fullLoading: false,
  calendarMonthCache: {},
  calendarByDate: {},
  calendarCursor: startOfMonth(new Date()),
  calendarSelectedDate: ymd(new Date()),
};

function startOfMonth(date){
  const result = new Date(date);
  result.setDate(1);
  return result;
}

export function ymd(date){
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}

export function replaceScheduleItems(items){
  scheduleState.items = items.slice();
}

export function appendUniqueScheduleItems(items){
  items.forEach(item=>{
    if(!scheduleState.items.some(existing=>existing.id===item.id)) scheduleState.items.push(item);
  });
}

export function resetScheduleCalendarCache(){
  scheduleState.calendarMonthCache = {};
}
