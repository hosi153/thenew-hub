import { withTimeout } from '../../data/firestore-rest.js';
import { createPasswordFields } from '../../security/password.js';
import { hideOverlay, showOverlay, verify } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';
import { createChecklistId, deleteChecklist, loadAllChecklists, saveChecklist } from './api.js';
import { checklistState, replaceChecklistItems } from './state.js';

function escapeHtml(value){
  const div = document.createElement('div');
  div.textContent = value || '';
  return div.innerHTML;
}

function escapeAttr(value){
  return String(value ?? '').replace(/[&<>"']/g, character=>({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  })[character]);
}

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

export async function initializeChecklists(){
  try{
    const items = await loadAllChecklists();
    replaceChecklistItems(items);
  }catch(e){
    console.error('prepChecklist read failed entirely:', e);
    replaceChecklistItems([]);
  }
}

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

export function ckToggleSkip(key){
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

export function openChecklistEntry(){
  checklistState.editingId = null;
  document.getElementById('checklistFormTitle').textContent = '체크리스트 작성';
  document.getElementById('checklistForm').reset();
  document.getElementById('ck_ownerId').removeAttribute('readonly');
  document.getElementById('ck_public').checked = false;
  ckResetForm();
  showCkPwField(true);
  showOverlay('checklistFormOverlay');
}
export function closeChecklistFormModal(){ hideOverlay('checklistFormOverlay'); }

export async function loadMyChecklist(){
  const oid = document.getElementById('ck_ownerId').value.trim();
  if(!oid){ toast('아이디를 입력해주세요'); return; }
  const existing = checklistState.items.find(c=>c.ownerId===oid);
  if(!existing){ toast('아직 없는 아이디예요. 새로 작성해주세요'); checklistState.editingId=null; showCkPwField(true); return; }
  const ok = await verify(existing);
  if(!ok) return;
  checklistState.editingId = existing.id;
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
  if(!checklistState.editingId && checklistState.items.some(c=>c.ownerId===ownerId)){
    toast('이미 사용 중인 아이디예요. 불러오기로 수정해주세요');
    return;
  }
  const items = {};
  ckFlatItems().forEach(it=>{ items[it.key] = document.getElementById('ck_item_'+it.key).value.trim(); });
  const isPublic = document.getElementById('ck_public').checked;

  const submitBtn = document.querySelector('#checklistForm button[type="submit"]');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = '저장 중...'; }

  let backup = null, newEntry = null, targetId;
  if(checklistState.editingId){
    targetId = checklistState.editingId;
    const idx = checklistState.items.findIndex(x=>x.id===checklistState.editingId);
    backup = {...checklistState.items[idx]};
    checklistState.items[idx] = {...checklistState.items[idx], ownerId, items, isPublic};
  }else{
    const pw = document.getElementById('ck_password').value;
    if(!pw){
      toast('비밀번호를 입력해주세요');
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = '저장'; }
      return;
    }
    if(submitBtn) submitBtn.textContent = '비밀번호 처리 중';
    const passwordFields = await createPasswordFields(pw);
    targetId = createChecklistId();
    newEntry = {id:targetId, ownerId, items, isPublic, ...passwordFields};
    checklistState.items.push(newEntry);
  }

  const { id: _omit, ...dataToSave } = checklistState.items.find(x=>x.id===targetId);
  let result;
  try{ result = await withTimeout(saveChecklist(targetId, dataToSave, s=>{ if(submitBtn) submitBtn.textContent = s; }), 12000); }
  catch(e){ result = {ok:false, error: e && e.message==='timeout' ? 'timeout' : String(e)}; }

  if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = '저장'; }

  if(!result.ok){
    // roll back the optimistic local change so the UI doesn't show a phantom "saved" entry
    if(checklistState.editingId){
      const idx = checklistState.items.findIndex(x=>x.id===checklistState.editingId);
      if(idx>-1) checklistState.items[idx] = backup;
    }else if(newEntry){
      checklistState.items = checklistState.items.filter(x=>x.id!==newEntry.id);
    }
    toast('저장 실패: ' + (result.error || '알 수 없는 오류'), 6000);
    return; // keep the modal open so nothing typed is lost
  }

  closeChecklistFormModal();
  renderChecklistList();
  toast('저장되었습니다');
});

let lastChecklistListHtml = null;
export function renderChecklistList(){
  const el = document.getElementById('checklistList');
  if(!el) return;
  if(!checklistState.items || checklistState.items.length===0){
    const empty = `<div class="empty">아직 작성된 체크리스트가 없어요. 첫 번째로 작성해보세요!</div>`;
    if(empty !== lastChecklistListHtml){ lastChecklistListHtml = empty; el.innerHTML = empty; }
    return;
  }
  const rows = checklistState.items.map(c=>{
    const badge = c.isPublic
      ? `<span class="hall-tag" style="background:var(--accent-tint); color:var(--accent-deep);"><i class="hall-tag-dot" style="background:var(--accent-deep)"></i>공개</span>`
      : `<span class="hall-tag" style="background:var(--neutral-tint); color:var(--ink-soft);"><i class="hall-tag-dot" style="background:var(--ink-faint)"></i>비공개</span>`;
    return `<tr class="rowitem" role="button" tabindex="0" data-action="checklist-detail" data-id="${escapeAttr(c.id)}"><td><b>${escapeHtml(c.ownerId)}</b></td><td>${badge}</td></tr>`;
  }).join('');
  const html = `<div class="table-wrap"><table class="list-table">
    <thead><tr><th>아이디</th><th>공개여부</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
  if(html !== lastChecklistListHtml){
    lastChecklistListHtml = html;
    el.innerHTML = html;
  }
}

export async function openChecklistDetail(id){
  const item = checklistState.items.find(x=>x.id===id);
  if(!item) return;
  if(!item.isPublic){
    const ok = await verify(item);
    if(!ok) return;
  }
  renderChecklistDetail(item);
}

function renderChecklistDetail(item){
  checklistState.viewingId = item.id;
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
export function closeChecklistDetail(){ hideOverlay('checklistDetailOverlay'); }

function checklistText(item){
  const lines = [];
  ckFlatItems().forEach(it=>{
    const v = (item.items && item.items[it.key]) || '';
    lines.push(`${it.emoji?it.emoji+' ':''}${it.label} : ${v}`);
  });
  return lines.join('\n');
}

export async function copyChecklist(){
  const item = checklistState.items.find(x=>x.id===checklistState.viewingId);
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

export async function requestEditChecklist(){
  const item = checklistState.items.find(x=>x.id===checklistState.viewingId);
  const ok = await verify(item);
  if(!ok) return;
  closeChecklistDetail();
  checklistState.editingId = item.id;
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

export async function requestDeleteChecklist(){
  const item = checklistState.items.find(x=>x.id===checklistState.viewingId);
  const ok = await verify(item);
  if(!ok) return;
  if(!confirm('정말 삭제하시겠어요?')) return;
  const targetId = checklistState.viewingId;
  let result;
  try{ result = await withTimeout(deleteChecklist(targetId, s=>toast(s, 30000)), 12000); }
  catch(e){ result = {ok:false, error: e && e.message==='timeout' ? 'timeout' : String(e)}; }
  if(!result.ok){ toast('삭제 실패: ' + (result.error || '알 수 없는 오류'), 6000); return; }
  checklistState.items = checklistState.items.filter(x=>x.id!==targetId);
  closeChecklistDetail();
  renderChecklistList();
  toast('삭제되었습니다');
}
