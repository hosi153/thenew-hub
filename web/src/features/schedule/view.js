import { createPasswordFields } from '../../security/password.js';
import { hideOverlay, showOverlay, verify } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';
import { debounce } from '../../ui/debounce.js';
import { withTimeout } from '../../data/firestore-rest.js';
import {
  createScheduleId,
  deleteSchedule,
  loadAllSchedules,
  loadScheduleMonth,
  loadSchedulePage,
  loadUndatedSchedules,
  saveSchedule,
  scheduleCollectionIsEmpty,
  seedSchedules,
} from './api.js';
import {
  appendUniqueScheduleItems,
  replaceScheduleItems,
  resetScheduleCalendarCache,
  scheduleState,
  ymd,
} from './state.js';

const PAGE_SIZE = 20;
const HALL_COLORS = { '제니스홀':'#3355FF', '더뉴홀':'#D98F2B', '르노브홀':'#C2447A' };

function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

function escapeAttr(value){
  return String(value ?? '').replace(/[&<>"']/g, ch=>({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]);
}

function nowIsoLocal(){
  const now = new Date();
  const p2 = n=>String(n).padStart(2,'0');
  return `${now.getFullYear()}-${p2(now.getMonth()+1)}-${p2(now.getDate())}T${p2(now.getHours())}:${p2(now.getMinutes())}`;
}

function hallColor(hall){ return HALL_COLORS[hall] || '#767B85'; }

function hallTag(hall){
  const color = hallColor(hall);
  return `<span class="hall-tag" style="background:${color}22; color:${color};"><i class="hall-tag-dot" style="background:${color}"></i>${escapeHtml(hall)}</span>`;
}

export async function initializeSchedules(seedItems){
  let usingSeedFallback = false;
  try{
    if(await scheduleCollectionIsEmpty()){
      try{ await seedSchedules(seedItems); }
      catch(error){ usingSeedFallback = true; console.error('hall seed write failed:', error); }
      replaceScheduleItems(seedItems);
      scheduleState.fullyLoaded = true;
      scheduleState.page.hasMore = false;
      scheduleState.page.error = null;
    }else{
      const [pageOk] = await Promise.all([loadMoreHalls(), loadUndatedHalls()]);
      if(!pageOk) throw new Error('hall-first-page-failed');
    }
  }catch(error){
    console.error('hall init failed, using seed data as fallback:', error);
    usingSeedFallback = true;
    replaceScheduleItems(seedItems);
    scheduleState.fullyLoaded = true;
    scheduleState.page.hasMore = false;
    scheduleState.page.error = null;
  }
  return { usingSeedFallback };
}

export function renderHallChips(){
  const halls = ['전체','제니스홀','더뉴홀','르노브홀'];
  const wrap = document.getElementById('hallChips');
  wrap.innerHTML = halls.map(hall=>{
    const dot = hall==='전체' ? '' : `<i class="hall-tag-dot" style="background:${hallColor(hall)}"></i>`;
    return `<button class="chip ${hall===scheduleState.filter?'active':''}" onclick="setHallFilter('${hall}')" style="display:inline-flex; align-items:center; gap:6px;">${dot}${hall}</button>`;
  }).join('');
}

export function setHallFilter(hall){
  scheduleState.filter = hall;
  renderHallChips();
  renderHalls();
}

export function setShowPast(value){
  scheduleState.showPast = value;
  renderHalls();
}

export async function loadMoreHalls(){
  const {page} = scheduleState;
  if(page.loading || page.error || !page.hasMore || scheduleState.fullyLoaded) return false;
  page.loading = true;
  renderHalls();
  try{
    const result = await loadSchedulePage({ after:page.lastDoc, limit:PAGE_SIZE, from:nowIsoLocal() });
    appendUniqueScheduleItems(result.items);
    page.lastDoc = result.lastDoc;
    page.hasMore = result.hasMore;
    page.error = null;
  }catch(error){
    console.error('loadMoreHalls failed:', error);
    page.error = '일정을 불러오지 못했습니다.';
    page.loading = false;
    renderHalls();
    return false;
  }
  page.loading = false;
  renderHalls();
  return true;
}

async function loadUndatedHalls(){
  try{
    appendUniqueScheduleItems(await loadUndatedSchedules());
    return true;
  }catch(error){
    console.error('loadUndatedHalls failed:', error);
    return false;
  }
}

async function ensureHallsFullyLoaded(){
  if(scheduleState.fullyLoaded || scheduleState.fullLoading) return;
  scheduleState.fullLoading = true;
  try{
    replaceScheduleItems(await loadAllSchedules());
    scheduleState.fullyLoaded = true;
    scheduleState.page.error = null;
  }catch(error){
    console.error('ensureHallsFullyLoaded failed:', error);
    scheduleState.page.error = '전체 일정을 불러오지 못했습니다.';
  }
  scheduleState.fullLoading = false;
  renderHalls();
  resetScheduleCalendarCache();
}

export function retryLoadHalls(){
  scheduleState.page.error = null;
  const needsFullData = document.getElementById('hallSearch').value.trim() || scheduleState.filter!=='전체' || scheduleState.showPast;
  if(needsFullData) ensureHallsFullyLoaded();
  else loadMoreHalls();
}

/* Whichever view (list or calendar) is actually on screen right now needs
   to be re-rendered after a save/delete — calling renderHalls() alone left
   the calendar showing stale data whenever it was the active view (it's the
   default view), which looked like "you have to refresh to see your save". */
function refreshHallView(){
  renderHalls();
  if(scheduleState.view==='calendar') renderCalendar();
}

export function renderHalls(){
  const query = document.getElementById('hallSearch').value.trim().toLowerCase();
  const needsFullData = !!query || scheduleState.filter!=='전체' || scheduleState.showPast;
  const {page} = scheduleState;

  if(needsFullData && !scheduleState.fullyLoaded){
    document.getElementById('hallList').innerHTML = page.error
      ? `<div class="empty">${escapeHtml(page.error)}<br><button type="button" class="btn btn-outline btn-sm" onclick="retryLoadHalls()">다시 시도</button></div>`
      : `<div class="loading">불러오는 중...</div>`;
    if(!page.error && !scheduleState.fullLoading) ensureHallsFullyLoaded();
    return;
  }

  let list = scheduleState.items.filter(item =>
    (scheduleState.filter==='전체' || item.hall===scheduleState.filter) &&
    (!query || item.code.toLowerCase().includes(query))
  );
  if(!scheduleState.showPast) list = list.filter(item=>!item.datetime || item.datetime>=nowIsoLocal());
  list = list.slice().sort((a,b)=>(a.datetime||'9999').localeCompare(b.datetime||'9999'));

  const element = document.getElementById('hallList');
  if(list.length===0){
    element.innerHTML = page.error
      ? `<div class="empty">${escapeHtml(page.error)}<br><button type="button" class="btn btn-outline btn-sm" onclick="retryLoadHalls()">다시 시도</button></div>`
      : page.loading ? `<div class="loading">불러오는 중...</div>`
      : `<div class="empty">조건에 맞는 일정이 없습니다.</div>`;
    return;
  }

  const rows = list.map(item=>{
    let dateLabel = '미정';
    if(item.datetime){
      const date = new Date(item.datetime);
      const days = ['일','월','화','수','목','금','토'];
      dateLabel = `${date.getMonth()+1}/${date.getDate()}(${days[date.getDay()]}) ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    }
    return `<tr class="rowitem" role="button" tabindex="0" data-action="hall-detail" data-id="${escapeAttr(item.id)}">
      <td><b>${escapeHtml(item.code)}</b></td><td>${hallTag(item.hall)}</td><td>${dateLabel}</td></tr>`;
  }).join('');

  const footer = page.error
    ? `<div class="empty">${escapeHtml(page.error)}<br><button type="button" class="btn btn-outline btn-sm" onclick="retryLoadHalls()">다시 시도</button></div>`
    : (!needsFullData && page.hasMore)
    ? `<div class="loading" id="hallLoadMoreSentinel">${page.loading ? '더 불러오는 중...' : ''}</div>` : '';
  const html = `<div class="table-wrap hall-table-wrap"><table class="list-table hall-list-table">
    <thead><tr><th>코드</th><th>홀</th><th>일정</th></tr></thead><tbody>${rows}</tbody>
  </table></div>${footer}`;
  element.innerHTML = html;
  renderHomeWeek();
}
/* Debounced so typing in the search box doesn't rebuild the whole list on
   every keystroke — only once input has paused for a moment. */
export const handleHallSearchInput = debounce(() => renderHalls(), 150);

export function setHallView(view){
  scheduleState.view = view;
  document.getElementById('viewToggleList').classList.toggle('active', view==='list');
  document.getElementById('viewToggleCal').classList.toggle('active', view==='calendar');
  document.getElementById('viewToggleList').setAttribute('aria-pressed', String(view==='list'));
  document.getElementById('viewToggleCal').setAttribute('aria-pressed', String(view==='calendar'));
  document.getElementById('hallListView').style.display = view==='list' ? '' : 'none';
  document.getElementById('hallCalendarView').style.display = view==='calendar' ? '' : 'none';
  if(view==='calendar') renderCalendar();
}

export function calShiftMonth(diff){
  scheduleState.calendarCursor.setMonth(scheduleState.calendarCursor.getMonth()+diff);
  scheduleState.calendarSelectedDate = null;
  renderCalendar();
}

async function getCalendarMonth(year, month){
  const key = `${year}-${month}`;
  if(scheduleState.calendarMonthCache[key]) return scheduleState.calendarMonthCache[key];
  const p2 = number=>String(number).padStart(2,'0');
  const start = `${year}-${p2(month+1)}-01T00:00`;
  const end = month===11 ? `${year+1}-01-01T00:00` : `${year}-${p2(month+2)}-01T00:00`;
  try{
    const items = await loadScheduleMonth(start, end);
    scheduleState.calendarMonthCache[key] = items;
    return items;
  }catch(error){
    console.error('Calendar month fallback also failed:', error);
    return [];
  }
}

export async function renderCalendar(){
  const cursor = scheduleState.calendarCursor;
  const year = cursor.getFullYear(), month = cursor.getMonth();
  document.getElementById('calTitle').textContent = `${year}년 ${month+1}월`;
  document.getElementById('calGrid').innerHTML = `<div class="loading" style="grid-column:1/-1;">불러오는 중...</div>`;
  document.getElementById('calDayList').innerHTML = '';

  const monthItems = await getCalendarMonth(year, month);
  if(cursor.getFullYear()!==year || cursor.getMonth()!==month) return;

  const byDate = {};
  monthItems.forEach(item=>{
    const key = item.datetime.slice(0,10);
    (byDate[key] = byDate[key] || []).push(item);
  });
  scheduleState.calendarByDate = byDate;

  const firstDow = new Date(year,month,1).getDay();
  const daysInMonth = new Date(year,month+1,0).getDate();
  const todayKey = ymd(new Date());
  let cells = ['일','월','화','수','목','금','토'].map(day=>`<div class="cal-dow">${day}</div>`).join('');
  for(let index=0; index<firstDow; index++) cells += `<div class="cal-cell empty"></div>`;
  for(let day=1; day<=daysInMonth; day++){
    const key = ymd(new Date(year,month,day));
    const items = (byDate[key]||[]).slice().sort((a,b)=>a.datetime.localeCompare(b.datetime));
    const dots = items.slice(0,4).map(item=>`<span class="cal-dot" style="background:${hallColor(item.hall)}"></span>`).join('');
    const classes = ['cal-cell', key===todayKey?'today':'', key===scheduleState.calendarSelectedDate?'selected':''].filter(Boolean).join(' ');
    cells += `<div class="${classes}" role="button" tabindex="0" data-action="calendar-date" data-date="${escapeAttr(key)}">${day}<div class="cal-dots">${dots}</div></div>`;
  }
  const grid = document.getElementById('calGrid');
  grid.innerHTML = cells;
  void grid.offsetHeight;
  if(scheduleState.calendarSelectedDate) renderCalDayList(scheduleState.calendarSelectedDate, byDate[scheduleState.calendarSelectedDate]||[]);
  else document.getElementById('calDayList').innerHTML = '';
}

export function calSelectDate(key){
  scheduleState.calendarSelectedDate = key;
  document.querySelectorAll('.cal-cell.selected').forEach(cell=>cell.classList.remove('selected'));
  document.querySelectorAll('.cal-cell').forEach(cell=>{
    if(cell.dataset.date===key) cell.classList.add('selected');
  });
  renderCalDayList(key, scheduleState.calendarByDate[key]||[]);
}

function renderCalDayList(key, items){
  const date = new Date(key+'T00:00');
  const days = ['일','월','화','수','목','금','토'];
  const label = `${date.getMonth()+1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
  const element = document.getElementById('calDayList');
  if(items.length===0){
    element.innerHTML = `<div class="cal-daylist-title">${label}</div><p class="muted">예정된 일정이 없어요.</p>`;
    return;
  }
  const rows = items.slice().sort((a,b)=>a.datetime.localeCompare(b.datetime)).map(item=>
    `<div class="cal-day-row" role="button" tabindex="0" data-action="hall-detail" data-id="${escapeAttr(item.id)}">
      <span class="time">${item.datetime.slice(11,16)}</span><span class="code">${escapeHtml(item.code)}</span>${hallTag(item.hall)}
    </div>`
  ).join('');
  element.innerHTML = `<div class="cal-daylist-title">${label}</div>${rows}`;
}

function getWeekRange(base){
  const date = new Date(base); date.setHours(0,0,0,0);
  const dayOfWeek = (date.getDay()+6)%7;
  const start = new Date(date); start.setDate(date.getDate()-dayOfWeek);
  const end = new Date(start); end.setDate(start.getDate()+6); end.setHours(23,59,59,999);
  return {start, end};
}

export function renderHomeWeek(){
  const card = document.getElementById('weekCard');
  const listElement = document.getElementById('weekList');
  if(!card || scheduleState.items.length===0){ if(card) card.style.display='none'; return; }
  const {start, end} = getWeekRange(new Date());
  const items = scheduleState.items.filter(item=>item.datetime)
    .filter(item=>{ const date = new Date(item.datetime); return date>=start && date<=end; })
    .sort((a,b)=>a.datetime.localeCompare(b.datetime));
  if(items.length===0){ card.style.display='none'; return; }
  card.style.display = '';
  const days = ['일','월','화','수','목','금','토'];
  listElement.innerHTML = items.map(item=>{
    const date = new Date(item.datetime);
    const label = `${date.getMonth()+1}/${date.getDate()}(${days[date.getDay()]}) ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    return `<div class="week-row"><span class="wd">${label}</span><span class="wc">${escapeHtml(item.code)}</span>${hallTag(item.hall)}</div>`;
  }).join('');
}

export function openHallDetail(id){
  scheduleState.viewingId = id;
  const item = scheduleState.items.find(candidate=>candidate.id===id);
  if(!item) return;
  document.getElementById('hd_code').textContent = item.code;
  document.getElementById('hd_hall').innerHTML = hallTag(item.hall);
  let dateLabel = '미정';
  if(item.datetime){
    const date = new Date(item.datetime);
    const days = ['일','월','화','수','목','금','토'];
    dateLabel = `${date.getFullYear()}.${date.getMonth()+1}.${date.getDate()} (${days[date.getDay()]}) ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
  }
  document.getElementById('hd_datetime').textContent = dateLabel;
  document.getElementById('hd_memo').textContent = item.memo || '-';
  showOverlay('hallDetailOverlay');
}

export function closeHallDetail(){ hideOverlay('hallDetailOverlay'); }

export async function requestEditHall(){
  const item = scheduleState.items.find(candidate=>candidate.id===scheduleState.viewingId);
  if(!item || !(await verify(item))) return;
  closeHallDetail();
  openHallModal(scheduleState.viewingId);
}

export async function requestDeleteHall(){
  const item = scheduleState.items.find(candidate=>candidate.id===scheduleState.viewingId);
  if(!item || !(await verify(item))) return;
  if(!confirm('정말 이 일정을 삭제하시겠어요?')) return;
  const targetId = scheduleState.viewingId;
  let result;
  try{ result = await withTimeout(deleteSchedule(targetId, status=>toast(status, 30000)), 12000); }
  catch(error){ result = {ok:false, error:error && error.message==='timeout' ? 'timeout' : String(error)}; }
  if(!result.ok){ toast('삭제 실패: ' + (result.error || '알 수 없는 오류'), 6000); return; }
  scheduleState.items = scheduleState.items.filter(candidate=>candidate.id!==targetId);
  resetScheduleCalendarCache();
  closeHallDetail();
  refreshHallView();
  toast('삭제되었습니다');
}

export function openHallModal(id){
  scheduleState.editingId = id || null;
  document.getElementById('hallForm').reset();
  document.getElementById('hallModalTitle').textContent = id ? '일정 수정' : '일정 등록';
  document.getElementById('h_pw_field').style.display = id ? 'none' : 'block';
  document.getElementById('h_password').required = !id;
  if(id){
    const item = scheduleState.items.find(candidate=>candidate.id===id);
    if(!item) return;
    document.getElementById('h_code').value = item.code;
    document.getElementById('h_hall').value = item.hall;
    document.getElementById('h_memo').value = item.memo || '';
    if(item.datetime){
      const [dateValue='', timeValue=''] = item.datetime.split('T');
      document.getElementById('h_date').value = dateValue;
      document.getElementById('h_time').value = timeValue.slice(0,5);
    }
  }
  showOverlay('hallOverlay');
}

export function closeHallModal(){ hideOverlay('hallOverlay'); }

document.getElementById('hallForm').addEventListener('submit', async event=>{
  event.preventDefault();
  const code = document.getElementById('h_code').value.trim();
  const hall = document.getElementById('h_hall').value;
  const memo = document.getElementById('h_memo').value.trim();
  const date = document.getElementById('h_date').value || '';
  const time = document.getElementById('h_time').value || '';
  const datetime = date && time ? `${date}T${time}` : '';
  const submitButton = document.querySelector('#hallForm button[type="submit"]');
  if(submitButton){ submitButton.disabled = true; submitButton.textContent = '저장 중...'; }

  let backup = null, newEntry = null, targetId;
  if(scheduleState.editingId){
    targetId = scheduleState.editingId;
    const index = scheduleState.items.findIndex(item=>item.id===targetId);
    backup = {...scheduleState.items[index]};
    scheduleState.items[index] = {...scheduleState.items[index], code, hall, datetime, memo};
  }else{
    if(submitButton) submitButton.textContent = '비밀번호 처리 중';
    const passwordFields = await createPasswordFields(document.getElementById('h_password').value);
    targetId = createScheduleId();
    newEntry = {id:targetId, code, hall, datetime, memo, ...passwordFields};
    scheduleState.items.push(newEntry);
  }

  const {id: _omit, ...dataToSave} = scheduleState.items.find(item=>item.id===targetId);
  let result;
  try{ result = await withTimeout(saveSchedule(targetId, dataToSave, status=>{ if(submitButton) submitButton.textContent = status; }), 12000); }
  catch(error){ result = {ok:false, error:error && error.message==='timeout' ? 'timeout' : String(error)}; }
  if(submitButton){ submitButton.disabled = false; submitButton.textContent = '저장'; }

  if(!result.ok){
    if(scheduleState.editingId){
      const index = scheduleState.items.findIndex(item=>item.id===targetId);
      if(index>-1) scheduleState.items[index] = backup;
    }else if(newEntry){
      scheduleState.items = scheduleState.items.filter(item=>item.id!==newEntry.id);
    }
    toast('저장 실패: ' + (result.error || '알 수 없는 오류'), 6000);
    return;
  }
  closeHallModal();
  resetScheduleCalendarCache();
  refreshHallView();
  toast('저장되었습니다');
});
