/* Extracted in stage 3 of docs/PERFORMANCE_REFACTORING_PLAN.md.
   Generic overlay/modal + password-prompt flow used by every feature (hall
   schedule, matching codes, checklist). */
import { authenticateItem } from '../security/password.js';

export function showOverlay(id){
  const overlay = document.getElementById(id);
  if(!overlay) return;
  overlay._returnFocus = document.activeElement;
  overlay.setAttribute('aria-hidden','false');
  overlay.classList.add('show');
  requestAnimationFrame(()=>{
    const focusTarget = overlay.querySelector('input:not([type="hidden"]), select, textarea, button');
    if(focusTarget) focusTarget.focus();
  });
}
export function hideOverlay(id){
  const overlay = document.getElementById(id);
  if(!overlay) return;
  overlay.classList.remove('show');
  overlay.setAttribute('aria-hidden','true');
  const returnFocus = overlay._returnFocus;
  if(returnFocus && returnFocus.isConnected) returnFocus.focus();
  overlay._returnFocus = null;
}
let pwResolver = null;
export function askPassword(title){
  document.getElementById('pwTitle').textContent = title || '비밀번호 확인';
  document.getElementById('pwInput').value = '';
  document.getElementById('pwError').style.display = 'none';
  showOverlay('pwOverlay');
  return new Promise(resolve=>{ pwResolver = resolve; });
}
export function cancelPwPrompt(){
  hideOverlay('pwOverlay');
  if(pwResolver){ pwResolver(null); pwResolver = null; }
}
export function submitPwPrompt(){
  const val = document.getElementById('pwInput').value;
  hideOverlay('pwOverlay');
  if(pwResolver){ pwResolver(val); pwResolver = null; }
}
document.getElementById('pwInput').addEventListener('keydown', e=>{
  if(e.key==='Enter'){ e.preventDefault(); submitPwPrompt(); }
});

/* Returns true if the entered password matches the item's stored hash, OR the admin master password */
export async function verify(item){
  const pw = await askPassword('비밀번호 확인');
  if(pw===null) return false;
  if(await authenticateItem(item, pw)){ return true; }
  showOverlay('pwOverlay');
  document.getElementById('pwError').style.display='block';
  const retry = await new Promise(resolve=>{ pwResolver = resolve; });
  hideOverlay('pwOverlay');
  if(retry===null) return false;
  return await authenticateItem(item, retry);
}
