import { withTimeout } from '../../data/firestore-rest.js';
import { createPasswordFields } from '../../security/password.js';
import { hideOverlay, showOverlay, verify } from '../../ui/modal.js';
import { toast } from '../../ui/toast.js';
import { createInstaShareId, deleteInstaShare, instaCollectionIsEmpty, loadAllInstaShares, saveInstaShare, seedInstaShares } from './api.js';
import { instaState, replaceInstaItems } from './state.js';

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

/* Accepts a bare handle, an @handle, or a pasted instagram.com URL, and
   normalizes it down to a plain username so we can reliably build a
   profile link out of it later. */
function normalizeInstaId(raw){
  let value = (raw || '').trim();
  value = value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '');
  value = value.replace(/^@/, '');
  value = value.split('?')[0].split('/')[0];
  return value.trim();
}

function formatDate(iso){
  if(!iso) return '';
  const d = new Date(iso);
  if(Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

/* Starter data provided at launch — see docs/AGENT_ACTIVITY_LOG.md for the
   import (2026-09-01 batch). Seeded once if the collection is empty, same
   pattern as SEED_HALLS/SEED_CODES. */
const SEED_INSTA = [
  { id:'insta_seed_1', nickname:'프로도', instaId:'drizzleeun', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_2', nickname:'몰랑', instaId:'ly.ri_cal_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_3', nickname:'헤이즐', instaId:'novv_hazel', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_4', nickname:'쩡이', instaId:'maniac_wedding11.17', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_5', nickname:'만덕', instaId:'rom.mate_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_6', nickname:'쩌밍', instaId:'6._.yj', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_7', nickname:'쩌밍(포토)', instaId:'6._.photo', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_8', nickname:'네오딱뾲', instaId:'n_ss5n', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_9', nickname:'네오딱뾲(서브)', instaId:'xx2xjxx', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_10', nickname:'밍츄츄', instaId:'jixxi.x', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_11', nickname:'참으른', instaId:'ha.eun.jo_0109', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_12', nickname:'암냠', instaId:'nn_ssol', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_13', nickname:'스콘', instaId:'jeenyeo_n', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_14', nickname:'밍복치', instaId:'min_di426', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_15', nickname:'삐약이', instaId:'01120_k', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_16', nickname:'명요(요정)', instaId:'naraeee__', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_17', nickname:'키라', instaId:'kanaria1717', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_18', nickname:'대게신랑', instaId:'hgcc_daily', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_19', nickname:'대게신랑(스냅)', instaId:'hgcc_snap', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_20', nickname:'대부', instaId:'___rlo_zl', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_21', nickname:'뉴짜', instaId:'chaeyvra', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_22', nickname:'벨이', instaId:'cho._.he', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_23', nickname:'숩', instaId:'im_bin_97', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_24', nickname:'다니', instaId:'daun__h', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_25', nickname:'효콩', instaId:'hyo.k._.k', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_26', nickname:'2609 솔츄', instaId:'evergreen_sol___a', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_27', nickname:'키티', instaId:'hxax.kr', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_28', nickname:'베리', instaId:'06vo_ov06', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_29', nickname:'크롱', instaId:'_im____hee', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_30', nickname:'전찡', instaId:'hyxx_jjxng_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_31', nickname:'옐', instaId:'sonyerrii', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_32', nickname:'도화', instaId:'2da.hey', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_33', nickname:'쿨쿨', instaId:'eunseon._.b', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_34', nickname:'우왕', instaId:'_kong_kong_k', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_35', nickname:'졔스', instaId:'zzaeya_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_36', nickname:'얼음공주', instaId:'goeun_0703', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_37', nickname:'무무', instaId:'chu_.mul', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_38', nickname:'2612 젤리', instaId:'n___smin', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_39', nickname:'2610/슥', instaId:'_lxexexl_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_40', nickname:'2612 듀공', instaId:'monalimio.o', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_41', nickname:'2609 전찡', instaId:'hyxx_jjxng_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_42', nickname:'2701 물범', instaId:'jjjzzzu_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_43', nickname:'2610미니', instaId:'soap2ya', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_44', nickname:'2705 늘늘', instaId:'nul._.world', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_45', nickname:'2701 리니', instaId:'lin_chae00', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_46', nickname:'2703 베르데 (본)', instaId:'cui_kelin', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_47', nickname:'2703 베르데 (섭)', instaId:'wedding_verde', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_48', nickname:'2610 릴라', instaId:'rilla8994', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_49', nickname:'2711 낭맘', instaId:'nx_aeun', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_50', nickname:'2701 밍귤', instaId:'mingram__', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_51', nickname:'2705 뽀또(본)', instaId:'_doajoa_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_52', nickname:'2705 뽀또(섭)', instaId:'_joadoa_', createdAt:'2026-09-01T00:00:00.000Z' },
  { id:'insta_seed_53', nickname:'2610 애참', instaId:'orl.cham_666', createdAt:'2026-09-01T00:00:00.000Z' },
];

export async function initializeInstaShares(){
  try{
    if(await instaCollectionIsEmpty()){
      try{ await seedInstaShares(SEED_INSTA); }catch(e){ console.error('insta seed failed:', e); }
      replaceInstaItems(SEED_INSTA);
      return;
    }
    const items = await loadAllInstaShares();
    replaceInstaItems(items);
  }catch(e){
    console.error('instaShares read failed entirely:', e);
    replaceInstaItems(SEED_INSTA);
  }
}

export function renderInstaList(){
  const el = document.getElementById('instaList');
  if(!el) return;
  if(!instaState.items || instaState.items.length===0){
    el.innerHTML = `<div class="empty">아직 공유된 인스타가 없어요. 첫 번째로 공유해보세요!</div>`;
    return;
  }
  // Newest first — sorted by the auto-recorded creation time, not a
  // user-typed date, so this can't be gamed to sit at the top.
  const sorted = instaState.items.slice().sort((a,b)=> (b.createdAt||'').localeCompare(a.createdAt||''));
  const rows = sorted.map(item=>`<tr class="rowitem" role="button" tabindex="0" data-action="insta-detail" data-id="${escapeAttr(item.id)}">
    <td><b>@${escapeHtml(item.instaId)}</b></td><td>${escapeHtml(item.nickname)}</td><td>${formatDate(item.createdAt)}</td></tr>`).join('');
  el.innerHTML = `<div class="table-wrap insta-table-wrap"><table class="list-table insta-list-table">
    <thead><tr><th>인스타</th><th>닉네임</th><th>업로드</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function showInstaPwField(show){
  document.getElementById('insta_pw_field').style.display = show ? 'block' : 'none';
  document.getElementById('insta_password').required = show;
}

export function openInstaEntry(){
  instaState.editingId = null;
  document.getElementById('instaFormTitle').textContent = '인스타 공유 등록';
  document.getElementById('instaForm').reset();
  showInstaPwField(true);
  showOverlay('instaFormOverlay');
}
export function closeInstaFormModal(){ hideOverlay('instaFormOverlay'); }

document.getElementById('instaForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const nickname = document.getElementById('insta_nickname').value.trim();
  const instaId = normalizeInstaId(document.getElementById('insta_id').value);
  if(!nickname || !instaId){ toast('닉네임과 인스타 아이디를 모두 입력해주세요'); return; }

  const submitBtn = document.querySelector('#instaForm button[type="submit"]');
  if(submitBtn){ submitBtn.disabled = true; submitBtn.textContent = '저장 중...'; }

  let backup = null, newEntry = null, targetId;
  if(instaState.editingId){
    targetId = instaState.editingId;
    const idx = instaState.items.findIndex(x=>x.id===instaState.editingId);
    backup = {...instaState.items[idx]};
    instaState.items[idx] = {...instaState.items[idx], nickname, instaId};
  }else{
    const pw = document.getElementById('insta_password').value;
    if(!pw){
      toast('비밀번호를 입력해주세요');
      if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = '저장'; }
      return;
    }
    if(submitBtn) submitBtn.textContent = '비밀번호 처리 중';
    const passwordFields = await createPasswordFields(pw);
    targetId = createInstaShareId();
    newEntry = { id:targetId, nickname, instaId, createdAt:new Date().toISOString(), ...passwordFields };
    instaState.items.push(newEntry);
  }

  const { id: _omit, ...dataToSave } = instaState.items.find(x=>x.id===targetId);
  let result;
  try{ result = await withTimeout(saveInstaShare(targetId, dataToSave, s=>{ if(submitBtn) submitBtn.textContent = s; }), 12000); }
  catch(e){ result = {ok:false, error: e && e.message==='timeout' ? 'timeout' : String(e)}; }

  if(submitBtn){ submitBtn.disabled = false; submitBtn.textContent = '저장'; }

  if(!result.ok){
    if(instaState.editingId){
      const idx = instaState.items.findIndex(x=>x.id===instaState.editingId);
      if(idx>-1) instaState.items[idx] = backup;
    }else if(newEntry){
      instaState.items = instaState.items.filter(x=>x.id!==newEntry.id);
    }
    toast('저장 실패: ' + (result.error || '알 수 없는 오류'), 6000);
    return; // keep the modal open so nothing typed is lost
  }

  closeInstaFormModal();
  renderInstaList();
  toast('저장되었습니다');
});

export async function openInstaDetail(id){
  const item = instaState.items.find(x=>x.id===id);
  if(!item) return;
  renderInstaDetail(item);
}

function renderInstaDetail(item){
  instaState.viewingId = item.id;
  document.getElementById('insta_d_nickname').textContent = item.nickname;
  document.getElementById('insta_d_insta').textContent = '@'+item.instaId;
  document.getElementById('insta_d_date').textContent = formatDate(item.createdAt) || '-';
  const openBtn = document.getElementById('insta_d_open');
  if(openBtn) openBtn.href = `https://www.instagram.com/${encodeURIComponent(item.instaId)}/`;
  showOverlay('instaDetailOverlay');
}
export function closeInstaDetail(){ hideOverlay('instaDetailOverlay'); }

export async function requestEditInsta(){
  const item = instaState.items.find(x=>x.id===instaState.viewingId);
  const ok = await verify(item);
  if(!ok) return;
  closeInstaDetail();
  instaState.editingId = item.id;
  document.getElementById('instaFormTitle').textContent = '인스타 공유 수정';
  document.getElementById('insta_nickname').value = item.nickname;
  document.getElementById('insta_id').value = item.instaId;
  showInstaPwField(false);
  showOverlay('instaFormOverlay');
}

export async function requestDeleteInsta(){
  const item = instaState.items.find(x=>x.id===instaState.viewingId);
  const ok = await verify(item);
  if(!ok) return;
  if(!confirm('정말 삭제하시겠어요?')) return;
  const targetId = instaState.viewingId;
  let result;
  try{ result = await withTimeout(deleteInstaShare(targetId, s=>toast(s, 30000)), 12000); }
  catch(e){ result = {ok:false, error: e && e.message==='timeout' ? 'timeout' : String(e)}; }
  if(!result.ok){ toast('삭제 실패: ' + (result.error || '알 수 없는 오류'), 6000); return; }
  instaState.items = instaState.items.filter(x=>x.id!==targetId);
  closeInstaDetail();
  renderInstaList();
  toast('삭제되었습니다');
}
