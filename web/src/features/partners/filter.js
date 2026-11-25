/* 제휴업체 목록: 카테고리 칩 + 검색.
   목록 행(<tr data-partner>)의 업체명·카테고리를 읽어 자동으로 칩을 만들기 때문에,
   업체를 추가해도 이 파일은 손댈 필요가 없습니다. */
export function initPartnerFilter(){
  const rows = Array.from(document.querySelectorAll('#partners-menu tr[data-partner]'));
  const chipBox = document.getElementById('partnerChips');
  const search = document.getElementById('partnerSearch');
  const empty = document.getElementById('partnerEmpty');
  if(!rows.length || !chipBox || !search) return;

  const info = rows.map(tr => ({
    tr,
    name: (tr.cells[0]?.textContent || '').trim(),
    cat: (tr.cells[1]?.textContent || '').trim(),
  }));
  // 청첩장처럼 여러 업체가 있는 카테고리를 앞에 두고, 나머지는 등장 순서대로
  const counts = new Map();
  info.forEach(i => counts.set(i.cat, (counts.get(i.cat) || 0) + 1));
  const cats = Array.from(counts.keys()).sort((a, b) => counts.get(b) - counts.get(a));
  let current = '전체';

  function renderChips(){
    chipBox.innerHTML = '';
    ['전체', ...cats].forEach(c => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (c === current ? ' active' : '');
      b.textContent = c === '전체' ? `전체 ${info.length}` : `${c} ${counts.get(c)}`;
      b.setAttribute('aria-pressed', String(c === current));
      b.onclick = () => { current = c; renderChips(); apply(); };
      chipBox.appendChild(b);
    });
  }
  function apply(){
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    info.forEach(i => {
      const ok = (current === '전체' || i.cat === current) &&
        (!q || i.name.toLowerCase().includes(q) || i.cat.toLowerCase().includes(q));
      i.tr.style.display = ok ? '' : 'none';
      if(ok) shown++;
    });
    empty.style.display = shown ? 'none' : 'block';
  }
  search.addEventListener('input', apply);
  renderChips();
  apply();
}
