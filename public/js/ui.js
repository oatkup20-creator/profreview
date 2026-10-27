// ตัวช่วยด้าน UI ที่ใช้ร่วมกันทุกหน้า
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC[c]);

export const icon = (name, cls = '') => `<span class="icon ${cls}" aria-hidden="true">${name}</span>`;

export const CATEGORIES = {
  ge: 'หมวดศึกษาทั่วไป (GE)',
  scitech: 'หมวดวิทย์-เทคโนโลยี',
  humansoc: 'หมวดมนุษยศาสตร์',
  free: 'วิชาเลือกเสรี',
};
export const FACULTIES = {
  sci: 'คณะวิทยาศาสตร์',
  eng: 'คณะวิศวกรรมศาสตร์',
  arts: 'คณะศิลปศาสตร์',
  biz: 'คณะบริหารธุรกิจ',
};

export function stars(rating, max = 5) {
  const full = Math.round(rating || 0);
  return `<span class="stars" aria-label="${rating} จาก ${max} ดาว">${'★'.repeat(full)}<span class="off">${'★'.repeat(Math.max(0, max - full))}</span></span>`;
}
export const fmtRating = r => (r == null ? '–' : Number(r).toFixed(1));
export const ratingBadge = r => `<span class="rating-badge">${fmtRating(r)}</span>`;
export const fmtNum = n => Number(n || 0).toLocaleString('th-TH');

const PALETTE = ['#0f172a', '#1d4ed8', '#0369a1', '#047857', '#7c3aed', '#b45309', '#be123c', '#0f766e'];
export function colorFor(text) {
  let h = 0;
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
export function initials(name) {
  const clean = String(name || '?').replace(/^(ศ\.|รศ\.|ผศ\.|อ\.|ดร\.|Dr\.|Prof\.|Asst\.|Assoc\.|Lect\.|\s|ดร|\.)+/g, '').trim();
  return clean.slice(0, 1).toUpperCase() || '?';
}
/** รูปอาจารย์ (ถ้าโหลดรูปไม่ได้จะสลับเป็นอักษรย่อสีอัตโนมัติ) */
export function avatar(name, photo, cls = '') {
  const fallback = `<span class="avatar ${cls}" style="background:${colorFor(name)}">${esc(initials(name))}</span>`;
  if (!photo) return fallback;
  return `<img class="avatar ${cls}" src="${esc(photo)}" alt="${esc(name)}" loading="lazy" referrerpolicy="no-referrer"
    onerror="this.outerHTML=this.dataset.fb" data-fb="${esc(fallback)}">`;
}

// ---------- วันที่ภาษาไทย ----------
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const parseDate = s => new Date(String(s).includes('T') ? s : String(s).replace(' ', 'T') + (String(s).length > 10 ? 'Z' : 'T00:00:00Z'));
export function thaiDate(s) {
  const d = parseDate(s);
  if (isNaN(d)) return '';
  return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
export function timeAgo(s) {
  const d = parseDate(s);
  const sec = (Date.now() - d) / 1000;
  if (isNaN(sec)) return '';
  if (sec < 60) return 'เมื่อสักครู่';
  if (sec < 3600) return `${Math.floor(sec / 60)} นาทีที่แล้ว`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} ชั่วโมงที่แล้ว`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)} วันที่แล้ว`;
  if (sec < 86400 * 30) return `${Math.floor(sec / 86400 / 7)} สัปดาห์ที่แล้ว`;
  return thaiDate(s);
}

export function debounce(fn, ms = 250) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

// ---------- Toast ----------
export function toast(message, type = 'success') {
  let wrap = $('.toast-wrap');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.className = 'toast-wrap';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(wrap);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icon(type === 'error' ? 'error' : 'check_circle', 'fill')}<span>${esc(message)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}

// ---------- Modal ----------
const openStack = [];
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && openStack.length) openStack[openStack.length - 1].close();
});

/**
 * เปิดหน้าต่าง modal
 * @param {string} html เนื้อหาภายใน .modal
 * @param {{size?: 'sm'|'md'|'', label?: string, onClose?: Function}} opts
 */
export function openModal(html, { size = '', label = 'หน้าต่าง', onClose } = {}) {
  const prevFocus = document.activeElement;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(label)}">${html}</div>`;
  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  const el = $('.modal', backdrop);
  const handle = {
    el,
    close() {
      const i = openStack.indexOf(handle);
      if (i === -1) return;
      openStack.splice(i, 1);
      backdrop.remove();
      if (!openStack.length) document.body.style.overflow = '';
      if (prevFocus && prevFocus.focus) prevFocus.focus();
      onClose && onClose();
    },
  };
  openStack.push(handle);
  backdrop.addEventListener('mousedown', e => { if (e.target === backdrop) handle.close(); });
  el.addEventListener('click', e => { if (e.target.closest('[data-close]')) handle.close(); });
  const first = el.querySelector('[autofocus], input, textarea, button:not(.modal-close)');
  setTimeout(() => (first || el).focus && (first || el).focus(), 30);
  return handle;
}
export const closeAllModals = () => [...openStack].reverse().forEach(m => m.close());

export function confirmDialog({ title, message, confirmText = 'ยืนยัน', danger = false, iconName = 'help' }) {
  return new Promise(resolve => {
    let ok = false;
    const m = openModal(`
      <div class="confirm-body">
        <div class="confirm-icon" style="background:${danger ? 'var(--red-50)' : 'var(--blue-50)'};color:${danger ? 'var(--red-700)' : 'var(--blue)'}">${icon(iconName, 'lg')}</div>
        <h3 style="font-size:18px">${esc(title)}</h3>
        <p class="muted">${esc(message)}</p>
      </div>
      <div class="modal-foot" style="justify-content:center;background:#fff;border:0;padding-bottom:22px">
        <button class="btn btn-ghost" data-close>ยกเลิก</button>
        <button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-ok>${esc(confirmText)}</button>
      </div>`, { size: 'sm', label: title, onClose: () => resolve(ok) });
    $('[data-ok]', m.el).addEventListener('click', () => { ok = true; m.close(); });
  });
}

/** แสดงข้อความผิดพลาดใต้ช่องกรอกตาม fields ที่ server ส่งกลับมา */
export function showFieldErrors(form, fields = {}) {
  $$('.field-error', form).forEach(e => { e.textContent = ''; e.hidden = true; });
  $$('.invalid', form).forEach(e => e.classList.remove('invalid'));
  Object.entries(fields).forEach(([name, msg]) => {
    const err = $(`[data-error="${name}"]`, form);
    if (err) { err.textContent = '❌ ' + msg; err.hidden = false; }
    const input = $(`[name="${name}"]`, form);
    if (input && input.classList) input.classList.add('invalid');
  });
}

export function pager(container, { page, pages, total, limit, unit }, onGo) {
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (pages <= 7 || i === 1 || i === pages || Math.abs(i - page) <= 1) nums.push(i);
    else if (nums[nums.length - 1] !== '…') nums.push('…');
  }
  container.innerHTML = `
    <span class="small muted">แสดง <b>${from} - ${to}</b> จากทั้งหมด <b>${total}</b> ${unit}</span>
    <div class="pager-btns">
      <button data-p="${page - 1}" ${page <= 1 ? 'disabled' : ''} aria-label="ก่อนหน้า">${icon('chevron_left', 'sm')}</button>
      ${nums.map(n => (n === '…' ? '<button disabled>…</button>' : `<button data-p="${n}" class="${n === page ? 'on' : ''}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`)).join('')}
      <button data-p="${page + 1}" ${page >= pages ? 'disabled' : ''} aria-label="ถัดไป">${icon('chevron_right', 'sm')}</button>
    </div>`;
  container.onclick = e => {
    const b = e.target.closest('[data-p]');
    if (b && !b.disabled) onGo(Number(b.dataset.p));
  };
}
