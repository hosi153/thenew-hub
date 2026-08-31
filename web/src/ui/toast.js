/* Extracted in stage 3 of docs/PERFORMANCE_REFACTORING_PLAN.md.
   Previously the pending timer lived on `window._toastTimer`; now it's a
   plain module-scoped variable — same behavior, no longer leaks onto window. */
let toastTimer;
export function toast(msg, ms){
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), ms || 1800);
}
