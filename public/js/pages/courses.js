// หน้ารายชื่อวิชาเรียนและรีวิวทั้งหมด
import { api, qs } from '../api.js';
import { $, esc, icon, fmtNum, debounce, pager, CATEGORIES } from '../ui.js';
import { mountLayout } from '../layout.js';
import { courseCard } from '../components.js';

const params = new URLSearchParams(location.search);
const state = {
  q: params.get('q') || '',
  category: params.get('category') || 'all',
  sort: params.get('sort') || 'rating',
  saved: params.get('saved') === '1',
  page: Number(params.get('page')) || 1,
};

const me = await mountLayout(state.saved ? 'saved' : 'courses');
if (me) init();

async function init() {
  const stats = await api('/stats');
  $('#main').innerHTML = `
    <section class="hero">
      <div class="row-between wrap" style="align-items:flex-start">
        <div>
          <span class="hero-kicker">${icon('school', 'sm')} หลักสูตรปริญญาตรี • อัปเดตข้อมูลทุกเทอม</span>
          <h1 class="mt-3" id="page-title"></h1>
          <p class="lead">คลิกที่การ์ดหรือปุ่ม “ดูรายละเอียด &amp; รีวิว” เพื่อเปิดดูสถิติ คอมเมนต์เด่น และรีวิวทั้งหมด</p>
        </div>
        <div class="hero-stats">
          <div><b>${fmtNum(stats.totalReviews)}+</b><span>รีวิวในระบบ</span></div>
          <div><b class="gold">${stats.courseAvg} ★</b><span>คะแนนเฉลี่ย</span></div>
        </div>
      </div>
      <form class="hero-search" id="search-form" role="search">
        <div class="field-wrap">${icon('search')}<input id="q" type="search" value="${esc(state.q)}" placeholder="ค้นหารหัสวิชา เช่น ART 220, CS 201, BIO 105 หรือชื่อวิชา..." aria-label="ค้นหาวิชา"></div>
        <button class="btn btn-accent">${icon('search', 'sm')} ค้นหา</button>
      </form>
    </section>

    <section class="stack">
      <div class="toolbar">
        <div class="chips" id="chips" role="group" aria-label="หมวดวิชา"></div>
        <div class="row">
          <label class="small muted" for="sort">เรียงตาม:</label>
          <select id="sort" class="select">
            <option value="rating">คะแนนสูงสุด</option>
            <option value="reviews">รีวิวมากที่สุด</option>
            <option value="easy">ความยากน้อยที่สุด</option>
            <option value="code">รหัสวิชา (A-Z)</option>
          </select>
        </div>
      </div>
      <div class="row-between wrap">
        <label class="check" style="align-items:center"><input type="checkbox" id="saved-only" ${state.saved ? 'checked' : ''}> แสดงเฉพาะวิชาที่บันทึกไว้</label>
        <button class="btn-text small muted row" id="reset">${icon('refresh', 'sm')} ล้างตัวกรอง</button>
      </div>
      <div class="grid grid-3" id="grid"></div>
      <div class="card pager" id="pager"></div>
    </section>`;

  $('#sort').value = state.sort;
  $('#search-form').addEventListener('submit', e => { e.preventDefault(); state.q = $('#q').value.trim(); state.page = 1; load(); });
  $('#q').addEventListener('input', debounce(() => { state.q = $('#q').value.trim(); state.page = 1; load(); }, 300));
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; state.page = 1; load(); });
  $('#saved-only').addEventListener('change', e => { state.saved = e.target.checked; state.page = 1; load(); });
  $('#reset').addEventListener('click', () => {
    Object.assign(state, { q: '', category: 'all', sort: 'rating', saved: false, page: 1 });
    $('#q').value = ''; $('#sort').value = 'rating'; $('#saved-only').checked = false;
    load();
  });
  $('#chips').addEventListener('click', e => {
    const b = e.target.closest('[data-cat]');
    if (b) { state.category = b.dataset.cat; state.page = 1; load(); }
  });
  // ถ้ายกเลิกบันทึกขณะดูเฉพาะที่บันทึกไว้ ให้รีเฟรชรายการ
  document.addEventListener('pr:changed', e => { if (state.saved && e.detail.kind === 'saved') load(); });
  load();
}

async function load() {
  syncUrl();
  $('#page-title').textContent = state.saved ? 'วิชาที่บันทึกไว้ของฉัน' : 'รายชื่อวิชาเรียนและรีวิวทั้งหมด';
  $('#grid').innerHTML = '<div class="skeleton" style="height:340px"></div>'.repeat(3);
  const data = await api('/courses' + qs({ q: state.q, category: state.category, sort: state.sort, page: state.page, saved: state.saved ? 1 : '' }));
  state.page = data.page;

  $('#chips').innerHTML = [['all', `ทั้งหมด (${data.counts.all})`], ...Object.entries(CATEGORIES).map(([k, v]) => [k, `${v} (${data.counts[k] || 0})`])]
    .map(([k, l]) => `<button class="chip ${state.category === k ? 'on' : ''}" data-cat="${k}" aria-pressed="${state.category === k}">${l}</button>`).join('');

  $('#grid').innerHTML = data.items.length
    ? data.items.map(courseCard).join('')
    : `<div class="card empty" style="grid-column:1/-1">${icon(state.saved ? 'bookmark' : 'search_off')}
        <h4>${state.saved ? 'ยังไม่มีวิชาที่บันทึกไว้' : 'ไม่พบรายวิชาที่ตรงกับเงื่อนไข'}</h4>
        <p>${state.saved ? 'กดไอคอนบุ๊กมาร์กบนการ์ดวิชาเพื่อบันทึกไว้ดูภายหลัง' : 'ลองเปลี่ยนคำค้นหาหรือหมวดหมู่ใหม่'}</p></div>`;
  pager($('#pager'), { ...data, unit: 'วิชา' }, p => { state.page = p; load(); scrollTo({ top: 0, behavior: 'smooth' }); });
}

function syncUrl() {
  const s = qs({ q: state.q, category: state.category !== 'all' ? state.category : '', sort: state.sort !== 'rating' ? state.sort : '', saved: state.saved ? 1 : '', page: state.page > 1 ? state.page : '' });
  history.replaceState(null, '', location.pathname + s);
}
