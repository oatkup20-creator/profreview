// โครงหน้าเว็บที่ใช้ร่วมกัน: แถบด้านบน, เมนูด้านข้าง, ส่วนท้าย, การแจ้งเตือน, ค้นหา, ออกจากระบบ, ตั้งค่าโปรไฟล์
import { api, qs } from './api.js';
import { $, $$, esc, icon, avatar, ratingBadge, timeAgo, toast, openModal, debounce, confirmDialog } from './ui.js';
import { installGlobalActions } from './components.js';

const NAV = [
  { key: 'dashboard', href: '/', icon: 'grid_view', label: 'แผงควบคุม' },
  { key: 'my-reviews', href: '/reviews.html?tab=mine', icon: 'rate_review', label: 'รีวิวของฉัน', count: 'myReviews' },
  { key: 'saved', href: '/courses.html?saved=1', icon: 'bookmark', label: 'วิชาที่บันทึกไว้', count: 'saved' },
  { key: 'courses', href: '/courses.html', icon: 'menu_book', label: 'รายชื่อวิชา' },
  { key: 'professors', href: '/professors.html', icon: 'person_search', label: 'รายชื่ออาจารย์' },
  { key: 'schedule', href: '/schedule.html', icon: 'calendar_month', label: 'แบบจำลองตารางเรียน', badge: 'ใหม่' },
  { key: 'reviews', href: '/reviews.html', icon: 'edit_note', label: 'ศูนย์เขียนรีวิว' },
];
const TOP_NAV = [
  { key: 'courses', href: '/courses.html', label: 'รายชื่อวิชา' },
  { key: 'professors', href: '/professors.html', label: 'รายชื่ออาจารย์' },
  { key: 'schedule', href: '/schedule.html', label: 'แบบจำลองตารางเรียน' },
  { key: 'reviews', href: '/reviews.html', label: 'ศูนย์รีวิว' },
];
const NOTIF_STYLE = {
  like: ['background:#e0f2fe;color:#0369a1', 'thumb_up'],
  enroll: ['background:#d1fae5;color:#047857', 'how_to_reg'],
  system: ['background:#ede9fe;color:#6d28d9', 'campaign'],
};

export let me = null;

/** เรียกครั้งเดียวต่อหน้า: ตรวจสอบการล็อกอิน แล้ววาดโครงหน้า */
export async function mountLayout(active) {
  installGlobalActions();
  try {
    me = await api('/me');
  } catch { return null; } // api() จะพาไปหน้า login เองเมื่อยังไม่ล็อกอิน

  const shortId = me.studentId;
  $('#topbar').outerHTML = `
  <header class="topbar">
    <div class="topbar-inner">
      <button class="menu-toggle" id="menu-toggle" aria-label="เปิดเมนู">${icon('menu')}</button>
      <a href="/" class="brand" aria-label="ProfReview หน้าแรก">
        <span class="brand-logo">${icon('school', 'fill')}</span>
        <span><span class="brand-name">ProfReview<span class="brand-tag">CMU</span></span><span class="brand-sub">ระบบประเมินอาจารย์ &amp; วางแผนตารางเรียน</span></span>
      </a>
      <nav class="topnav" aria-label="เมนูหลัก">
        ${TOP_NAV.map(n => `<a href="${n.href}" class="${n.key === active ? 'active' : ''}">${n.label}</a>`).join('')}
      </nav>
      <div class="top-search" role="search">
        ${icon('search')}
        <input id="global-search" type="search" placeholder="ค้นหาวิชา อาจารย์ หรือรหัสวิชา" autocomplete="off" aria-label="ค้นหา">
        <kbd>/</kbd>
        <div class="search-results" id="search-results" hidden></div>
      </div>
      <div class="top-actions">
        <div style="position:relative">
          <button class="icon-btn" id="notif-btn" aria-label="การแจ้งเตือน" aria-haspopup="true" aria-expanded="false">
            ${icon('notifications')}<span class="badge-dot" id="notif-badge" ${me.counts.unread ? '' : 'hidden'}>${me.counts.unread}</span>
          </button>
          <div class="dropdown" id="notif-dropdown" hidden></div>
        </div>
        <button class="user-chip" id="profile-btn" aria-label="จัดการโปรไฟล์">
          <span class="avatar sm" style="background:var(--navy-900)">${esc(shortId.slice(0, 2))}</span>
          <span class="who-wrap"><span class="who">${esc(shortId)}</span><span class="pill pill-green pill-live" style="height:18px;font-size:10px">Active</span></span>
        </button>
        <button class="btn-logout" id="logout-btn" aria-label="ออกจากระบบ">${icon('logout', 'sm')}<span>ออกจากระบบ</span></button>
      </div>
    </div>
  </header>`;

  $('#sidebar').outerHTML = `
  <aside class="sidebar" id="sidebar" aria-label="เมนูนักศึกษา">
    <div class="profile-card">
      <div class="row-between"><span class="label">พอร์ทัลนักศึกษา</span><span class="pill pill-green pill-live" style="height:20px;font-size:10px">Active</span></div>
      <div class="sid">รหัสนักศึกษา: ${esc(shortId)}</div>
      <div class="dept" id="side-dept">${esc(me.department || '')}</div>
    </div>
    <nav class="side-nav">
      ${NAV.map(n => `
        <a href="${n.href}" class="${n.key === active ? 'active' : ''}" ${n.key === active ? 'aria-current="page"' : ''}>
          ${icon(n.icon)}<span>${n.label}</span>
          ${n.count ? `<span class="count" data-count="${n.count}">${me.counts[n.count]}</span>` : ''}
          ${n.badge ? `<span class="new">${n.badge}</span>` : ''}
        </a>`).join('')}
      <a href="#" id="side-profile">${icon('manage_accounts')}<span>จัดการโปรไฟล์</span></a>
    </nav>
    <div class="side-foot">
      <a class="btn btn-primary btn-block" href="/reviews.html#write">${icon('edit_square', 'sm')} + เขียนรีวิว</a>
      <div class="term-pill"><span>ภาคเรียนที่ 2/2567</span><span class="pill pill-green">กำลังลงทะเบียน</span></div>
    </div>
  </aside>`;

  $('#footer').outerHTML = `
  <footer class="footer"><div class="footer-inner">
    <span><b style="color:var(--text)">ProfReview</b> © ${new Date().getFullYear()} แพลตฟอร์มแบ่งปันและค้นหารีวิวรายวิชาและคณาจารย์สำหรับนักศึกษา</span>
    <nav><a href="/courses.html">คลังประมวลรายวิชา</a><a href="/reviews.html">แนวทางการเขียนรีวิว</a><a href="#" id="foot-privacy">นโยบายความเป็นส่วนตัว</a></nav>
  </div></footer>`;

  wireMobileMenu();
  wireSearch();
  wireNotifications();
  $('#logout-btn').addEventListener('click', logout);
  $('#profile-btn').addEventListener('click', openProfileModal);
  $('#side-profile').addEventListener('click', e => { e.preventDefault(); openProfileModal(); });
  $('#foot-privacy').addEventListener('click', e => {
    e.preventDefault();
    toast('ข้อมูลรีวิวแบบไม่ระบุตัวตนจะไม่แสดงรหัสนักศึกษาต่อสาธารณะ');
  });
  document.addEventListener('pr:changed', refreshCounts);
  return me;
}

export async function refreshCounts() {
  try {
    me = await api('/me');
    $$('[data-count]').forEach(el => { el.textContent = me.counts[el.dataset.count]; });
    const b = $('#notif-badge');
    b.textContent = me.counts.unread;
    b.hidden = !me.counts.unread;
  } catch { /* เงียบไว้ */ }
}

function wireMobileMenu() {
  const toggle = $('#menu-toggle');
  const close = () => { document.body.classList.remove('nav-open'); $('.scrim')?.remove(); };
  toggle.addEventListener('click', () => {
    document.body.classList.add('nav-open');
    const s = document.createElement('div');
    s.className = 'scrim';
    s.addEventListener('click', close);
    document.body.appendChild(s);
  });
  window.addEventListener('resize', () => { if (innerWidth > 1024) close(); });
}

// ---------- ค้นหาด่วน ----------
function wireSearch() {
  const input = $('#global-search');
  const box = $('#search-results');
  let focus = -1;
  const render = data => {
    const items = [
      ...data.courses.map(c => ({ html: `<span class="avatar sm sq" style="background:var(--blue-50);color:var(--blue)">${icon('menu_book', 'sm')}</span><span class="grow"><b style="color:var(--text)">${esc(c.code)}</b> ${esc(c.titleTh)}<small class="muted" style="display:block">${esc(c.titleEn || '')}</small></span>${ratingBadge(c.rating)}`, action: 'open-course', id: c.code, group: 'รายวิชา' })),
      ...data.professors.map(p => ({ html: `${avatar(p.nameTh, p.photo, 'sm')}<span class="grow"><b style="color:var(--text)">${esc(p.nameTh)}</b><small class="muted" style="display:block">${esc(p.deptLabel || '')}</small></span>${ratingBadge(p.rating)}`, action: 'open-prof', id: p.id, group: 'อาจารย์' })),
    ];
    if (!items.length) { box.innerHTML = `<div class="search-empty">ไม่พบผลลัพธ์สำหรับ “${esc(input.value)}”</div>`; box.hidden = false; return; }
    let last = '';
    box.innerHTML = items.map((it, i) => {
      const head = it.group !== last ? `<h5>${it.group}</h5>` : '';
      last = it.group;
      return `${head}<button class="search-item" data-action="${it.action}" data-id="${esc(it.id)}" data-i="${i}">${it.html}</button>`;
    }).join('') + `<a class="search-item small" style="justify-content:center;color:var(--blue);font-weight:600" href="/courses.html${qs({ q: input.value })}">ดูผลการค้นหาวิชาทั้งหมด →</a>`;
    box.hidden = false;
    focus = -1;
  };
  const run = debounce(async () => {
    const q = input.value.trim();
    if (!q) { box.hidden = true; return; }
    try { render(await api('/search' + qs({ q }))); } catch { /* ignore */ }
  }, 200);
  input.addEventListener('input', run);
  input.addEventListener('focus', () => { if (input.value.trim()) run(); });
  input.addEventListener('keydown', e => {
    const btns = $$('.search-item', box);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      focus = (focus + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
      btns.forEach((b, i) => b.classList.toggle('focused', i === focus));
    } else if (e.key === 'Enter') {
      if (focus >= 0 && btns[focus]) btns[focus].click();
      else location.href = '/courses.html' + qs({ q: input.value.trim() });
    } else if (e.key === 'Escape') { box.hidden = true; input.blur(); }
  });
  box.addEventListener('click', () => { box.hidden = true; });
  document.addEventListener('click', e => { if (!e.target.closest('.top-search')) box.hidden = true; });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); input.focus(); }
  });
}

// ---------- การแจ้งเตือน ----------
function wireNotifications() {
  const btn = $('#notif-btn');
  const dd = $('#notif-dropdown');
  let filter = 'all';
  let list = [];
  const draw = () => {
    const shown = list.filter(n => filter === 'all' || (filter === 'unread' ? n.unread : n.type === filter));
    const unread = list.filter(n => n.unread).length;
    dd.innerHTML = `
      <div class="dropdown-head">
        <div class="row-between"><h4 class="row">${icon('notifications_active', 'sm')} การแจ้งเตือน ${unread ? `<span class="pill pill-blue">${unread} ใหม่</span>` : ''}</h4>
          <button class="btn-text small" data-read-all ${unread ? '' : 'disabled'}>อ่านทั้งหมดแล้ว</button></div>
        <div class="seg mt-2" style="width:100%">
          ${[['all', 'ทั้งหมด'], ['unread', 'ยังไม่อ่าน'], ['like', '👍 ไลค์'], ['enroll', '📚 เปิดรับ']].map(([k, l]) => `<button class="${filter === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}
        </div>
      </div>
      <div class="dropdown-list">
        ${shown.length ? shown.map(n => {
          const [style, ic] = NOTIF_STYLE[n.type] || NOTIF_STYLE.system;
          return `<button class="notif-item ${n.unread ? 'unread' : ''}" data-n="${n.id}" data-code="${esc(n.courseCode || '')}">
            <span class="notif-icon" style="${style}">${icon(n.icon || ic, 'sm')}</span>
            <span class="grow"><span class="notif-title">${esc(n.title)}</span><span class="notif-msg" style="display:block">${esc(n.message)}</span>
            <span class="xs faint">${timeAgo(n.createdAt)}${n.courseCode ? ` • เปิดดูวิชา ${esc(n.courseCode)} →` : ''}</span></span>
          </button>`;
        }).join('') : `<div class="empty" style="padding:28px">${icon('notifications_off')}<p class="mt-2">ไม่มีการแจ้งเตือนในหมวดนี้</p></div>`}
      </div>
      <div class="dropdown-foot"><button class="btn-text small" data-settings>${icon('tune', 'sm')} ตั้งค่าแจ้งเตือน</button><button class="btn-text small" data-close-dd>ปิดหน้าต่าง</button></div>`;
  };
  const open = async () => {
    dd.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    dd.innerHTML = '<div class="skeleton" style="height:180px;margin:12px"></div>';
    try { list = await api('/notifications'); } catch { list = []; }
    draw();
  };
  const close = () => { dd.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', e => { e.stopPropagation(); dd.hidden ? open() : close(); });
  document.addEventListener('click', e => { if (!e.target.closest('#notif-dropdown') && !e.target.closest('#notif-btn')) close(); });
  dd.addEventListener('click', async e => {
    e.stopPropagation();
    const f = e.target.closest('[data-f]');
    if (f) { filter = f.dataset.f; return draw(); }
    if (e.target.closest('[data-read-all]')) {
      await api('/notifications/read-all', { method: 'POST' });
      list.forEach(n => { n.unread = false; });
      draw(); refreshCounts();
      return toast('ทำเครื่องหมายว่าอ่านแล้วทั้งหมด');
    }
    if (e.target.closest('[data-close-dd]')) return close();
    if (e.target.closest('[data-settings]')) { close(); return openProfileModal(); }
    const item = e.target.closest('[data-n]');
    if (item) {
      const n = list.find(x => String(x.id) === item.dataset.n);
      if (n && n.unread) { api(`/notifications/${n.id}/read`, { method: 'POST' }).then(refreshCounts); n.unread = false; draw(); }
      if (item.dataset.code) { close(); import('./components.js').then(m => m.openCourseModal(item.dataset.code)); }
    }
  });
}

// ---------- ออกจากระบบ ----------
async function logout() {
  const ok = await confirmDialog({
    title: 'ต้องการออกจากระบบหรือไม่?',
    message: `ข้อมูลวิชาที่บันทึกไว้และรีวิวของคุณจะถูกเก็บรักษาไว้อย่างปลอดภัยในบัญชีนักศึกษา ${me.studentId}`,
    confirmText: 'ออกจากระบบ', danger: true, iconName: 'logout',
  });
  if (!ok) return;
  await api('/auth/logout', { method: 'POST' });
  location.href = '/login.html?mode=signin';
}

// ---------- ตั้งค่าโปรไฟล์และการแจ้งเตือน ----------
function openProfileModal() {
  const s = me.settings;
  const row = (name, title, desc, on) => `
    <label class="switch-row" style="background:#fff">
      <div class="grow"><div class="semibold" style="color:var(--text)">${title}</div><div class="xs muted">${desc}</div></div>
      <span class="switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span></span></span>
    </label>`;
  const m = openModal(`
    <div class="modal-head">
      <div class="head-icon blue">${icon('tune')}</div>
      <div class="grow"><h2 style="font-size:19px">ตั้งค่าการแจ้งเตือน &amp; โปรไฟล์</h2><p class="small muted">จัดการข้อมูลบัญชีและประเภทการแจ้งเตือนที่ต้องการรับ</p></div>
      <button class="modal-close" data-close aria-label="ปิด">${icon('close')}</button>
    </div>
    <form class="modal-body">
      <div class="card row" style="padding:14px;background:var(--bg)">
        <span class="avatar lg" style="background:var(--navy-900)">🎓</span>
        <div class="grow"><div class="bold" style="color:var(--text)">นักศึกษา (${esc(me.studentId)}) <span class="pill pill-green">ยืนยันตัวตนแล้ว</span></div><div class="small muted">${esc(me.email)}</div></div>
      </div>
      <div class="field"><label for="pf-dept">ภาควิชา / สาขา</label><input id="pf-dept" class="input" name="department" value="${esc(me.department || '')}" maxlength="120"></div>
      <div class="stack" style="gap:10px">
        <h4 style="font-size:14px">การตั้งค่าการแจ้งเตือนเฉพาะบุคคล</h4>
        ${row('notifLike', '👍 แจ้งเตือนเมื่อมีคนกดถูกใจรีวิว', 'แจ้งเตือนทันทีเมื่อเพื่อนนักศึกษาโหวตว่ารีวิวของคุณมีประโยชน์', s.notifLike)}
        ${row('notifEnroll', '📚 แจ้งเตือนเมื่อวิชาที่บันทึกไว้เปิดรับ', 'เมื่อวิชาที่ปักหมุดไว้เปิดรับลงทะเบียนเพิ่ม หรือเปิดเซคชันใหม่', s.notifEnroll)}
        ${row('notifReview', '✨ อัปเดตรีวิวใหม่ในวิชาที่บันทึกไว้', 'เมื่อมีแนวข้อสอบ เคล็ดลับ หรือรีวิวใหม่ในวิชาที่คุณสนใจ', s.notifReview)}
      </div>
    </form>
    <div class="modal-foot" style="justify-content:flex-end">
      <button class="btn btn-ghost" data-close>ยกเลิก</button>
      <button class="btn btn-primary" data-save>บันทึกการตั้งค่า</button>
    </div>`, { size: 'md', label: 'ตั้งค่าโปรไฟล์' });
  $('[data-save]', m.el).addEventListener('click', async () => {
    const f = $('form', m.el);
    const body = {
      department: f.department.value,
      notifLike: f.notifLike.checked, notifEnroll: f.notifEnroll.checked, notifReview: f.notifReview.checked,
    };
    try {
      await api('/me/settings', { method: 'PATCH', body });
      await refreshCounts();
      const d = $('#side-dept'); if (d) d.textContent = me.department;
      m.close();
      toast('บันทึกการตั้งค่าเรียบร้อยแล้ว');
    } catch (e) { toast(e.message, 'error'); }
  });
}
