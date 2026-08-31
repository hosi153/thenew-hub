import { withTimeout } from '../../data/firestore-rest.js';
import { createPasswordFields } from '../../security/password.js';
import { hideOverlay, showOverlay, verify } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';
import { debounce } from '../../ui/debounce.js';
import {
  createMatchingCodeId,
  deleteMatchingCode,
  loadAllMatchingCodes,
  loadMatchingCodePage,
  matchingCodeCollectionIsEmpty,
  saveMatchingCode,
  seedMatchingCodes,
} from './api.js';
import {
  appendUniqueMatchingCodes,
  matchingCodeState,
  replaceMatchingCodes,
} from './state.js';

const PAGE_SIZE = 20;

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

export async function initializeMatchingCodes(seedItems){
  let usingSeedFallback = false;
  try{
    if(await matchingCodeCollectionIsEmpty()){
      try{ await seedMatchingCodes(seedItems); }
      catch(error){ usingSeedFallback = true; console.error('code seed write failed:', error); }
      replaceMatchingCodes(seedItems);
      matchingCodeState.fullyLoaded = true;
      matchingCodeState.page.hasMore = false;
      matchingCodeState.page.error = null;
    }else{
      const pageOk = await loadMoreCodes();
      if(!pageOk) throw new Error('code-first-page-failed');
    }
  }catch(error){
    console.error('code init failed, using seed data as fallback:', error);
    usingSeedFallback = true;
    replaceMatchingCodes(seedItems);
    matchingCodeState.fullyLoaded = true;
    matchingCodeState.page.hasMore = false;
    matchingCodeState.page.error = null;
  }
  return {usingSeedFallback};
}

export function renderCodeChips(){
  const categories = ['전체','스냅','DVD','축의대','한복','예물','기타'];
  const wrap = document.getElementById('codeChips');
  wrap.innerHTML = categories.map(category=>
    `<button class="chip ${category===matchingCodeState.filter?'active':''}" onclick="setCodeFilter('${category}')">${category}</button>`
  ).join('');
}

export function setCodeFilter(category){
  matchingCodeState.filter = category;
  renderCodeChips();
  renderCodes();
}

export async function loadMoreCodes(){
  const {page} = matchingCodeState;
  if(page.loading || page.error || !page.hasMore || matchingCodeState.fullyLoaded) return false;
  page.loading = true;
  renderCodes();
  try{
    const result = await loadMatchingCodePage({after:page.lastDoc, limit:PAGE_SIZE});
    appendUniqueMatchingCodes(result.items);
    page.lastDoc = result.lastDoc;
    page.hasMore = result.hasMore;
    page.error = null;
  }catch(error){
    console.error('loadMoreCodes failed:', error);
    page.error = '짝꿍코드를 불러오지 못했습니다.';
    page.loading = false;
    renderCodes();
    return false;
  }
  page.loading = false;
  renderCodes();
  return true;
}

async function ensureCodesFullyLoaded(){
  if(matchingCodeState.fullyLoaded || matchingCodeState.fullLoading) return;
  matchingCodeState.fullLoading = true;
  try{
    replaceMatchingCodes(await loadAllMatchingCodes());
    matchingCodeState.fullyLoaded = true;
    matchingCodeState.page.error = null;
  }catch(error){
    console.error('ensureCodesFullyLoaded failed:', error);
    matchingCodeState.page.error = '전체 짝꿍코드를 불러오지 못했습니다.';
  }
  matchingCodeState.fullLoading = false;
  renderCodes();
}

export function retryLoadCodes(){
  matchingCodeState.page.error = null;
  const needsFullData = document.getElementById('codeSearch').value.trim() || matchingCodeState.filter!=='전체';
  if(needsFullData) ensureCodesFullyLoaded();
  else loadMoreCodes();
}

export function renderCodes(){
  const query = document.getElementById('codeSearch').value.trim().toLowerCase();
  const needsFullData = !!query || matchingCodeState.filter!=='전체';
  const {page} = matchingCodeState;
  if(needsFullData && !matchingCodeState.fullyLoaded){
    document.getElementById('codeList').innerHTML = page.error
      ? `<div class="empty">${escapeHtml(page.error)}<br><button type="button" class="btn btn-outline btn-sm" onclick="retryLoadCodes()">다시 시도</button></div>`
      : `<div class="loading">불러오는 중...</div>`;
    if(!page.error && !matchingCodeState.fullLoading) ensureCodesFullyLoaded();
    return;
  }

  const list = matchingCodeState.items.filter(item=>(matchingCodeState.filter==='전체' || item.category===matchingCodeState.filter) &&
    (!query || (item.vendor||'').toLowerCase().includes(query) || (item.sharer||'').toLowerCase().includes(query)));
  const element = document.getElementById('codeList');
  if(list.length===0){
    element.innerHTML = page.error
      ? `<div class="empty">${escapeHtml(page.error)}<br><button type="button" class="btn btn-outline btn-sm" onclick="retryLoadCodes()">다시 시도</button></div>`
      : page.loading ? `<div class="loading">불러오는 중...</div>`
      : `<div class="empty">조건에 맞는 항목이 없습니다.</div>`;
    return;
  }

  const rows = list.map(item=>`<tr class="rowitem" role="button" tabindex="0" data-action="code-detail" data-id="${escapeAttr(item.id)}">
    <td><b>${escapeHtml(item.vendor)}</b></td><td><span class="hall-badge">${escapeHtml(item.category)}</span></td>
    <td>${escapeHtml(item.sharer)}</td></tr>`).join('');
  const footer = page.error
    ? `<div class="empty">${escapeHtml(page.error)}<br><button type="button" class="btn btn-outline btn-sm" onclick="retryLoadCodes()">다시 시도</button></div>`
    : (!needsFullData && page.hasMore)
    ? `<div class="loading" id="codeLoadMoreSentinel">${page.loading ? '더 불러오는 중...' : ''}</div>` : '';
  const html = `<div class="table-wrap code-table-wrap"><table class="list-table code-list-table">
    <thead><tr><th>업체명</th><th>카테고리</th><th>공유자</th></tr></thead>
    <tbody>${rows}</tbody></table></div>${footer}`;
  element.innerHTML = html;
}
/* Debounced so typing in the search box doesn't rebuild the whole list on
   every keystroke — only once input has paused for a moment. */
export const handleCodeSearchInput = debounce(() => renderCodes(), 150);

export function openCodeDetail(id){
  matchingCodeState.viewingId = id;
  const item = matchingCodeState.items.find(candidate=>candidate.id===id);
  if(!item) return;
  document.getElementById('cd_vendor').textContent = item.vendor;
  document.getElementById('cd_category').textContent = item.category;
  document.getElementById('cd_sharer').textContent = item.sharer;
  document.getElementById('cd_code').textContent = item.code;
  showOverlay('codeDetailOverlay');
}

export function closeCodeDetail(){ hideOverlay('codeDetailOverlay'); }

export async function requestEditCode(){
  const item = matchingCodeState.items.find(candidate=>candidate.id===matchingCodeState.viewingId);
  if(!item || !(await verify(item))) return;
  closeCodeDetail();
  openCodeModal(matchingCodeState.viewingId);
}

export async function requestDeleteCode(){
  const item = matchingCodeState.items.find(candidate=>candidate.id===matchingCodeState.viewingId);
  if(!item || !(await verify(item))) return;
  if(!confirm('정말 이 짝꿍코드를 삭제하시겠어요?')) return;
  const targetId = matchingCodeState.viewingId;
  let result;
  try{ result = await withTimeout(deleteMatchingCode(targetId, status=>toast(status, 30000)), 12000); }
  catch(error){ result = {ok:false, error:error && error.message==='timeout' ? 'timeout' : String(error)}; }
  if(!result.ok){ toast('삭제 실패: ' + (result.error || '알 수 없는 오류'), 6000); return; }
  matchingCodeState.items = matchingCodeState.items.filter(candidate=>candidate.id!==targetId);
  closeCodeDetail();
  renderCodes();
  toast('삭제되었습니다');
}

export function openCodeModal(id){
  matchingCodeState.editingId = id || null;
  document.getElementById('codeForm').reset();
  document.getElementById('codeModalTitle').textContent = id ? '짝꿍코드 수정' : '짝꿍코드 등록';
  document.getElementById('c_pw_field').style.display = id ? 'none' : 'block';
  document.getElementById('c_password').required = !id;
  if(id){
    const item = matchingCodeState.items.find(candidate=>candidate.id===id);
    if(!item) return;
    document.getElementById('c_vendor').value = item.vendor;
    document.getElementById('c_category').value = item.category;
    document.getElementById('c_sharer').value = item.sharer;
    document.getElementById('c_code').value = item.code;
  }
  showOverlay('codeOverlay');
}

export function closeCodeModal(){ hideOverlay('codeOverlay'); }

document.getElementById('codeForm').addEventListener('submit', async event=>{
  event.preventDefault();
  const vendor = document.getElementById('c_vendor').value.trim();
  const category = document.getElementById('c_category').value;
  const sharer = document.getElementById('c_sharer').value.trim();
  const code = document.getElementById('c_code').value.trim();
  const submitButton = document.querySelector('#codeForm button[type="submit"]');
  if(submitButton){ submitButton.disabled = true; submitButton.textContent = '저장 중...'; }

  let backup = null, newEntry = null, targetId;
  if(matchingCodeState.editingId){
    targetId = matchingCodeState.editingId;
    const index = matchingCodeState.items.findIndex(item=>item.id===targetId);
    backup = {...matchingCodeState.items[index]};
    matchingCodeState.items[index] = {...matchingCodeState.items[index], vendor, category, sharer, code};
  }else{
    if(submitButton) submitButton.textContent = '비밀번호 처리 중';
    const passwordFields = await createPasswordFields(document.getElementById('c_password').value);
    targetId = createMatchingCodeId();
    newEntry = {id:targetId, vendor, category, sharer, code, ...passwordFields};
    matchingCodeState.items.push(newEntry);
  }

  const {id: _omit, ...dataToSave} = matchingCodeState.items.find(item=>item.id===targetId);
  let result;
  try{ result = await withTimeout(saveMatchingCode(targetId, dataToSave, status=>{ if(submitButton) submitButton.textContent = status; }), 12000); }
  catch(error){ result = {ok:false, error:error && error.message==='timeout' ? 'timeout' : String(error)}; }
  if(submitButton){ submitButton.disabled = false; submitButton.textContent = '저장'; }

  if(!result.ok){
    if(matchingCodeState.editingId){
      const index = matchingCodeState.items.findIndex(item=>item.id===targetId);
      if(index>-1) matchingCodeState.items[index] = backup;
    }else if(newEntry){
      matchingCodeState.items = matchingCodeState.items.filter(item=>item.id!==newEntry.id);
    }
    toast('저장 실패: ' + (result.error || '알 수 없는 오류'), 6000);
    return;
  }
  closeCodeModal();
  renderCodes();
  toast('저장되었습니다');
});
