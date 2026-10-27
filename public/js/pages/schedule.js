// หน้าแบบจำลองตารางเรียน
import { api } from '../api.js';
import { $, esc, icon, toast, confirmDialog, fmtRating } from '../ui.js';
import { mountLayout } from '../layout.js';

const DAYS = [['Mon', 'จันทร์'], ['Tue', 'อังคาร'], ['Wed', 'พุธ'], ['Thu', 'พฤหัส'], ['Fri', 'ศุกร์']];
const START = 8;
const END = 18;
const fmtTime = h => `${String(Math.floor(h)).padStart(2, '0')}:${h % 1 ? '30' : '00'}`;
const overlaps = (a, b) => a.day === b.day && a.start < b.start + b.duration && b.start < a.start + a.duration;

let data = { sections: [], selected: [], maxCredits: 22 };
let listTab = 'all';
let poolQuery = '';

const me = await mountLayout('schedule');
if (me) init();

async function init() {
  $('#main').innerHTML = `
    <div class="page-head">
      <div>
        <div class="crumbs"><a href="/">แผงควบคุม</a>${icon('chevron_right')}<b>แบบจำลองตารางเรียน</b></div>
        <h1 class="page-title">ระบบแบบจำลองตารางเรียน <span class="pill pill-blue">ภาคเรียนที่ 2/2567</span></h1>
        <p class="muted mt-1">จัดแผนการเรียนภาคเรียนที่ 2/2567 — เลือกและทดลองจัดวิชาเลือกให้ลงตัวก่อนลงทะเบียนจริง</p>
      </div>
      <div class="row no-print">
        <button class="btn btn-ghost" id="reset">${icon('restart_alt', 'sm')} รีเซ็ตตารางเริ่มต้น</button>
        <button class="btn btn-accent" id="export">${icon('download', 'sm')} ส่งออกตารางเรียน (PDF)</button>
      </div>
    </div>
    <section class="kpis" id="kpis"></section>
    <div class="sched-layout">
      <div class="stack" style="gap:24px">
        <section class="card card-pad">
          <div class="row-between wrap">
            <div class="row"><span class="kpi"><span class="ico">${icon('table_view', 'sm')}</span></span>
              <div><h2 style="font-size:17px">ตารางเรียนประจำสัปดาห์ (Weekly Timetable)</h2><p class="small muted">ช่วงเวลา 08:00 - 18:00 น. (จันทร์ - ศุกร์)</p></div></div>
            <div class="row wrap small">
              <span class="pill pill-slate"><span style="width:8px;height:8px;border-radius:50%;background:var(--navy-900)"></span> วิชาบังคับ</span>
              <span class="pill pill-blue"><span style="width:8px;height:8px;border-radius:50%;background:var(--blue)"></span> วิชาเลือก (ถอดได้)</span>
            </div>
          </div>
          <div class="timetable-scroll mt-4"><div class="timetable" id="timetable"></div></div>
          <p class="small muted mt-3 row">${icon('info', 'sm')} คลิกที่บล็อกรายวิชาเพื่อดูรายละเอียดวิชา รีวิว และอาจารย์ผู้สอน</p>
        </section>
        <section class="card card-pad">
          <div class="row-between wrap"><h2 class="section-title" style="font-size:16px">${icon('insights')} บทวิเคราะห์ความสมดุลของตารางเรียนคุณ</h2><span class="xs faint">คำนวณจากรีวิวความยากและภาระงาน</span></div>
          <div class="analysis mt-4" id="analysis"></div>
        </section>
      </div>
      <div class="stack no-print sched-side" style="gap:24px">
        <section class="card card-pad">
          <div class="row-between"><h2 class="row" style="font-size:16px">${icon('checklist')} วิชาในตารางของคุณ</h2><span class="pill pill-blue" id="mine-count"></span></div>
          <p class="xs muted mt-1">กดถอดวิชาเลือกเพื่อสลับวิชาใหม่ได้ทันที</p>
          <div class="seg mt-3" id="list-tabs" style="width:100%"></div>
          <div class="stack mt-3" style="gap:10px" id="mine"></div>
        </section>
        <section class="card card-pad">
          <div class="row-between"><h2 class="row" style="font-size:16px">${icon('add_circle')} คลังวิชาเลือกที่เปิดรับ</h2><span class="pill pill-green">เทอม 2/2567</span></div>
          <p class="xs muted mt-1">กด “+ เพิ่มเข้าตาราง” เพื่อทดลองจัดตารางใหม่</p>
          <div class="input-icon mt-3">${icon('search')}<input class="input" id="pool-q" type="search" placeholder="ค้นหารหัสวิชา หรือชื่อวิชา..." style="height:38px"></div>
          <div class="stack mt-3" style="gap:10px" id="pool"></div>
        </section>
      </div>
    </div>`;

  $('#reset').addEventListener('click', async () => {
    const ok = await confirmDialog({ title: 'รีเซ็ตตารางเรียน?', message: 'ตารางจะกลับเป็นวิชาบังคับ + วิชาเลือกเริ่มต้น และลบวิชาที่คุณเพิ่มเอง', confirmText: 'รีเซ็ต', iconName: 'restart_alt' });
    if (!ok) return;
    await api('/schedule/reset', { method: 'POST' });
    toast('รีเซ็ตตารางเรียนเรียบร้อยแล้ว');
    load();
  });
  $('#export').addEventListener('click', () => window.print());
  $('#pool-q').addEventListener('input', e => { poolQuery = e.target.value.trim().toLowerCase().replace(/\s+/g, ''); drawPool(); });
  document.addEventListener('click', onClick);
  load();
}

async function load() {
  data = await api('/schedule');
  draw();
}

const mine = () => data.sections.filter(s => data.selected.includes(s.id));

function draw() {
  const sel = mine();
  const credits = sel.reduce((n, s) => n + s.credits, 0);
  const compCredits = sel.filter(s => s.compulsory).reduce((n, s) => n + s.credits, 0);
  const days = new Set(sel.map(s => s.day));
  const clashes = sel.filter(a => sel.some(b => a !== b && overlaps(a, b)));

  $('#kpis').innerHTML = `
    <div class="card kpi"><div class="top"><span class="lbl">หน่วยกิตสะสมที่ลงทะเบียน</span><span class="ico">${icon('credit_card', 'sm')}</span></div>
      <div class="val">${credits} <small>/ ${data.maxCredits} หน่วยกิตสูงสุด</small></div>
      <div class="credit-bar"><span style="width:${(compCredits / data.maxCredits) * 100}%"></span><span style="width:${((credits - compCredits) / data.maxCredits) * 100}%"></span></div>
      <div class="sub">● บังคับ ${compCredits} นก. <span style="color:var(--blue)">● เลือก ${credits - compCredits} นก.</span> • คงเหลือ ${data.maxCredits - credits} นก.</div></div>
    <div class="card kpi"><div class="top"><span class="lbl">จำนวนรายวิชาที่จัด</span><span class="ico">${icon('menu_book', 'sm')}</span></div>
      <div class="val">${sel.length} <small>รายวิชา</small></div>
      <div class="row mt-2"><span class="pill pill-slate">บังคับ ${sel.filter(s => s.compulsory).length} วิชา</span><span class="pill pill-blue">เลือก ${sel.filter(s => !s.compulsory).length} วิชา</span></div></div>
    <div class="card kpi"><div class="top"><span class="lbl">สถานะเวลาเรียน</span><span class="ico" style="${clashes.length ? 'background:var(--red-50);color:var(--red-700)' : 'background:var(--green-50);color:var(--green)'}">${icon(clashes.length ? 'warning' : 'verified', 'sm')}</span></div>
      <div class="val" style="font-size:18px;color:${clashes.length ? 'var(--red-700)' : 'var(--blue)'}">${clashes.length ? `พบเวลาชนกัน ${clashes.length} วิชา` : 'ไม่พบเวลาเรียนชนกัน'}</div>
      <div class="sub">${clashes.length ? 'กรุณาถอดวิชาที่ชนกันออก' : 'ทุกคาบเรียนลงตัว พร้อมสำหรับการลงทะเบียน'}</div></div>
    <div class="card kpi"><div class="top"><span class="lbl">วันที่มีตารางเรียน</span><span class="ico">${icon('calendar_month', 'sm')}</span></div>
      <div class="val">${days.size} วัน <small>(จันทร์ - ศุกร์)</small></div>
      <div class="sub" style="color:var(--green-800)">● ${days.size < 5 ? `ว่าง ${5 - days.size} วันทำการ` : 'เสาร์ - อาทิตย์ เป็นวันหยุดพักผ่อน'}</div></div>`;

  // ---- ตารางรายสัปดาห์ ----
  const hours = [];
  for (let h = START; h < END; h++) hours.push(h);
  $('#timetable').innerHTML = `
    <div class="tt-head"><div>วัน / เวลา</div>${hours.map(h => `<div>${fmtTime(h)}</div>`).join('')}</div>
    ${DAYS.map(([d, th]) => `
      <div class="tt-row">
        <div class="tt-day">${th}<small>${d}</small></div>
        ${hours.map(() => '<div class="tt-cell"></div>').join('')}
        ${sel.filter(s => s.day === d).map(s => `
          <div class="tt-block ${clashes.includes(s) ? 'clash' : ''}" data-open="${esc(s.code)}" role="button" tabindex="0"
               style="background:${s.color};left:calc(80px + ${s.start - START} * var(--hour-w) + 2px);width:calc(${s.duration} * var(--hour-w) - 4px)"
               title="${esc(s.code)} ${esc(s.name)} • ${fmtTime(s.start)}-${fmtTime(s.start + s.duration)}">
            <span class="lock">${s.compulsory ? '🔒 บังคับ' : '✎ เลือก'}</span>
            <div><b>${esc(s.code)}</b><div class="truncate">${esc(s.name)}</div></div>
            <div class="row-between"><span class="truncate">${esc(s.room)}</span><span>${s.credits} นก.</span></div>
          </div>`).join('')}
      </div>`).join('')}`;

  // ---- บทวิเคราะห์ ----
  const withDiff = sel.filter(s => s.difficulty != null);
  const avgDiff = withDiff.length ? withDiff.reduce((n, s) => n + s.difficulty, 0) / withDiff.length : 0;
  const diffLabel = avgDiff < 2.3 ? ['เบาสบาย', 'var(--green-800)'] : avgDiff < 3.3 ? ['ปานกลาง-กำลังดี', '#b45309'] : ['ค่อนข้างหนัก', 'var(--red-700)'];
  let gapSum = 0; let gapDays = 0; let longest = 0;
  DAYS.forEach(([d]) => {
    const list = sel.filter(s => s.day === d).sort((a, b) => a.start - b.start);
    if (!list.length) return;
    gapDays++;
    let run = list[0].duration;
    for (let i = 1; i < list.length; i++) {
      const gap = list[i].start - (list[i - 1].start + list[i - 1].duration);
      gapSum += Math.max(0, gap);
      run = gap <= 0 ? run + list[i].duration : list[i].duration;
      longest = Math.max(longest, run);
    }
    longest = Math.max(longest, run);
  });
  const avgRating = sel.length ? sel.reduce((n, s) => n + (s.rating || 0), 0) / sel.length : 0;
  $('#analysis').innerHTML = `
    <div><div class="lbl">ความยากเฉลี่ยโดยรวม</div><div class="v">${avgDiff.toFixed(1)} / 5.0</div><div class="small" style="color:${diffLabel[1]};font-weight:700">${diffLabel[0]}</div></div>
    <div><div class="lbl">เวลาพักเฉลี่ยต่อวัน</div><div class="v">${(gapDays ? gapSum / gapDays : 0).toFixed(1)} ชั่วโมง</div><div class="small muted">เรียนต่อเนื่องนานสุด ${longest} ชั่วโมงติดกัน</div></div>
    <div><div class="lbl">ความเห็นชุมชนนักศึกษา</div><div class="v" style="color:var(--blue)">${fmtRating(avgRating)} ★</div><div class="small muted">คะแนนรีวิวเฉลี่ยของวิชาในตารางนี้</div></div>`;

  drawMine();
  drawPool();
}

function drawMine() {
  const sel = mine();
  $('#mine-count').textContent = `${sel.length} วิชา`;
  const tabs = [['all', `ทั้งหมด (${sel.length})`], ['comp', `วิชาบังคับ (${sel.filter(s => s.compulsory).length})`], ['elec', `วิชาเลือก (${sel.filter(s => !s.compulsory).length})`]];
  $('#list-tabs').innerHTML = tabs.map(([k, l]) => `<button class="${listTab === k ? 'on' : ''}" data-tab="${k}">${l}</button>`).join('');
  const shown = sel.filter(s => listTab === 'all' || (listTab === 'comp' ? s.compulsory : !s.compulsory));
  $('#mine').innerHTML = shown.map(s => `
    <div class="sched-item">
      <span class="bar" style="background:${s.color}"></span>
      <div class="grow">
        <div class="row-between"><span class="row" style="gap:6px"><b style="color:var(--text)">${esc(s.code)}</b>
          <span class="pill ${s.compulsory ? 'pill-slate' : 'pill-blue'}">${s.compulsory ? 'วิชาบังคับ' : 'วิชาเลือก'}</span></span>${s.rating ? `<span class="rating-badge" style="font-size:11.5px">${fmtRating(s.rating)}</span>` : ''}</div>
        <div class="small semibold truncate" style="color:var(--text-body)">${esc(s.name)}</div>
        <div class="xs muted row" style="gap:10px;margin-top:2px">${icon('schedule', 'sm')} ${s.dayTh} ${fmtTime(s.start)}-${fmtTime(s.start + s.duration)} ${icon('location_on', 'sm')} ${esc(s.room)}</div>
      </div>
      ${s.compulsory ? `<span class="xs faint" title="วิชาบังคับไม่สามารถถอนได้">${icon('lock', 'sm')}</span>`
        : `<button class="btn btn-danger btn-xs" data-remove="${s.id}" style="align-self:center">${icon('delete', 'sm')} ถอดออก</button>`}
    </div>`).join('') || '<p class="small muted">ยังไม่มีวิชาในหมวดนี้</p>';
}

function drawPool() {
  const sel = mine();
  const credits = sel.reduce((n, s) => n + s.credits, 0);
  const pool = data.sections.filter(s => !data.selected.includes(s.id) && !s.compulsory)
    .filter(s => !poolQuery || (s.code + s.name + (s.nameEn || '')).toLowerCase().replace(/\s+/g, '').includes(poolQuery));
  $('#pool').innerHTML = pool.map(s => {
    const clash = sel.find(x => overlaps(x, s));
    const over = credits + s.credits > data.maxCredits;
    const reason = clash ? `ชนกับ ${clash.code}` : over ? 'หน่วยกิตเกิน' : '';
    return `
    <div class="sched-item">
      <span class="bar" style="background:${s.color}"></span>
      <div class="grow">
        <div class="row" style="gap:6px"><b style="color:var(--text)">${esc(s.code)}</b><span class="pill pill-slate">${s.credits} หน่วยกิต</span>${s.rating ? `<span class="rating-badge" style="font-size:11px">${fmtRating(s.rating)}</span>` : ''}</div>
        <button class="small semibold truncate" style="color:var(--text-body);display:block;max-width:100%;text-align:left" data-action="open-course" data-id="${esc(s.code)}">${esc(s.name)}</button>
        <div class="xs muted row" style="gap:6px;margin-top:2px">${icon('schedule', 'sm')} ${s.dayTh} ${fmtTime(s.start)}-${fmtTime(s.start + s.duration)}</div>
        <div class="xs muted row" style="gap:6px">${icon('person', 'sm')} ${esc(s.instructor)}</div>
      </div>
      <div style="align-self:center;text-align:right">
        <button class="btn btn-accent btn-xs" data-add="${s.id}" ${reason ? 'disabled' : ''}>${icon('add', 'sm')} เพิ่มเข้าตาราง</button>
        ${reason ? `<div class="xs" style="color:var(--red-700);margin-top:4px;font-weight:600">${reason}</div>` : ''}
      </div>
    </div>`;
  }).join('') || '<p class="small muted">ไม่พบวิชาเลือกที่ตรงกับคำค้นหา หรือคุณเพิ่มครบทุกวิชาแล้ว</p>';
}

async function onClick(e) {
  const t = e.target.closest('[data-tab],[data-remove],[data-add],[data-open]');
  if (!t) return;
  try {
    if (t.dataset.tab) { listTab = t.dataset.tab; drawMine(); }
    else if (t.dataset.remove) {
      await api('/schedule/' + t.dataset.remove, { method: 'DELETE' });
      toast('ถอดวิชาออกจากตารางแล้ว');
      await load();
    } else if (t.dataset.add) {
      await api('/schedule', { method: 'POST', body: { sectionId: Number(t.dataset.add) } });
      toast('เพิ่มวิชาเข้าตารางเรียบร้อยแล้ว');
      await load();
    } else if (t.dataset.open) {
      const { openCourseModal } = await import('../components.js');
      openCourseModal(t.dataset.open);
    }
  } catch (err) { toast(err.message, 'error'); }
}
document.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.open) e.target.click(); });
