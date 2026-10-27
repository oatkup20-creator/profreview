// ศูนย์กลางการเขียนรีวิวและจัดการรีวิว
import { api, qs } from '../api.js';
import { $, $$, esc, icon, stars, fmtNum, toast, openModal, showFieldErrors, avatar } from '../ui.js';
import { mountLayout, refreshCounts } from '../layout.js';
import { reviewCard, rememberReviews } from '../components.js';

const params = new URLSearchParams(location.search);
const STAR_HINTS = ['', 'ระดับ 1 ดาว - ควรปรับปรุงมาก', 'ระดับ 2 ดาว - พอใช้', 'ระดับ 3 ดาว - ปานกลาง', 'ระดับ 4 ดาว - ดีมาก', 'ระดับ 5 ดาว - ยอดเยี่ยม ประทับใจมาก'];
const state = {
  tab: params.get('tab') === 'mine' ? 'mine' : params.get('tab') === 'popular' ? 'popular' : 'write',
  listFilter: 'all',
  type: params.get('type') === 'professor' ? 'professor' : 'course',
  target: null, // { id, label, sub }
  rating: 0,
};
let catalog = { course: [], professor: [] };

const me = await mountLayout(state.tab === 'mine' ? 'my-reviews' : 'reviews');
if (me) init();

async function init() {
  const [courses, profs] = await Promise.all([api('/courses?limit=48&sort=code'), api('/professors?limit=48&sort=name')]);
  catalog = {
    course: courses.items.map(c => ({ id: c.code, label: `${c.code} ${c.titleTh}`, sub: c.titleEn || c.instructor || '' })),
    professor: profs.items.map(p => ({ id: p.id, label: p.nameTh, sub: `${p.deptLabel || ''} ${p.facultyName || ''}`, photo: p.photo })),
  };

  $('#main').innerHTML = `
    <section class="card card-pad" style="padding:24px 28px 0">
      <div class="row-between wrap" style="align-items:flex-start">
        <div style="max-width:620px">
          <div class="crumbs"><a href="/">หน้าหลัก</a>${icon('chevron_right')}<b style="color:var(--blue)">ศูนย์กลางการเขียนรีวิวและจัดการ (REVIEW CENTER)</b></div>
          <h1 class="page-title">ศูนย์กลางการเขียนรีวิววิชาและอาจารย์</h1>
          <p class="muted mt-1">แบ่งปันประสบการณ์การเรียนการสอนอย่างโปร่งใส ตรงไปตรงมา เพื่อเป็นเข็มทิศช่วยเพื่อนนักศึกษาในการตัดสินใจและวางแผนตารางเรียน</p>
        </div>
        <div class="row" style="gap:12px">
          <div class="card row" style="padding:12px 16px;gap:12px"><span class="kpi" style="padding:0"><span class="ico">${icon('rate_review', 'sm')}</span></span><div><div class="xs muted">รีวิวที่คุณเผยแพร่</div><b style="font-size:20px;color:var(--text)" data-count="myReviews">${me.counts.myReviews}</b></div></div>
          <div class="card row" style="padding:12px 16px;gap:12px"><span class="kpi" style="padding:0"><span class="ico" style="background:var(--amber-50);color:var(--amber)">${icon('thumb_up', 'sm fill')}</span></span><div><div class="xs muted">ได้รับประโยชน์</div><b style="font-size:20px;color:var(--text)" data-count="helpful">${fmtNum(me.counts.helpful)}</b></div></div>
        </div>
      </div>
      <nav class="row mt-4" style="gap:4px;border-top:1px solid var(--border);padding:10px 0" id="tabs" role="tablist"></nav>
    </section>
    <div id="write-area"></div>
    <section>
      <div class="section-head wrap">
        <div><h2 class="section-title" id="list-title" style="font-size:20px"></h2><p class="small muted" id="list-sub"></p></div>
        <div class="seg blue" id="list-filter"></div>
      </div>
      <div class="grid grid-3" id="list"></div>
    </section>`;

  $('#tabs').addEventListener('click', e => {
    const b = e.target.closest('[data-tab]');
    if (!b) return;
    state.tab = b.dataset.tab;
    history.replaceState(null, '', location.pathname + qs({ tab: state.tab === 'write' ? '' : state.tab }));
    drawTabs();
    loadList();
  });
  $('#list-filter').addEventListener('click', e => {
    const b = e.target.closest('[data-f]');
    if (b) { state.listFilter = b.dataset.f; loadList(); }
  });
  $('#list').addEventListener('click', e => { if (e.target.closest('[data-goto]')) $('#tabs [data-tab="write"]').click(); });
  document.addEventListener('pr:changed', ev => { if (ev.detail.kind === 'review-deleted') { refreshTabCount(); loadList(); } });

  drawTabs();
  loadList();
  if (location.hash === '#write') setTimeout(() => $('#review-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
}

function drawTabs() {
  const tabs = [['write', '✍️ เขียนรีวิวใหม่'], ['mine', `👤 รีวิวของฉัน (<span data-count="myReviews">${me.counts.myReviews}</span>)`], ['popular', '⭐ รีวิวยอดนิยมและล่าสุด']];
  $('#tabs').innerHTML = tabs.map(([k, l]) => `<button role="tab" aria-selected="${state.tab === k}" class="btn btn-sm ${state.tab === k ? 'btn-ghost' : ''}" style="${state.tab === k ? 'color:var(--blue);border-color:var(--blue-100);background:var(--blue-50)' : 'color:var(--muted)'}" data-tab="${k}">${l}</button>`).join('');
  $('#write-area').innerHTML = state.tab === 'write' ? writeFormHtml() : '';
  if (state.tab === 'write') wireForm();
}

async function refreshTabCount() {
  await refreshCounts();
}

// ================= ฟอร์มเขียนรีวิว =================
function writeFormHtml() {
  return `
  <div class="rc-layout">
    <form class="card card-pad stack" id="review-form" novalidate style="gap:20px;scroll-margin-top:90px">
      <div class="step-head">
        <span class="step-num">1</span>
        <div class="grow"><b style="color:var(--text)">ระบุรายละเอียดการประเมิน</b><div class="xs muted">เลือกประเภทและค้นหาชื่อวิชาหรืออาจารย์ที่คุณต้องการเขียนบันทึก</div></div>
        <span class="pill pill-blue">แบบฟอร์มทางการ</span>
      </div>
      <div class="field">
        <span class="label">คุณต้องการรีวิวสิ่งใด? <span class="req">*</span></span>
        <div class="type-toggle" role="radiogroup">
          <button type="button" data-type="course" role="radio">${icon('menu_book')}<span><b>📚 รายวิชา (Course)</b><small>ประเมินเนื้อหาและรูปแบบการสอน</small></span></button>
          <button type="button" data-type="professor" role="radio">${icon('badge')}<span><b>👨‍🏫 อาจารย์ผู้สอน (Professor)</b><small>ประเมินทักษะและบรรยากาศในห้องเรียน</small></span></button>
        </div>
      </div>
      <div class="field">
        <div class="row-between"><span class="label">เลือกด่วนจากวิชา/อาจารย์ยอดนิยม (Quick Chips):</span><span class="xs" style="color:var(--blue);font-weight:600">คลิกเพื่อเติมข้อมูลทันที</span></div>
        <div class="quick-chips" id="quick"></div>
      </div>
      <div class="field combo">
        <label for="target-q" id="target-label"></label>
        <div class="input-icon">${icon('search')}<input class="input" id="target-q" name="target" autocomplete="off" role="combobox" aria-expanded="false" aria-controls="target-list"></div>
        <div class="combo-list" id="target-list" role="listbox" hidden></div>
        <div id="target-chosen"></div>
        <p class="field-error" data-error="target" hidden></p>
      </div>
      <div class="card row-between wrap" style="padding:16px 18px;background:var(--bg)">
        <div><div class="row semibold" style="color:var(--text)">${icon('star', 'fill')} คะแนนความพึงพอใจโดยรวม <span class="req">*</span></div><div class="xs muted" id="star-hint">คลิกที่ดาวเพื่อกำหนดคะแนน (1 ถึง 5 ดาว)</div></div>
        <div class="row card" style="padding:6px 14px;gap:12px">
          <div class="star-input" id="stars" role="radiogroup" aria-label="คะแนน">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-star="${n}" role="radio" aria-label="${n} ดาว">★</button>`).join('')}</div>
          <b id="star-val" style="color:var(--text);min-width:70px">– / 5.0</b>
        </div>
        <p class="field-error" data-error="rating" hidden style="width:100%"></p>
      </div>
      <div class="field">
        <label for="headline">หัวข้อรีวิวสั้นๆ (Review Headline) <span class="req">*</span></label>
        <input class="input" id="headline" name="headline" maxlength="120" placeholder="เช่น เนื้อหาสนุก อาจารย์สอนเข้าใจง่าย มีประโยชน์มาก...">
        <p class="field-error" data-error="headline" hidden></p>
      </div>
      <div class="field">
        <div class="row-between"><label for="content">รายละเอียดความคิดเห็น (Detailed Review) <span class="req">*</span></label><span class="xs faint" id="content-count">0 / 600 ตัวอักษร</span></div>
        <textarea class="textarea" id="content" name="content" maxlength="600" rows="5" placeholder="เขียนแชร์สิ่งที่ชอบ วิธีการเตรียมตัว แนวข้อสอบ หรือภาระงานที่ได้รับมอบหมาย..."></textarea>
        <p class="field-error" data-error="content" hidden></p>
      </div>
      <div class="grid grid-fields" style="gap:12px">
        <div class="field"><label for="grade">เกรดที่ได้ (ไม่บังคับ)</label>
          <select class="select" id="grade" name="grade" style="height:44px"><option value="">ไม่ระบุ</option>${['A', 'B+', 'B', 'C+', 'C', 'D+', 'D', 'F', 'S', 'W'].map(g => `<option>${g}</option>`).join('')}</select></div>
        <div class="field"><label for="term">ภาคเรียนที่เรียน (ไม่บังคับ)</label><input class="input" id="term" name="term" placeholder="เช่น ภาคเรียน 1/2567" maxlength="40"></div>
        <div class="field"><label for="tip">เคล็ดลับ (ไม่บังคับ)</label><input class="input" id="tip" name="tip" placeholder="เช่น ส่งแล็บให้ครบทุกสัปดาห์" maxlength="200"></div>
      </div>
      <label class="switch-row">
        ${icon('shield')}
        <div class="grow"><div class="semibold" style="color:var(--text)">โพสต์แบบไม่ระบุชื่อ (Anonymous Review)</div><div class="xs muted">ซ่อนรหัสนักศึกษาของคุณในการแสดงผลสาธารณะ</div></div>
        <span class="switch"><input type="checkbox" name="anonymous" id="anonymous"><span></span></span>
      </label>
      <div class="row" style="border-top:1px solid var(--border);padding-top:18px;gap:12px">
        <button type="button" class="btn btn-ghost" id="clear">${icon('restart_alt', 'sm')} ล้างข้อมูล</button>
        <button type="submit" class="btn btn-primary" id="submit">${icon('send', 'sm')} บันทึกและโพสต์รีวิวทันที</button>
      </div>
    </form>
    <aside class="stack" style="gap:20px;position:sticky;top:88px">
      <div class="card card-pad">
        <div class="row-between" style="background:var(--bg);border:1px solid var(--border);border-radius:var(--r-md);padding:10px 12px">
          <span class="row small semibold" style="color:var(--text)">${icon('visibility', 'sm')} ตัวอย่างการแสดงผลรีวิว (Live Preview)</span><span class="pill pill-blue pill-live">สด</span>
        </div>
        <div class="card mt-3" style="padding:16px" id="preview"></div>
      </div>
      <div class="card card-pad guide">
        <h3 class="row" style="font-size:15px">${icon('lightbulb', 'fill')} แนวทางการเขียนรีวิวที่สร้างสรรค์</h3>
        <ul>
          <li><span style="color:var(--blue)">${icon('check_circle', 'sm fill')}</span> เน้นเล่าข้อเท็จจริง เช่น วิธีการตัดเกรด การมีส่วนร่วมในห้อง และปริมาณการบ้าน</li>
          <li><span style="color:var(--blue)">${icon('check_circle', 'sm fill')}</span> แนะนำเทคนิคหรือสิ่งที่ควรอ่านเตรียมล่วงหน้า เพื่อประโยชน์สูงสุดของรุ่นน้อง</li>
          <li><span style="color:var(--red)">${icon('cancel', 'sm fill')}</span> หลีกเลี่ยงการใช้ถ้อยคำหยาบคาย เสียดสี ลบหลู่ หรือการโจมตีบุคคลอย่างไม่เป็นธรรม</li>
        </ul>
      </div>
    </aside>
  </div>`;
}

function wireForm() {
  const form = $('#review-form');
  const qInput = $('#target-q');
  const list = $('#target-list');
  let focus = -1;

  const setType = (type, keepTarget = false) => {
    state.type = type;
    if (!keepTarget) state.target = null;
    $$('[data-type]', form).forEach(b => { b.classList.toggle('on', b.dataset.type === type); b.setAttribute('aria-checked', b.dataset.type === type); });
    $('#target-label').innerHTML = type === 'course'
      ? 'รหัสวิชาหรือชื่อรายวิชา <span class="req">*</span>'
      : 'ชื่ออาจารย์ผู้สอน / ภาควิชา <span class="req">*</span>';
    qInput.placeholder = type === 'course' ? 'เช่น CS 201 โครงสร้างข้อมูลและอัลกอริทึม' : 'เช่น รศ.ดร. ธีรภัทร สมบูรณ์ หรือ ภาควิชา';
    const quick = type === 'course'
      ? ['CS 201', 'CS 490', 'WEB 201', 'ART 220', 'DATA 101', 'MUS 110']
      : ['sarah', 'david', 'montri', 'theeraphat-s', 'napaporn', 'wanwipa'];
    $('#quick').innerHTML = quick.map(id => catalog[type].find(x => x.id === id)).filter(Boolean)
      .map(x => `<button type="button" data-quick="${esc(x.id)}">${type === 'course' ? '📗' : '👤'} ${esc(type === 'course' ? x.label.split(' ').slice(0, 3).join(' ') : x.label)}</button>`).join('');
    drawChosen();
    preview();
  };

  const drawChosen = () => {
    const t = state.target;
    qInput.parentElement.hidden = !!t;
    $('#target-chosen').innerHTML = t ? `
      <div class="row card" style="padding:10px 12px;border-color:var(--blue-100);background:var(--blue-50)">
        ${state.type === 'professor' ? avatar(t.label, t.photo, 'sm') : `<span class="avatar sm sq" style="background:#fff;color:var(--blue)">${icon('menu_book', 'sm')}</span>`}
        <div class="grow"><b style="color:var(--text)">${esc(t.label)}</b><div class="xs muted">${esc(t.sub)}</div></div>
        <button type="button" class="btn btn-ghost btn-xs" id="change-target">เปลี่ยน</button>
      </div>` : '';
    if (t) $('#change-target').onclick = () => { state.target = null; drawChosen(); preview(); qInput.focus(); };
  };

  const showList = () => {
    const q = qInput.value.trim().toLowerCase().replace(/\s+/g, '');
    const items = catalog[state.type].filter(x => (x.label + x.sub).toLowerCase().replace(/\s+/g, '').includes(q)).slice(0, 12);
    list.innerHTML = items.length
      ? items.map((x, i) => `<button type="button" role="option" data-pick="${esc(x.id)}" data-i="${i}"><b>${esc(x.label)}</b><small>${esc(x.sub)}</small></button>`).join('')
      : '<div class="small muted" style="padding:10px">ไม่พบรายการ — ลองพิมพ์รหัสวิชาหรือชื่ออื่น</div>';
    list.hidden = false;
    qInput.setAttribute('aria-expanded', 'true');
    focus = -1;
  };
  const hideList = () => { list.hidden = true; qInput.setAttribute('aria-expanded', 'false'); };
  const pick = id => {
    state.target = catalog[state.type].find(x => x.id === id) || null;
    qInput.value = '';
    hideList();
    showFieldErrors(form, {});
    drawChosen();
    preview();
  };

  qInput.addEventListener('focus', showList);
  qInput.addEventListener('input', showList);
  qInput.addEventListener('keydown', e => {
    const opts = $$('[data-pick]', list);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!opts.length) return;
      focus = (focus + (e.key === 'ArrowDown' ? 1 : -1) + opts.length) % opts.length;
      opts.forEach((o, i) => o.classList.toggle('focused', i === focus));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (opts[focus >= 0 ? focus : 0]) pick(opts[focus >= 0 ? focus : 0].dataset.pick);
    } else if (e.key === 'Escape') hideList();
  });
  list.addEventListener('mousedown', e => { const b = e.target.closest('[data-pick]'); if (b) { e.preventDefault(); pick(b.dataset.pick); } });
  document.addEventListener('click', e => { if (!e.target.closest('.combo')) hideList(); });

  form.addEventListener('click', e => {
    const t = e.target.closest('[data-type],[data-quick],[data-star]');
    if (!t) return;
    if (t.dataset.type) setType(t.dataset.type);
    else if (t.dataset.quick) pick(t.dataset.quick);
    else if (t.dataset.star) setRating(Number(t.dataset.star));
  });
  const setRating = n => {
    state.rating = n;
    $$('[data-star]', form).forEach(b => { const on = Number(b.dataset.star) <= n; b.classList.toggle('on', on); b.setAttribute('aria-checked', Number(b.dataset.star) === n); });
    $('#star-val').textContent = `${n}.0 / 5.0`;
    $('#star-hint').textContent = STAR_HINTS[n];
    preview();
  };
  form.addEventListener('input', e => {
    if (e.target.id === 'content') $('#content-count').textContent = `${e.target.value.length} / 600 ตัวอักษร`;
    preview();
  });
  $('#clear').addEventListener('click', () => {
    form.reset();
    state.target = null; state.rating = 0;
    $$('[data-star]', form).forEach(b => b.classList.remove('on'));
    $('#star-val').textContent = '– / 5.0';
    $('#star-hint').textContent = 'คลิกที่ดาวเพื่อกำหนดคะแนน (1 ถึง 5 ดาว)';
    $('#content-count').textContent = '0 / 600 ตัวอักษร';
    showFieldErrors(form, {});
    drawChosen(); preview();
  });
  form.addEventListener('submit', submit);

  // เติมข้อมูลจาก URL เช่น /reviews.html?type=course&id=CS%20201
  setType(state.type, true);
  const pre = params.get('id');
  if (pre) pick(pre);
}

function preview() {
  const f = $('#review-form');
  if (!f) return;
  const t = state.target;
  const head = f.headline.value.trim();
  const body = f.content.value.trim();
  $('#preview').innerHTML = `
    <div class="row-between"><span class="pill ${state.type === 'course' ? 'pill-blue' : 'pill-amber'}">${state.type === 'course' ? '📘 วิชา' : '👤 อาจารย์'}</span>${state.rating ? `<span class="rating-badge">${state.rating}.0</span>` : '<span class="xs faint">ยังไม่ให้คะแนน</span>'}</div>
    <h4 class="mt-2">${esc(t ? t.label : 'ชื่อรายวิชาหรืออาจารย์')}</h4>
    <div class="xs muted">${esc(t ? t.sub : 'อาจารย์ผู้สอนหรือภาควิชา')}</div>
    ${state.rating ? `<div class="mt-1">${stars(state.rating)}</div>` : ''}
    <p class="semibold mt-3" style="color:var(--text)">“${esc(head || 'หัวข้อสรุปจะแสดงตรงนี้...')}”</p>
    <p class="small muted mt-1 clamp-3">${esc(body || 'ข้อความรีวิวแบบละเอียดที่คุณพิมพ์ในแบบฟอร์มจะปรากฏตัวอย่างจำลองในกล่องนี้แบบเรียลไทม์...')}</p>
    <div class="row-between mt-3 xs faint" style="border-top:1px solid var(--subtle);padding-top:10px">
      <span class="row">${icon('badge', 'sm')} ${f.anonymous.checked ? 'ไม่ระบุตัวตน' : 'นักศึกษา ' + esc(me.studentId)}</span><span>วันนี้</span>
    </div>`;
}

async function submit(e) {
  e.preventDefault();
  const f = e.target;
  const body = {
    targetType: state.type, targetId: state.target?.id, rating: state.rating,
    headline: f.headline.value, content: f.content.value, grade: f.grade.value, term: f.term.value, tip: f.tip.value,
    anonymous: f.anonymous.checked,
  };
  const errs = {};
  if (!body.targetId) errs.target = state.type === 'course' ? 'กรุณาเลือกรายวิชาจากรายการ' : 'กรุณาเลือกอาจารย์จากรายการ';
  if (!body.rating) errs.rating = 'กรุณาให้คะแนน 1-5 ดาว';
  if (body.headline.trim().length < 3) errs.headline = 'กรุณาใส่หัวข้อรีวิว (อย่างน้อย 3 ตัวอักษร)';
  if (body.content.trim().length < 10) errs.content = 'กรุณาเขียนรายละเอียดอย่างน้อย 10 ตัวอักษร';
  showFieldErrors(f, errs);
  if (Object.keys(errs).length) { toast('กรุณากรอกข้อมูลให้ครบถ้วน', 'error'); return; }
  const btn = $('#submit');
  btn.disabled = true;
  try {
    await api('/reviews', { method: 'POST', body });
    $('#clear').click();
    await refreshCounts();
    loadList();
    const m = openModal(`
      <div class="confirm-body">
        <div class="confirm-icon" style="background:var(--green-50);color:var(--green)">${icon('check_circle', 'lg fill')}</div>
        <h3 style="font-size:18px">เผยแพร่รีวิวของคุณสู่สาธารณะเรียบร้อยแล้ว! 🎉</h3>
        <p class="muted">ความคิดเห็นของคุณถูกบันทึกลงสู่ระบบ ProfReview พร้อมช่วยเหลือนักศึกษารุ่นต่อไปในการเลือกเรียน</p>
      </div>
      <div class="modal-foot" style="justify-content:center;background:#fff;border:0;padding-bottom:22px">
        <button class="btn btn-ghost" data-close>ตกลง / ปิดหน้าต่าง</button>
        <button class="btn btn-primary" data-mine>${icon('rate_review', 'sm')} ไปดูรีวิวของฉันทันที</button>
      </div>`, { size: 'sm', label: 'โพสต์รีวิวสำเร็จ' });
    $('[data-mine]', m.el).onclick = () => { m.close(); $('#tabs [data-tab="mine"]').click(); scrollTo({ top: 0, behavior: 'smooth' }); };
  } catch (err) {
    showFieldErrors(f, err.fields);
    toast(err.message, 'error');
  } finally { btn.disabled = false; }
}

// ================= รายการรีวิว =================
async function loadList() {
  const filters = [['all', 'ทั้งหมด'], ['course', 'เฉพาะรายวิชา'], ['professor', 'เฉพาะอาจารย์']];
  $('#list-filter').innerHTML = filters.map(([k, l]) => `<button class="${state.listFilter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('');
  const titles = {
    write: ['รีวิวที่เพิ่งเผยแพร่ล่าสุด', 'ตรวจสอบความคิดเห็นทั้งหมดที่คุณและเพื่อนนักศึกษาได้ร่วมกันแบ่งปันไว้ในระบบ'],
    mine: ['รีวิวของฉัน (My Reviews)', 'จัดการ ตรวจสอบ หรือลบความคิดเห็นการเรียนการสอนที่คุณเคยส่งเข้าระบบ'],
    popular: ['รีวิวยอดนิยม', 'รีวิวที่ได้รับการโหวตว่ามีประโยชน์มากที่สุดจากเพื่อนนักศึกษา'],
  };
  $('#list-title').textContent = titles[state.tab][0];
  $('#list-sub').textContent = titles[state.tab][1];
  $('#list').innerHTML = '<div class="skeleton" style="height:260px"></div>'.repeat(3);
  const reviews = await api('/reviews' + qs({
    scope: state.tab === 'mine' ? 'mine' : '', type: state.listFilter === 'all' ? '' : state.listFilter,
    sort: state.tab === 'popular' ? 'helpful' : '', limit: state.tab === 'mine' ? 60 : 12,
  }));
  rememberReviews(reviews);
  $('#list').innerHTML = reviews.length
    ? reviews.map(r => reviewCard(r)).join('')
    : `<div class="card empty" style="grid-column:1/-1">${icon('rate_review')}<h4>${state.tab === 'mine' ? 'คุณยังไม่มีรีวิวในหมวดนี้' : 'ยังไม่มีรีวิว'}</h4>
       ${state.tab === 'mine' ? '<p class="mt-2"><button class="btn btn-accent btn-sm" data-goto="write">เขียนรีวิวแรกของคุณ</button></p>' : ''}</div>`;
}
