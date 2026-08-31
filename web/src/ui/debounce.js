/* Stage 5 of docs/PERFORMANCE_REFACTORING_PLAN.md — search inputs re-render
   the whole list on every keystroke; debouncing avoids rebuilding the DOM
   on every single character while the person is still typing. */
export function debounce(fn, wait = 150){
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}
