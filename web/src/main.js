/* ============ THEME (light / dark) ============ */
(function(){
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = prefersDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', initial);
  syncThemeIcon(initial);
})();
function toggleTheme(){
  const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  syncThemeIcon(next);
}
function syncThemeIcon(theme){
  const sun = document.getElementById('themeIconSun');
  const moon = document.getElementById('themeIconMoon');
  if(!sun || !moon) return;
  sun.style.display = theme === 'dark' ? 'block' : 'none';
  moon.style.display = theme === 'dark' ? 'none' : 'block';
}

/* ============ FIREBASE ============ */
import { db } from './config/firebase.js';
import { matchingCodeState } from './features/codes/state.js';
import {
  closeCodeDetail,
  closeCodeModal,
  initializeMatchingCodes,
  loadMoreCodes,
  openCodeDetail,
  openCodeModal,
  renderCodeChips,
  renderCodes,
  requestDeleteCode,
  requestEditCode,
  retryLoadCodes,
  setCodeFilter,
} from './features/codes/view.js';
import { resetScheduleCalendarCache, scheduleState } from './features/schedule/state.js';
import {
  calSelectDate,
  calShiftMonth,
  closeHallDetail,
  closeHallModal,
  initializeSchedules,
  loadMoreHalls,
  openHallDetail,
  openHallModal,
  renderCalendar,
  renderHallChips,
  renderHalls,
  renderHomeWeek,
  requestDeleteHall,
  requestEditHall,
  retryLoadHalls,
  setHallFilter,
  setHallView,
  setShowPast,
} from './features/schedule/view.js';
document.querySelectorAll('a[target="_blank"]').forEach(link=>{ link.rel = 'noopener noreferrer'; });

/* Safety net: iOS Safari sometimes restores the page (from bfcache, app-switcher
   suspend/resume, etc.) without properly re-painting list content, leaving stale
   "불러오는 중..." placeholders even though data is already loaded in memory.
   Re-render (cheap, no network call) whenever the page becomes visible again. */
function forceRerenderIfReady(){
  if(scheduleState.items.length || matchingCodeState.items.length){
    try{
      renderHallChips(); renderCodeChips();
      const hallsPageActive = document.getElementById('page-halls').classList.contains('active');
      if(hallsPageActive && scheduleState.view==='calendar') renderCalendar();
      else renderHalls();
      renderCodes(); renderChecklistList();
    }catch(e){ console.error('forceRerenderIfReady failed:', e); }
  }
}
document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='visible') forceRerenderIfReady(); });
window.addEventListener('pageshow', forceRerenderIfReady);

/* ---------- Infinite scroll trigger ---------- */
let _scrollTicking = false;
window.addEventListener('scroll', ()=>{
  if(_scrollTicking) return;
  _scrollTicking = true;
  requestAnimationFrame(()=>{
    _scrollTicking = false;
    const nearBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 500);
    if(!nearBottom) return;
    const activePage = document.querySelector('.page.active');
    if(!activePage) return;
    if(activePage.id==='page-halls' && scheduleState.view==='list') loadMoreHalls();
    else if(activePage.id==='page-codes') loadMoreCodes();
  });
});
window.addEventListener('focus', forceRerenderIfReady);
setTimeout(()=>{
  const retryHtml = `<div class="empty">불러오는 데 시간이 오래 걸리고 있어요.<br><button type="button" class="btn btn-outline" style="margin-top:10px;" onclick="location.reload()">다시 시도</button></div>`;
  ['hallList','codeList','checklistList'].forEach(id=>{
    const el = document.getElementById(id);
    if(el && el.innerHTML.includes('불러오는 중')) el.innerHTML = retryHtml;
  });
}, 25000);


/* ============ SEED DATA (migrated from Notion) ============ */
const SEED_HALLS = [
["2608갭갭","제니스홀","2026-08-29T10:50",""],
["2608쑹","제니스홀","2026-08-29T16:10",""],
["260830태롱","제니스홀","2026-08-30T14:50",""],
["2609지구","제니스홀","2026-09-12T13:30",""],
["2609지현","제니스홀","2026-09-19T13:30",""],
["2609팡팡","제니스홀","2026-09-19T18:50",""],
["2610예시니","제니스홀","2026-10-03T14:50",""],
["2610천사","제니스홀","2026-10-04T10:50",""],
["2610슥","제니스홀","2026-10-04T14:50",""],
["2610ㅇr따i","제니스홀","2026-10-10T13:30",""],
["261017명요","제니스홀","2026-10-17T12:10",""],
["2610스티찌","제니스홀","2026-10-17T13:30","원본 표기 1:30 (오후로 가정)"],
["2610도화","제니스홀","2026-10-17T17:30",""],
["2610미니","제니스홀","2026-10-24T14:50",""],
["2610키티","제니스홀","2026-10-25T12:00","시간 미정 (점심)"],
["261031쏭이","제니스홀","2026-10-31T12:10",""],
["2611참치","제니스홀","2026-11-14T10:50",""],
["2611초코","제니스홀","2026-11-21T13:30",""],
["2611옐","제니스홀","2026-11-22T10:50",""],
["2612영영","제니스홀","2026-12-12T12:10",""],
["2701이랑","제니스홀","2027-01-16T13:30",""],
["2701쪼꼬","제니스홀","2027-01-23T12:10",""],
["2701밍귤","제니스홀","2027-01-30T12:10",""],
["2701물범","제니스홀","2027-01-30T17:30",""],
["2702또미","제니스홀","2027-02-27T10:50",""],
["2702구름","제니스홀","2027-02-27T16:10",""],
["2702챱츄","제니스홀","2027-02-27T18:50",""],
["2702왕밤빵","제니스홀","2027-02-28T10:50",""],
["2703베르데","제니스홀","2027-03-06T14:50",""],
["2703채니","제니스홀","2027-03-27T14:50",""],
["2704지엠","제니스홀","2027-04-10T12:10",""],
["2704해옹이","제니스홀","2027-04-10T14:50",""],
["2705밍밍","제니스홀","2027-05-23T10:50",""],
["2705쪼꼬","제니스홀","2027-05-23T13:30",""],
["2708랭이","제니스홀","2027-08-07T14:40",""],
["2710딩딩","제니스홀","2027-10-30T14:40",""],
["2609하제로","더뉴홀","2026-09-05T13:40",""],
["2610릴라","더뉴홀","2026-10-31T12:20",""],
["2611찐찐","더뉴홀","2026-11-15T13:40",""],
["2612진돌","더뉴홀","2026-12-06T15:00",""],
["2705슈꾸림붕어빵","더뉴홀","2027-05-29T11:00",""],
["2609불냉면","르노브홀","2026-09-19T12:30",""],
["2609전찡","르노브홀","2026-09-19T13:50",""],
["2610무무링","르노브홀","2026-10-17T12:00","시간 미정 (점심)"],
["2610해삐","르노브홀","2026-10-17T11:10",""],
["2610우왕","르노브홀","2026-10-31T11:10",""],
["2610졔스","르노브홀","2026-10-31T13:50",""],
["2611뚜징","르노브홀","2026-11-14T12:30",""],
["2611뀽뀽","르노브홀","","날짜/시간 미정"],
["2612뉴짜","르노브홀","2026-12-05T12:30",""],
["2612효콩","르노브홀","2026-12-05T15:10",""],
["2612무무","르노브홀","2026-12-05T16:30",""],
["2612얼음공주","르노브홀","2026-12-26T13:50",""],
["2701쨘쨘","르노브홀","2027-01-16T12:30",""],
["2701뚜뚜","르노브홀","2027-01-23T13:50",""],
["2701뽀랭이","르노브홀","2027-01-23T16:30",""],
["2701파랑","르노브홀","2027-01-24T11:10",""],
["2702뉴뉴","르노브홀","","날짜/시간 미정"],
["2702별.","르노브홀","2027-02-14T12:30",""],
["2702영구","르노브홀","2027-02-20T17:50",""],
["2702모찌","르노브홀","2027-02-27T17:50",""],
["2704크롱","르노브홀","","날짜/시간 미정"],
["2704조쩡","르노브홀","2027-04-04T12:30",""],
["2704당근","르노브홀","2027-04-25T11:10",""],
["2705늘늘","르노브홀","2027-05-15T11:10",""],
["2705짠뉴","르노브홀","2027-05-16T11:10",""],
["2706뉴택","르노브홀","","날짜/시간 미정"],
["2706가리링","르노브홀","2027-06-12T17:50",""],
["2707히히히","르노브홀","2027-07-17T15:00",""]
].map((r,i)=>({id:'seed_h_'+i, code:r[0], hall:r[1], datetime:r[2], memo:r[3]}));

const SEED_CODES = [
["모먼트무브","2703 하루","270306 박주영","스냅"],
["딜라이트메리지(축의대)","2608갭갭","2608291050","축의대"],
["르랑필름","2608갭갭","260829이정현","DVD"],
["르랑필름","쿨쿨","260919 백은선","DVD"],
["딥다운그린","2704크롱","270409김연희","스냅"],
["베넷스튜디오","2612 듀공","261205 김하림","스냅"],
["르랑필름","2705동글","20270523최예지","DVD"],
["스칼라랩(scalalab)","조쩡","20270404조정원","스냅"],
["하이라이트필름","2702 찜","유현진 9615","DVD"],
["르랑필름","전찡","260919 전혜진","DVD"],
["더플레이버스냅","조쩡","20261019조정원","스냅"],
["잉필름","2610졔스","261031임지혜","DVD"],
["코지레코드","2610 미니","261024이미연","DVD"],
["필름미뇽","2701 밍귤","270130 김민희","DVD"],
["베넷스튜디오","2612 듀공","261205 김하림","DVD"],
["하이라이트 필름","2611 초코","연이슬 3995","DVD"],
["스냅스타","조쩡","20270404조정원","DVD"],
["니어메리지(축의대)","2610뇨뇨","HYN10241220","축의대"],
["르사브웨딩","2610 밈밈","261031 김성민","스냅"],
["미엘라메멘토","2701이랑","270116김아린","스냅"],
["베라모멘토","2610 미니","261024이미연","스냅"],
["메리쥬빌레(축의대)","2611뀽뀽","PHL261108","축의대"],
["하이라이트","2611 참치","이정원<0486>","DVD"],
["르랑필름","2701이랑","270116김아린","DVD"],
["김세웅포토그라피","2701 밍귤","270130 김민희","스냅"],
["모먼트무브","2703 하루","270306 박주영","DVD"],
["아키스냅","2608갭갭","260829ㅇㅈㅎ","스냅"],
["르랑필름","가리링","270612김가현","DVD"],
["르랑필름","2610 밈밈","261031 김성민","DVD"],
["테레즈필름","2609지구","20260912 최지수","DVD"],
["모먼트무브","쪼꼬","270523 정현아","DVD"],
["서사포토그라피","2610 도화","도화(261017)","스냅"],
["모먼트무브","쪼꼬","270523 정현아","스냅"],
["필름나무","26.12/핫걸","261212김은지","DVD"],
["공방301","끼띠","10945","예물"],
["코지레코드","2605 만두","260531 김민형","DVD"],
["지아필름","260830 태롱","260830 김태연","스냅"],
["우리옷 진솔한복","2605 만두","김민형0531","한복"],
["백작바이피렌체","조쩡","조정원8632","예물"],
["미엘라메멘토","2702 또미","270227 이아름","스냅"],
["르랑필름","2702 또미","270227 이아름","DVD"],
["종로 제이버튼주얼리","2610 무무링","김유진 8085","예물"],
["니어메리지","조쩡","JJW2704041230","축의대"],
["베라모멘토","가리링","270612김가현","스냅"],
["메이븐스냅(아이폰스냅)","2701 밍귤","270130김민희/1명만 가능","스냅"],
["메리쥬빌레","2612 무무","CSM261205","축의대"],
["스냅스타","2612 무무","261205 추샘물","스냅"],
["스냅스타","2612 무무","261205 추샘물","DVD"],
["베라모멘토","2706꾸루","270619배홍영","DVD"],
["서사포토그라피","2706꾸루","배홍영270619","스냅"],
["스냅온아","2704 토끼","270424 허명진","DVD"],
["메리쥬빌레","2701 이랑","KAL270116","축의대"],
["제이엔필름","2611 니니즈","20261121 안초롱","DVD"],
["르랑필름","2704 해옹이","270410 천혜원","DVD"],
["르랑필름","2701 파랑 / 르노브홀","270124 이예슬","DVD"],
["르랑필름","2701 냐옹 / 더뉴홀","270116 박세연","DVD"],
["미엘라메멘토","2701 파랑 / 르노브홀","270124 이예슬","스냅"],
["그라피모먼","밀크티","270213 최소라","스냅"],
["모먼트 무브","밀크티","270213 최소라","DVD"],
["르랑필름","2609 불냉면 /르노브홀","260919 김서영","DVD"],
["딜라이트메리지","오픈카톡 문의","2705231050","축의대"],
["르랑필름","2612 젤킬지/ 더뉴홀","261206 강은지","DVD"],
["화이트포레","2704 아주/제니스홀","270411레나","스냅"],
["드뉴웨딩(스냅스타)","모모","270926 남송미","DVD"],
["무제","2710 딩딩/제니스홀","권민영271030 9475","DVD"],
["김세웅포토그라피","2707 히히히","270717 박세현","스냅"],
["메리쥬빌레","모모","NSM270926","축의대"],
["드뉴웨딩","2708 찐빵","270828 백진아","DVD"],
["메리메이트","2705/뽀또신부/더뉴홀","2705151220","축의대"],
["모먼트무브","2705/뽀또신부/더뉴홀","270515 함준호","DVD"],
["엘로디스냅(아이폰스냅)","딩딩","271030 권민영","스냅"],
["탐클로이","2708 찐빵 / 제니스홀","270828 백진아","스냅"],
["레코드디데이","솔츄","260905 양솔아","스냅"]
].map((r,i)=>({id:'seed_c_'+i, vendor:r[0], sharer:r[1], code:r[2], category:r[3]}));

/* ============ STATE ============ */
let checklists = [];
let isUsingSeedFallback = false;

/* ---------- Pagination state (infinite scroll for halls/codes) ---------- */
let viewingChecklistId = null;
let editingChecklistId = null;

/* ============ WEDDING PREP CHECKLIST TEMPLATE ============ */
const CHECKLIST_TEMPLATE = [
  { section:'🏛️ 예식장 기본', items:[
    { key:'hall', label:'웨딩홀', emoji:'🏛️', def:'발산 더뉴컨벤션' },
    { key:'planner', label:'플래너', emoji:'👩\u200d💼' },
    { key:'band', label:'웨딩밴드', emoji:'💍' },
  ]},
  { section:'📸 웨딩촬영 (스튜디오)', items:[
    { key:'shootDress', label:'촬영 드레스', emoji:'👰🏻\u200d♀️', def:'안함' },
    { key:'shootMakeup', label:'촬영헤어메이크업', emoji:'💄', def:'안함' },
    { key:'shootSuit', label:'촬영 정장', emoji:'🤵🏻', def:'안함' },
    { key:'shootBouquet', label:'촬영부케', emoji:'💐', def:'안함' },
    { key:'shootHairChange', label:'헤어변형', emoji:'' },
  ]},
  { section:'💒 본식 (예식 당일)', items:[
    { key:'dress', label:'드레스', emoji:'👰🏻\u200d♀️' },
    { key:'makeup', label:'헤어메이크업', emoji:'💄' },
    { key:'suit', label:'예복', emoji:'🤵🏻' },
    { key:'bouquet', label:'본식 부케', emoji:'💐', def:'홀 연계' },
    { key:'mc', label:'사회자', emoji:'🎤', def:'홀 연계' },
    { key:'snap', label:'본식 스냅', emoji:'📷' },
    { key:'dvd', label:'본식 DVD(영상)', emoji:'🎥' },
    { key:'iphoneSnap', label:'아이폰스냅', emoji:'📱' },
    { key:'preVideo', label:'식전 영상', emoji:'🎞️' },
  ]},
  { section:'👗 본식 2부', items:[
    { key:'part2Outfit', label:'2부 의상(드레스/한복/별도)', emoji:'👗' },
    { key:'part2Hair', label:'2부 헤어변형', emoji:'💄' },
  ]},
  { section:'💌 청첩장', items:[
    { key:'invite', label:'청첩장', emoji:'❤️' },
    { key:'mobileInvite', label:'모바일 청첩장', emoji:'📧' },
  ]},
  { section:'👨\u200d👩\u200d👧 혼주', items:[
    { key:'parentMakeup', label:'혼주메이크업', emoji:'💄', def:'더뉴컨벤션 뷰티샵' },
    { key:'parentHanbok', label:'혼주한복', emoji:'👘' },
    { key:'parentSuit', label:'혼주정장', emoji:'👔' },
  ]},
  { section:'✈️ 신혼여행', items:[
    { key:'honeymoon', label:'신혼여행', emoji:'✈️' },
  ]},
];
function ckFlatItems(){ return CHECKLIST_TEMPLATE.flatMap(s=>s.items); }
/* ============ HASH HELPER ============ */
import { writeWithFallback, deleteWithFallback, mergeWithFallback, readWithFallback, withTimeout } from './data/firestore-rest.js';

import { createPasswordFields } from './security/password.js';

/* ============ GENERIC PASSWORD PROMPT (Promise-based) ============ */
import { showOverlay, hideOverlay, cancelPwPrompt, submitPwPrompt, verify } from './ui/modal.js';

/* ============ CHAT-MANAGED PATCHES ============
   When the person asks Claude in chat to add/edit/delete data, Claude adds an
   entry here (with a unique, never-reused id) and re-delivers this file.
   The next time ANYONE opens the app, unapplied patches run automatically
   and are recorded so they never re-run. No in-app admin login needed. */
const ADMIN_PATCHES = [
  // { id:'p1', type:'delete', target:'hall', matchId:'h_3' },
  // { id:'p2', type:'edit',   target:'code', matchId:'seed_c_10', changes:{ code:'새코드' } },
  // { id:'p3', type:'add',    target:'hall', item:{ code:'2611새신랑', hall:'더뉴홀', datetime:'2026-11-01T13:00', memo:'' } },
  { id:'p4', type:'edit', target:'hall', matchId:'seed_h_19', changes:{ code:'2612영영' } },
  { id:'p5', type:'delete', target:'hall', matchId:'seed_h_48' },
];

async function applyPatches(){
  let applied = [];
  const newlyApplied = [];
  try{
    const rec = await db.collection('meta').doc('appliedPatches').get();
    applied = rec.exists ? (rec.data().ids || []) : [];
  }catch(e){ applied = []; }

  const pending = ADMIN_PATCHES.filter(p => !applied.includes(p.id));
  if(pending.length===0) return;

  for(const p of pending){
    const list = p.target==='hall' ? scheduleState.items : matchingCodeState.items;
    const collection = p.target==='hall' ? 'hallSchedule' : 'matchingCodes';
    try{
      let result;
      if(p.type==='delete'){
        result = await deleteWithFallback(collection, p.matchId);
        if(!result.ok) throw new Error(result.error || 'patch-delete-failed');
        const idx = list.findIndex(x=>x.id===p.matchId);
        if(idx>-1) list.splice(idx,1);
      }else if(p.type==='edit'){
        // Partial merge — works correctly even if this document isn't part of
        // the currently-loaded page (pagination may not have fetched it yet).
        result = await mergeWithFallback(collection, p.matchId, p.changes);
        if(!result.ok) throw new Error(result.error || 'patch-edit-failed');
        const idx = list.findIndex(x=>x.id===p.matchId);
        if(idx>-1) Object.assign(list[idx], p.changes);
      }else if(p.type==='add'){
        const newId = (p.target==='hall'?'h_':'c_')+'patch_'+p.id;
        result = await writeWithFallback(collection, newId, p.item);
        if(!result.ok) throw new Error(result.error || 'patch-add-failed');
        if(!list.some(x=>x.id===newId)) list.push({ id:newId, ...p.item });
      }
      applied.push(p.id);
      newlyApplied.push(p.id);
    }catch(e){ console.error('patch apply failed for', p.id, e); }
  }
  resetScheduleCalendarCache();
  if(newlyApplied.length){
    try{
      await db.collection('meta').doc('appliedPatches').set({
        ids: firebase.firestore.FieldValue.arrayUnion(...newlyApplied)
      }, {merge:true});
    }catch(e){ console.error('patch status write failed:', e); }
  }
}

/* ============ INIT ============ */
async function init(){
  // Defensive reset up front: some mobile browsers restore a previously-typed
  // search value on reload, which would incorrectly trigger a full-data load
  // (or silently filter the list down to nothing) before we even start fetching.
  const hs0 = document.getElementById('hallSearch'); if(hs0) hs0.value = '';
  const cs0 = document.getElementById('codeSearch'); if(cs0) cs0.value = '';

  const [scheduleInitResult, codesInitResult, checklistsResult] = await Promise.all([
    // ---- Halls: seed if empty, otherwise load page 1 (upcoming) + undated items ----
    initializeSchedules(SEED_HALLS),
    // ---- Codes: seed if empty, otherwise load page 1 ----
    initializeMatchingCodes(SEED_CODES),
    // ---- Checklist: small collection, simple one-time load (no pagination needed) ----
    (async ()=>{
      try{ return await readWithFallback('prepChecklist'); }
      catch(e){ console.error('prepChecklist read failed entirely:', e); return []; }
    })(),
  ]);
  if(scheduleInitResult.usingSeedFallback) isUsingSeedFallback = true;
  if(codesInitResult.usingSeedFallback) isUsingSeedFallback = true;
  checklists = checklistsResult;

  try{ await applyPatches(); }catch(e){ console.error('applyPatches failed:', e); }

  try{
    renderHallChips();
    renderCodeChips();
    renderHalls();
    renderCodes();
    renderChecklistList();
    if(document.getElementById('page-halls').classList.contains('active') && scheduleState.view==='calendar') renderCalendar();
    if(isUsingSeedFallback) toast('실시간 데이터 연결에 실패해 기본 데이터를 표시하고 있어요.', 6000);
  }catch(e){
    console.error('render failed:', e);
    const retryHtml = `<div class="empty">불러오는 중 문제가 생겼어요.<br><button type="button" class="btn btn-outline" style="margin-top:10px;" onclick="location.reload()">다시 시도</button></div>`;
    ['hallList','codeList','checklistList'].forEach(id=>{
      const el = document.getElementById(id);
      if(el && el.innerHTML.includes('불러오는 중')) el.innerHTML = retryHtml;
    });
  }
}


import { toast } from './ui/toast.js';

/* ============ NAV ============ */
function go(page){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+page).classList.add('active');
  document.querySelectorAll('nav.bottom button').forEach(b=>{
    b.classList.remove('active');
    b.removeAttribute('aria-current');
  });
  const navBtn = document.querySelector(`nav.bottom button[data-page="${page}"]`);
  if(navBtn){ navBtn.classList.add('active'); navBtn.setAttribute('aria-current','page'); }
  document.getElementById('fab').style.display = (page==='halls'||page==='codes') ? 'flex' : 'none';
  window.scrollTo(0,0);
  if(history.replaceState) history.replaceState(null, '', '#'+page);

  // iOS Safari sometimes fails to paint list content that was set via innerHTML
  // while its container was hidden (display:none). Re-rendering at the exact
  // moment the tab becomes visible (like the calendar view already does)
  // guarantees a fresh paint instead of relying on a stale one.
  if(scheduleState.items.length || matchingCodeState.items.length){
    if(page==='home') renderHomeWeek();
    else if(page==='halls') (scheduleState.view==='calendar' ? renderCalendar() : renderHalls());
    else if(page==='codes') renderCodes();
  }
}
document.getElementById('fab').style.display='none';

/* ============ DEEP LINK ROUTING (for Kakao chatbot commands) ============
   Opening the shared link with a #hash jumps straight to that tab, and
   optionally a sub-target after a slash:
   #home  #halls  #codes  #partners  #more
   #more/hallinfo  #more/terms  #more/bouquet  #more/parking             */
(function(){
  const valid = ['home','halls','codes','partners','more'];
  const raw = (location.hash || '').replace('#','');
  const [page, sub] = raw.split('/');
  if(!valid.includes(page)) return;
  go(page);
  if(!sub) return;
  if(page==='more' && ['hallinfo','terms','bouquet','parking'].includes(sub)){
    setTimeout(()=>openSub(sub), 0);
  }
})();

function openPartner(name){
  document.getElementById('partners-menu').style.display='none';
  document.querySelectorAll('#page-partners .subpage').forEach(s=>s.classList.remove('active'));
  document.getElementById('partner-'+name).classList.add('active');
}
function closePartner(){
  document.getElementById('partners-menu').style.display='block';
  document.querySelectorAll('#page-partners .subpage').forEach(s=>s.classList.remove('active'));
}

function openSub(name){
  document.getElementById('more-menu').style.display='none';
  document.querySelectorAll('.subpage').forEach(s=>s.classList.remove('active'));
  document.getElementById('sub-'+name).classList.add('active');
}
function closeSub(){
  document.getElementById('more-menu').style.display='block';
  document.querySelectorAll('.subpage').forEach(s=>s.classList.remove('active'));
}

function openAddModal(){
  const activePage = document.querySelector('.page.active').id;
  if(activePage==='page-halls') openHallModal();
  else if(activePage==='page-codes') openCodeModal();
}

/* ============ WEDDING PREP CHECKLIST ============ */
async function saveChecklistSingle(id, data, onStatus){ return writeWithFallback('prepChecklist', id, data, onStatus); }
async function deleteChecklistSingle(id, onStatus){ return deleteWithFallback('prepChecklist', id, onStatus); }

/* ---- build the input rows once (static template) ---- */
function buildChecklistFormTable(){
  const el = document.getElementById('checklistFormTable');
  let html = '';
  CHECKLIST_TEMPLATE.forEach(sec=>{
    html += `<div class="ck-section-h">${sec.section}</div>`;
    sec.items.forEach(it=>{
      html += `
      <div class="ck-row">
        <label for="ck_item_${escapeAttr(it.key)}">${it.emoji?it.emoji+' ':''}${escapeHtml(it.label)}</label>
        <div class="ck-input-row">
          <input type="text" id="ck_item_${it.key}" maxlength="200" placeholder="입력...">
          <button type="button" class="ck-skip-btn" id="ck_skip_${it.key}" onclick="ckToggleSkip('${it.key}')">안함</button>
        </div>
      </div>`;
    });
  });
  el.innerHTML = html;
}
buildChecklistFormTable();

function ckToggleSkip(key){
  const input = document.getElementById('ck_item_'+key);
  const btn = document.getElementById('ck_skip_'+key);
  if(input.value.trim()==='안함'){ input.value=''; btn.classList.remove('on'); }
  else{ input.value='안함'; btn.classList.add('on'); }
}

function ckResetForm(){
  ckFlatItems().forEach(it=>{
    const input = document.getElementById('ck_item_'+it.key);
    input.value = it.def || '';
    document.getElementById('ck_skip_'+it.key).classList.toggle('on', input.value==='안함');
  });
}

function showCkPwField(show){
  document.getElementById('ck_pw_field').style.display = show ? 'block' : 'none';
  document.getElementById('ck_password').required = show;
}

function openChecklistEntry(){
  editingChecklistId = null;
  document.getElementById('checklistFormTitle').textContent = '체크리스트 작성';
  document.getElementById('checklistForm').reset();
  document.getElementById('ck_ownerId').removeAttribute('readonly');
  document.getElementById('ck_public').checked = false;
  ckResetForm();
  showCkPwField(true);
  showOverlay('checklistFormOverlay');
}
function closeChecklistFormModal(){ hideOverlay('checklistFormOverlay'); }

async function loadMyChecklist(){
  const oid = document.getElementById('ck_ownerId').value.trim();
  if(!oid){ toast('아이디를 입력해주세요'); return; }
  const existing = checklists.find(c=>c.ownerId===oid);
  if(!existing){ toast('아직 없는 아이디예요. 새로 작성해주세요'); editingChecklistId=null; showCkPwField(true); return; }
  const ok = await verify(existing);
  if(!ok) return;
  editingChecklistId = existing.id;
  document.getElementById('checklistFormTitle').textContent = '체크리스트 수정';
  ckFlatItems().forEach(it=>{
    const input = document.getElementById('ck_item_'+it.key);
    const v = (existing.items && existing.items[it.key]) || '';
    input.value = v;
    document.getElementById('ck_skip_'+it.key).classList.toggle('on', v==='안함');
  });
  document.getElementById('ck_public').checked = !!existing.isPublic;
  showCkPwField(false);
  toast('불러왔습니다. 수정 후 저장하세요');
}

document.getElementById('checklistForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const ownerId = document.getElementById('ck_ownerId').value.trim();
  if(!ownerId){ toast('아이디를 입력해주세요'); return; }
  if(!editingChecklistId && checklists.some(c=>c.ownerId===ownerId)){
    toast('이미 사용 중인 아이디예요. 불러오기로 수정해주세요');
    return;
  }
  const items = {};
  ckFlatItems().forEach(it=>{ items[it.key] = document.getElementById('ck_item_'+it.key).value.trim(); });
  const isPublic = document.getElementById('ck_public').checked;

  const submitBtn = document.querySelector('#checklistForm button[type="submit"]');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = '저장 중...'; }

  let backup = null, newEntry = null, targetId;
  if(editingChecklistId){
    targetId = editingChecklistId;
    const idx = checklists.findIndex(x=>x.id===editingChecklistId);
    backup = {...checklists[idx]};
    checklists[idx] = {...checklists[idx], ownerId, items, isPublic};
  }else{
    const pw = document.getElementById('ck_password').value;
    if(!pw){
      toast('비밀번호를 입력해주세요');
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = '저장'; }
      return;
    }
    if(submitBtn) submitBtn.textContent = '비밀번호 처리 중';
    const passwordFields = await createPasswordFields(pw);
    targetId = db.collection('prepChecklist').doc().id;
    newEntry = {id:targetId, ownerId, items, isPublic, ...passwordFields};
    checklists.push(newEntry);
  }

  const { id: _omit, ...dataToSave } = checklists.find(x=>x.id===targetId);
  let result;
  try{ result = await withTimeout(saveChecklistSingle(targetId, dataToSave, s=>{ if(submitBtn) submitBtn.textContent = s; }), 12000); }
  catch(e){ result = {ok:false, error: e && e.message==='timeout' ? 'timeout' : String(e)}; }

  if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = '저장'; }

  if(!result.ok){
    // roll back the optimistic local change so the UI doesn't show a phantom "saved" entry
    if(editingChecklistId){
      const idx = checklists.findIndex(x=>x.id===editingChecklistId);
      if(idx>-1) checklists[idx] = backup;
    }else if(newEntry){
      checklists = checklists.filter(x=>x.id!==newEntry.id);
    }
    toast('저장 실패: ' + (result.error || '알 수 없는 오류'), 6000);
    return; // keep the modal open so nothing typed is lost
  }

  closeChecklistFormModal();
  renderChecklistList();
  toast('저장되었습니다');
});

function renderChecklistList(){
  const el = document.getElementById('checklistList');
  if(!el) return;
  if(!checklists || checklists.length===0){
    el.innerHTML = `<div class="empty">아직 작성된 체크리스트가 없어요. 첫 번째로 작성해보세요!</div>`;
    return;
  }
  const rows = checklists.map(c=>{
    const badge = c.isPublic
      ? `<span class="hall-tag" style="background:var(--accent-tint); color:var(--accent-deep);"><i class="hall-tag-dot" style="background:var(--accent-deep)"></i>공개</span>`
      : `<span class="hall-tag" style="background:var(--neutral-tint); color:var(--ink-soft);"><i class="hall-tag-dot" style="background:var(--ink-faint)"></i>비공개</span>`;
    return `<tr class="rowitem" role="button" tabindex="0" data-action="checklist-detail" data-id="${escapeAttr(c.id)}"><td><b>${escapeHtml(c.ownerId)}</b></td><td>${badge}</td></tr>`;
  }).join('');
  el.innerHTML = `<div class="table-wrap"><table class="list-table">
    <thead><tr><th>아이디</th><th>공개여부</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

async function openChecklistDetail(id){
  const item = checklists.find(x=>x.id===id);
  if(!item) return;
  if(!item.isPublic){
    const ok = await verify(item);
    if(!ok) return;
  }
  renderChecklistDetail(item);
}

function renderChecklistDetail(item){
  viewingChecklistId = item.id;
  document.getElementById('ckd_owner').textContent = item.ownerId;
  document.getElementById('ckd_badge').innerHTML = item.isPublic
    ? `<span class="hall-tag" style="background:var(--accent-tint); color:var(--accent-deep);">공개</span>`
    : `<span class="hall-tag" style="background:var(--neutral-tint); color:var(--ink-soft);">비공개</span>`;
  let rows = '';
  CHECKLIST_TEMPLATE.forEach(sec=>{
    rows += `<tr><td colspan="2" style="font-weight:800; color:var(--accent-deep); padding-top:14px; border-top:none;">${sec.section}</td></tr>`;
    sec.items.forEach(it=>{
      const v = (item.items && item.items[it.key]) || '-';
      rows += `<tr><td>${it.emoji?it.emoji+' ':''}${escapeHtml(it.label)}</td><td>${escapeHtml(v)}</td></tr>`;
    });
  });
  document.getElementById('checklistDetailTable').innerHTML = rows;
  showOverlay('checklistDetailOverlay');
}
function closeChecklistDetail(){ hideOverlay('checklistDetailOverlay'); }

function checklistText(item){
  const lines = [];
  ckFlatItems().forEach(it=>{
    const v = (item.items && item.items[it.key]) || '';
    lines.push(`${it.emoji?it.emoji+' ':''}${it.label} : ${v}`);
  });
  return lines.join('\n');
}

async function copyChecklist(){
  const item = checklists.find(x=>x.id===viewingChecklistId);
  if(!item) return;
  const text = checklistText(item);
  try{
    await navigator.clipboard.writeText(text);
  }catch(e){
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); }catch(e2){}
    document.body.removeChild(ta);
  }
  toast('복사되었습니다');
}

async function requestEditChecklist(){
  const item = checklists.find(x=>x.id===viewingChecklistId);
  const ok = await verify(item);
  if(!ok) return;
  closeChecklistDetail();
  editingChecklistId = item.id;
  document.getElementById('checklistFormTitle').textContent = '체크리스트 수정';
  document.getElementById('ck_ownerId').value = item.ownerId;
  ckFlatItems().forEach(it=>{
    const input = document.getElementById('ck_item_'+it.key);
    const v = (item.items && item.items[it.key]) || '';
    input.value = v;
    document.getElementById('ck_skip_'+it.key).classList.toggle('on', v==='안함');
  });
  document.getElementById('ck_public').checked = !!item.isPublic;
  showCkPwField(false);
  showOverlay('checklistFormOverlay');
}

async function requestDeleteChecklist(){
  const item = checklists.find(x=>x.id===viewingChecklistId);
  const ok = await verify(item);
  if(!ok) return;
  if(!confirm('정말 삭제하시겠어요?')) return;
  const targetId = viewingChecklistId;
  let result;
  try{ result = await withTimeout(deleteChecklistSingle(targetId, s=>toast(s, 30000)), 12000); }
  catch(e){ result = {ok:false, error: e && e.message==='timeout' ? 'timeout' : String(e)}; }
  if(!result.ok){ toast('삭제 실패: ' + (result.error || '알 수 없는 오류'), 6000); return; }
  checklists = checklists.filter(x=>x.id!==targetId);
  closeChecklistDetail();
  renderChecklistList();
  toast('삭제되었습니다');
}

function escapeHtml(str){
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}
function escapeAttr(value){
  return String(value ?? '').replace(/[&<>"']/g, ch=>({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[ch]);
}

function runDataAction(target){
  const action = target.dataset.action;
  if(action==='hall-detail') openHallDetail(target.dataset.id);
  else if(action==='code-detail') openCodeDetail(target.dataset.id);
  else if(action==='checklist-detail') openChecklistDetail(target.dataset.id);
  else if(action==='calendar-date') calSelectDate(target.dataset.date);
  else if(action==='partner') openPartner(target.dataset.partner);
  else if(action==='subpage') openSub(target.dataset.subpage);
}
document.addEventListener('click', e=>{
  const target = e.target.closest('[data-action]');
  if(target) runDataAction(target);
});
document.addEventListener('keydown', e=>{
  if(e.key!=='Enter' && e.key!==' ') return;
  const target = e.target.closest('[data-action]');
  if(!target) return;
  e.preventDefault();
  runDataAction(target);
});

/* ============ CLICK OUTSIDE TO CLOSE ============ */
document.querySelectorAll('.overlay').forEach(ov=>{
  ov.addEventListener('click', (e)=>{
    if(e.target !== ov) return; // only when the backdrop itself was clicked, not the modal content
    if(ov.id==='hallOverlay') closeHallModal();
    else if(ov.id==='codeOverlay') closeCodeModal();
    else if(ov.id==='hallDetailOverlay') closeHallDetail();
    else if(ov.id==='codeDetailOverlay') closeCodeDetail();
    else if(ov.id==='pwOverlay') cancelPwPrompt();
    else if(ov.id==='checklistDetailOverlay') closeChecklistDetail();
    else if(ov.id==='checklistFormOverlay') closeChecklistFormModal();
  });
});
function closeOverlayFromKeyboard(overlay){
  if(overlay.id==='pwOverlay') cancelPwPrompt();
  else if(overlay.id==='hallOverlay') closeHallModal();
  else if(overlay.id==='codeOverlay') closeCodeModal();
  else if(overlay.id==='hallDetailOverlay') closeHallDetail();
  else if(overlay.id==='codeDetailOverlay') closeCodeDetail();
  else if(overlay.id==='checklistDetailOverlay') closeChecklistDetail();
  else if(overlay.id==='checklistFormOverlay') closeChecklistFormModal();
}
document.addEventListener('keydown', e=>{
  const pwOverlay = document.getElementById('pwOverlay');
  const overlays = Array.from(document.querySelectorAll('.overlay.show'));
  const overlay = pwOverlay.classList.contains('show') ? pwOverlay : overlays[overlays.length-1];
  if(!overlay) return;
  if(e.key==='Escape'){
    e.preventDefault();
    closeOverlayFromKeyboard(overlay);
    return;
  }
  if(e.key!=='Tab') return;
  const focusable = Array.from(overlay.querySelectorAll('button, input, select, textarea, [tabindex]:not([tabindex="-1"])'))
    .filter(el=>!el.disabled && el.getClientRects().length>0);
  if(!focusable.length) return;
  const first = focusable[0], last = focusable[focusable.length-1];
  if(e.shiftKey && document.activeElement===first){ e.preventDefault(); last.focus(); }
  else if(!e.shiftKey && document.activeElement===last){ e.preventDefault(); first.focus(); }
});

/* ============ SCROLL-REACTIVE GLASS NAV / HEADER ============ */
(function(){
  const header = document.querySelector('header.top');
  const navEl = document.querySelector('nav.bottom');
  const fab = document.getElementById('fab');
  let lastY = window.scrollY;
  let ticking = false;
  let idleTimer = null;

  function expand(){
    navEl.classList.remove('nav-compact');
    fab.classList.remove('nav-compact-shift');
  }
  function compact(){
    navEl.classList.add('nav-compact');
    fab.classList.add('nav-compact-shift');
  }

  function onScroll(){
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 24);

    if(y < 40){
      expand();
    } else if(y > lastY + 4){
      compact();          // scrolling down -> shrink to a compact pill
    } else if(y < lastY - 4){
      expand();            // scrolling up -> restore full bar
    }
    lastY = y;

    clearTimeout(idleTimer);
    idleTimer = setTimeout(expand, 900); // settle back to full size when scrolling stops
    ticking = false;
  }

  window.addEventListener('scroll', ()=>{
    if(!ticking){ requestAnimationFrame(onScroll); ticking = true; }
  }, {passive:true});
})();

/* ---- Stage 2 (Vite build): expose functions referenced by inline HTML ---- */
/* on* attribute handlers (onclick="go(...)" etc) so existing markup keeps working unchanged. */
window.calShiftMonth = calShiftMonth;
window.cancelPwPrompt = cancelPwPrompt;
window.ckToggleSkip = ckToggleSkip;
window.closeChecklistDetail = closeChecklistDetail;
window.closeChecklistFormModal = closeChecklistFormModal;
window.closeCodeDetail = closeCodeDetail;
window.closeCodeModal = closeCodeModal;
window.closeHallDetail = closeHallDetail;
window.closeHallModal = closeHallModal;
window.closePartner = closePartner;
window.closeSub = closeSub;
window.copyChecklist = copyChecklist;
window.go = go;
window.loadMyChecklist = loadMyChecklist;
window.openAddModal = openAddModal;
window.openChecklistEntry = openChecklistEntry;
window.renderCodes = renderCodes;
window.renderHalls = renderHalls;
window.requestDeleteChecklist = requestDeleteChecklist;
window.requestDeleteCode = requestDeleteCode;
window.requestDeleteHall = requestDeleteHall;
window.requestEditChecklist = requestEditChecklist;
window.requestEditCode = requestEditCode;
window.requestEditHall = requestEditHall;
window.retryLoadCodes = retryLoadCodes;
window.retryLoadHalls = retryLoadHalls;
window.setCodeFilter = setCodeFilter;
window.setHallFilter = setHallFilter;
window.setHallView = setHallView;
window.setShowPast = setShowPast;
window.submitPwPrompt = submitPwPrompt;
window.toggleTheme = toggleTheme;

// Start only after this module has initialized every feature binding and state.
init();
