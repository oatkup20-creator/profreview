// หน้ารายชื่ออาจารย์และรีวิว
import { api, qs } from '../api.js';
import { $, esc, icon, debounce, pager, FACULTIES } from '../ui.js';
import { mountLayout } from '../layout.js';
import { professorCard } from '../components.js';

const params = new URLSearchParams(location.search);
const state = {
  q: params.get('q') || '',
  faculty: params.get('faculty') || 'all',
  sort: params.get('sort') || 'rating',
  page: Number(params.get('page')) || 1,
};

const me = await mountLayout('professors');
if (me) init();

async function init() {
  const stats = await api('/stats');
  $('#main').innerHTML = `
    <section class="hero" style="background:radial-gradient(900px 300px at 100% 100%, rgba(37,99,235,.55), transparent 60%), linear-gradient(135deg,#0b1b33 0%,#0c2847 50%,#1e3a8a 100%)">
      <div class="row-between wrap" style="align-items:flex-start">
        <div>
          <span class="hero-kicker">${icon('groups', 'sm')} คณาจารย์และภาควิชา • อัปเดตข้อมูลทุกเทอม</span>
          <h1 class="mt-3">รายชื่ออาจารย์และรีวิวทั้งหมด</h1>
          <p class="lead">คลิกที่การ์ดอาจารย์เพื่อดูประวัติ การให้คะแนน คอมเมนต์เด่น และรีวิวทั้งหมด</p>
        </div>
        <div class="hero-stats">
          <div><b>${stats.professorCount} ท่าน</b><span>จำนวนอาจารย์</span></div>
          <div><b class="gold">★ ${stats.professorAvg}</b><span>คะแนนเฉลี่ย</span></div>
        </div>
      </div>
      <form class="hero-search" id="search-form" role="search">
        <div class="field-wrap">${icon('search')}<input id="q" type="search" value="${esc(state.q)}" placeholder="ค้นหาชื่ออาจารย์ เช่น ดร. พิเชษฐ์, ศ. เดวิด, หรือรหัสวิชาที่สอน..." aria-label="ค้นหาอาจารย์"></div>
        <button class="btn" style="background:var(--sky);color:#fff">${icon('search', 'sm')} ค้นหา</button>
      </form>
    </section>
    <section class="stack">
      <div class="toolbar">
        <div class="chips" id="chips" role="group" aria-label="คณะ"></div>
        <div class="row"><label class="small muted" for="sort">เรียงตาม:</label>
          <select id="sort" class="select"><option value="rating">คะแนนสูงสุด</option><option value="reviews">รีวิวมากที่สุด</option><option value="name">ชื่อ (ก-ฮ)</option></select>
        </div>
      </div>
      <div class="grid grid-3" id="grid"></div>
      <div class="card pager" id="pager"></div>
    </section>`;

  $('#sort').value = state.sort;
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); state.q = $('#q').value.trim(); state.page = 1; load(); });
  $('#q').addEventListener('input', debounce(() => { state.q = $('#q').value.trim(); state.page = 1; load(); }, 300));
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; state.page = 1; load(); });
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-fac]');
    if (b) { state.faculty = b.dataset.fac; state.page = 1; load(); }
  });
  load();
  // เปิดหน้าต่างอาจารย์อัตโนมัติเมื่อมี ?open=id
  if (params.get('open')) import('../components.js').then(m => m.openProfessorModal(params.get('open')));
}

async function load() {
  history.replaceState(null, '', location.pathname + qs({ q: state.q, faculty: state.faculty !== 'all' ? state.faculty : '', sort: state.sort !== 'rating' ? state.sort : '', page: state.page > 1 ? state.page : '' }));
  $('#grid').innerHTML = '<div class="skeleton" style="height:380px"></div>'.repeat(3);
  const data = await api('/professors' + qs({ q: state.q, faculty: state.faculty, sort: state.sort, page: state.page }));
  state.page = data.page;
  $('#chips').innerHTML = [['all', `ทั้งหมด (${data.counts.all})`], ...Object.entries(FACULTIES).map(([k, v]) => [k, `${v} (${data.counts[k] || 0})`])]
    .map(([k, l]) => `<button class="chip ${state.faculty === k ? 'on' : ''}" data-fac="${k}" aria-pressed="${state.faculty === k}">${l}</button>`).join('');
  $('#grid').innerHTML = data.items.length
    ? data.items.map(professorCard).join('')
    : `<div class="card empty" style="grid-column:1/-1">${icon('person_off')}<h4>ไม่พบอาจารย์ที่ตรงกับคำค้นหา</h4><p>ลองค้นหาด้วยชื่อ หรือเลือกคณะอื่น</p></div>`;
  pager($('#pager'), { ...data, unit: 'ท่าน' }, p => { state.page = p; load(); scrollTo({ top: 0, behavior: 'smooth' }); });
}
