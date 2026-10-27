// การ์ดและหน้าต่างที่ใช้ซ้ำหลายหน้า: การ์ดวิชา/อาจารย์/รีวิว, รายละเอียดวิชา, รายละเอียดอาจารย์, รายงานรีวิว
import { api } from './api.js';
import {
  $, esc, icon, stars, ratingBadge, fmtRating, fmtNum, avatar, thaiDate, timeAgo,
  toast, openModal, confirmDialog, showFieldErrors, CATEGORIES,
} from './ui.js';

const enc = encodeURIComponent;
export const emitChange = detail => document.dispatchEvent(new CustomEvent('pr:changed', { detail }));

// ================= Cards =================
export function courseCard(c) {
  return `
  <article class="card card-hover course-card" data-action="open-course" data-id="${esc(c.code)}" tabindex="0" aria-label="${esc(c.code)} ${esc(c.titleTh)}">
    <div class="row-between" style="align-items:flex-start">
      <div class="grow">
        <div class="dept truncate">${esc(c.dept || CATEGORIES[c.category] || '')}</div>
        <h3 class="mt-1">${esc(c.code)}: ${esc(c.titleTh)}</h3>
        <div class="en truncate">${esc(c.titleEn || '')}</div>
      </div>
      <div style="text-align:right">${ratingBadge(c.rating)}<div class="xs faint mt-1">${fmtNum(c.reviewCount)} รีวิว</div></div>
    </div>
    <div class="row wrap" style="gap:6px">${(c.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
    ${c.quote ? `<p class="quote clamp-2">“${esc(c.quote)}”</p>` : ''}
    <div class="mini-stats">
      <div><span>ความยาก</span><b>${c.difficulty != null ? c.difficulty.toFixed(1) + ' / 5.0' : '–'}</b></div>
      <div><span>โอกาสได้ A</span><b style="color:var(--green-800)">${c.aRate != null ? c.aRate + '%' : '–'}</b></div>
    </div>
    <div class="card-foot">
      <button class="btn btn-soft btn-sm grow" data-action="open-course" data-id="${esc(c.code)}">ดูรายละเอียด &amp; รีวิว (${fmtNum(c.reviewCount)}) ${icon('arrow_forward', 'sm')}</button>
      <button class="square-btn ${c.saved ? 'on' : ''}" data-action="toggle-save" data-type="course" data-id="${esc(c.code)}" aria-label="บันทึกวิชา" title="${c.saved ? 'ยกเลิกบันทึก' : 'บันทึกวิชา'}">
        ${icon('bookmark', c.saved ? 'fill' : '')}
      </button>
    </div>
  </article>`;
}

export function professorCard(p) {
  return `
  <article class="card card-hover prof-card" data-action="open-prof" data-id="${esc(p.id)}" tabindex="0" aria-label="${esc(p.nameTh)}">
    <div class="row" style="align-items:flex-start;gap:12px">
      ${avatar(p.nameTh, p.photo, 'lg sq')}
      <div class="grow">
        <div class="dept truncate">${esc(p.deptLabel || '')}</div>
        <h3>${esc(p.nameTh)}</h3>
        ${p.nameEn ? `<div class="en truncate">${esc(p.nameEn)}</div>` : ''}
      </div>
      <div class="rating-col">${ratingBadge(p.rating)}<small>${fmtNum(p.reviewCount)} รีวิว</small></div>
    </div>
    <div class="row wrap" style="gap:6px">${(p.tags || []).map(t => `<span class="tag check">${esc(t)}</span>`).join('')}</div>
    ${p.quote ? `<div class="quote-box"><p class="clamp-2">“${esc(p.quote)}”</p></div>` : ''}
    <div>
      <div class="meter-row"><span>ความชัดเจนในการสอน</span><b>${p.stats.clarity}%</b></div>
      <div class="meter"><span style="width:${p.stats.clarity}%"></span></div>
      <div class="meter-row mt-2"><span>ความเป็นมิตร เข้าถึงง่าย</span><b>${p.stats.approach}%</b></div>
      <div class="meter green"><span style="width:${p.stats.approach}%"></span></div>
    </div>
    <div class="card-foot">
      <button class="btn btn-soft btn-sm grow" data-action="open-prof" data-id="${esc(p.id)}">ดูรายละเอียดอาจารย์ &amp; รีวิว ${icon('arrow_forward', 'sm')}</button>
      <button class="square-btn ${p.saved ? 'on' : ''}" data-action="toggle-save" data-type="professor" data-id="${esc(p.id)}" aria-label="บันทึกอาจารย์">
        ${icon('bookmark', p.saved ? 'fill' : '')}
      </button>
    </div>
  </article>`;
}

/** การ์ดรีวิว — variant: 'full' (มีชื่อวิชา/อาจารย์) หรือ 'compact' (ใช้ในหน้าต่างรายละเอียด) */
export function reviewCard(r, { variant = 'full' } = {}) {
  const typePill = r.targetType === 'course'
    ? `<span class="pill pill-blue">${icon('menu_book', 'sm')} วิชา</span>`
    : `<span class="pill pill-amber">${icon('person', 'sm')} อาจารย์</span>`;
  const openAction = r.targetType === 'course' ? 'open-course' : 'open-prof';
  const meta = [r.term, r.grade ? `ได้เกรด ${r.grade}` : ''].filter(Boolean).join(' • ');
  return `
  <article class="card review-card" data-review="${r.id}">
    ${variant === 'full' ? `
      <div class="row-between">
        <div class="row wrap" style="gap:6px">${typePill}
          ${r.anonymous ? `<span class="pill pill-slate">${icon('visibility_off', 'sm')} ไม่ระบุตัวตน</span>` : `<span class="pill pill-green">${esc(r.author)}</span>`}
        </div>
        ${ratingBadge(r.rating)}
      </div>
      <button class="target" style="text-align:left" data-action="${openAction}" data-id="${esc(r.targetId)}">${esc(r.targetName || r.targetId)}</button>
      ${r.targetSub ? `<div class="small muted" style="margin-top:-6px">${esc(r.targetSub)}</div>` : ''}
    ` : `
      <div class="review-head">
        <span class="avatar sm" style="background:var(--subtle);color:var(--muted)">${icon('school', 'sm')}</span>
        <div class="grow"><div class="semibold" style="color:var(--text)">${esc(r.author)}</div>${meta ? `<div class="review-meta">${esc(meta)}</div>` : ''}</div>
        ${stars(r.rating)}
      </div>`}
    ${r.headline ? `<p class="semibold" style="color:var(--text)">“${esc(r.headline)}”</p>` : ''}
    <p>${esc(r.content)}</p>
    ${r.tip ? `<p class="tip">💡 <b>เคล็ดลับ:</b> ${esc(r.tip)}</p>` : ''}
    <div class="review-actions">
      <span class="review-meta">${icon('calendar_today', 'sm')} ${esc(variant === 'full' ? thaiDate(r.createdAt) : timeAgo(r.createdAt))}</span>
      <div class="row">
        ${r.mine
          ? `<span class="like-btn">${icon('thumb_up', 'sm fill')} ${fmtNum(r.likes)}</span>
             <button class="btn btn-danger btn-xs" data-action="delete-review" data-id="${r.id}">${icon('delete', 'sm')} ลบรีวิว</button>`
          : `<button class="like-btn ${r.voted ? 'on' : ''}" data-action="like" data-id="${r.id}" aria-pressed="${r.voted}">${icon('thumb_up', 'sm' + (r.voted ? ' fill' : ''))} ถูกใจ (<span>${fmtNum(r.likes)}</span>)</button>
             <button class="link-btn" data-action="report" data-id="${r.id}">${icon('flag', 'sm')} รายงาน</button>`}
      </div>
    </div>
  </article>`;
}

// ================= Course detail modal =================
const diffColor = d => (d == null ? 'var(--muted)' : d < 2.5 ? 'var(--green-800)' : d < 3.5 ? '#b45309' : 'var(--red-700)');

export async function openCourseModal(code) {
  let c;
  try { c = await api('/courses/' + enc(code)); } catch (e) { return toast(e.message, 'error'); }
  rememberReviews(c.reviews);
  const featured = c.reviews.find(r => r.featured);
  const others = c.reviews.filter(r => r !== featured);
  const m = openModal(`
    <div class="modal-head">
      <div class="grow">
        <div class="row wrap" style="gap:6px">
          <span class="pill pill-blue">${esc(c.dept || CATEGORIES[c.category] || '')}</span>
          ${c.credits ? `<span class="pill pill-slate">${esc(c.credits)}</span>` : ''}
          ${c.term ? `<span class="pill pill-slate">${esc(c.term)}</span>` : ''}
        </div>
        <h2 class="mt-2">${esc(c.code)}: ${esc(c.titleTh)}</h2>
        <p class="muted">${esc(c.titleEn || '')}</p>
      </div>
      <button class="modal-close" data-close aria-label="ปิด">${icon('close')}</button>
    </div>
    <div class="modal-body">
      <div class="stat-tiles">
        <div class="stat-tile gold"><span>คะแนนรวม</span><b>${fmtRating(c.rating)} <span style="color:var(--amber);font-size:16px">★</span></b><small>${fmtNum(c.reviewCount)} รีวิวจากนักศึกษา</small></div>
        <div class="stat-tile"><span>ความยากเนื้อหา</span><b>${c.difficulty != null ? c.difficulty.toFixed(1) + ' / 5.0' : '–'}</b><small style="color:${diffColor(c.difficulty)};font-weight:600">${esc(c.diffLabel || '')}</small></div>
        <div class="stat-tile"><span>โอกาสได้ A / B+</span><b style="color:var(--sky)">${c.aRate != null ? c.aRate + '%' : '–'}</b><small>${esc(c.grading || '')}</small></div>
        <div class="stat-tile"><span>ภาระงาน</span><b style="font-size:17px">${esc(c.workload || '–')}</b><small>${esc(c.exam || '')}</small></div>
      </div>
      ${c.description ? `
      <section>
        <h3 class="row" style="font-size:15px">${icon('info', 'sm')} รายละเอียดและแนวทางการเรียน</h3>
        <p class="quote-box mt-2" style="font-style:normal">${esc(c.description)}</p>
        <div class="row wrap small muted mt-2" style="gap:16px">
          ${c.instructor ? `<span>อาจารย์ผู้สอน: <b style="color:var(--text)">${esc(c.instructor)}</b></span>` : ''}
          ${c.year ? `<span>ชั้นปีที่แนะนำ: <b style="color:var(--text)">${esc(c.year)}</b></span>` : ''}
        </div>
      </section>` : ''}
      ${c.professors.length ? `
      <section>
        <h3 class="row" style="font-size:15px">${icon('person_search', 'sm')} อาจารย์ที่สอนวิชานี้</h3>
        <div class="row wrap mt-2">${c.professors.map(p => `
          <button class="card card-hover row" style="padding:8px 12px" data-action="open-prof" data-id="${esc(p.id)}">
            ${avatar(p.nameTh, p.photo, 'sm')}<span class="semibold" style="color:var(--text)">${esc(p.nameTh)}</span>${ratingBadge(p.rating)}
          </button>`).join('')}</div>
      </section>` : ''}
      ${featured ? `
      <section>
        <div class="row-between"><span class="pill pill-amber">★ คอมเมนต์โดดเด่น (Featured Review)</span><span class="xs faint">โหวตเป็นประโยชน์สูงสุด</span></div>
        <div class="featured-box mt-2">${reviewCard(featured, { variant: 'compact' }).replace('class="card review-card"', 'class="review-card" style="padding:0"')}</div>
      </section>` : ''}
      <section>
        <div class="row-between"><h3 class="row" style="font-size:15px">${icon('forum', 'sm')} รีวิวและความคิดเห็นทั้งหมด (${others.length})</h3><span class="xs faint">เรียงตามความนิยม</span></div>
        <div class="stack mt-2" style="gap:12px">
          ${others.length ? others.map(r => reviewCard(r, { variant: 'compact' })).join('') : '<p class="empty" style="padding:20px">ยังไม่มีรีวิวเพิ่มเติม — มาเป็นคนแรกที่รีวิววิชานี้!</p>'}
        </div>
      </section>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" data-action="toggle-save" data-type="course" data-id="${esc(c.code)}">
        ${icon('bookmark', c.saved ? 'fill' : '')} <span>${c.saved ? 'ยกเลิกบันทึก' : 'บันทึกวิชา'}</span>
      </button>
      <a class="btn btn-accent btn-sm" href="/reviews.html?type=course&id=${enc(c.code)}#write">${icon('edit_square', 'sm')} เขียนรีวิววิชานี้</a>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto" data-close>ปิดหน้าต่าง</button>
    </div>`, { label: `${c.code} ${c.titleTh}` });
  return m;
}

// ================= Professor detail modal =================
export async function openProfessorModal(id) {
  let p;
  try { p = await api('/professors/' + enc(id)); } catch (e) { return toast(e.message, 'error'); }
  rememberReviews(p.reviews);
  const featured = p.reviews.find(r => r.featured);
  const others = p.reviews.filter(r => r !== featured);
  const info = [
    p.office && ['location_on', 'ห้องทำงาน', p.office],
    p.email && ['mail', 'อีเมล', p.email],
    p.hours && ['schedule', 'เวลาให้คำปรึกษา', p.hours],
    ['school', 'สังกัด', `${p.deptLabel || ''} ${p.facultyName || ''}`],
  ].filter(Boolean);
  return openModal(`
    <div class="modal-head">
      ${avatar(p.nameTh, p.photo, 'xl')}
      <div class="grow">
        <span class="pill pill-blue">${esc(p.facultyName || '')}</span>
        <h2 class="mt-2">${esc(p.nameTh)}</h2>
        <p class="muted">${esc([p.nameEn, p.title].filter(Boolean).join(' • '))}</p>
      </div>
      <button class="modal-close" data-close aria-label="ปิด">${icon('close')}</button>
    </div>
    <div class="modal-body">
      <div class="stat-tiles">
        <div class="stat-tile gold"><span>คะแนนรวม</span><b>${fmtRating(p.rating)} <span style="color:var(--amber);font-size:16px">★</span></b><small>${fmtNum(p.reviewCount)} รีวิว</small></div>
        <div class="stat-tile"><span>ความชัดเจนในการสอน</span><b style="color:var(--sky)">${p.stats.clarity}%</b><div class="meter mt-1"><span style="width:${p.stats.clarity}%"></span></div></div>
        <div class="stat-tile"><span>ความเป็นมิตร</span><b style="color:var(--green-800)">${p.stats.approach}%</b><div class="meter green mt-1"><span style="width:${p.stats.approach}%"></span></div></div>
        <div class="stat-tile"><span>${esc(p.stats.extraLabel || 'อื่นๆ')}</span><b>${p.stats.extraVal}%</b><div class="meter amber mt-1"><span style="width:${p.stats.extraVal}%"></span></div></div>
      </div>
      <div class="info-grid">${info.map(([ic, l, v]) => `<div>${icon(ic)}<div><div class="xs faint semibold">${l}</div><div style="color:var(--text)">${esc(v)}</div></div></div>`).join('')}</div>
      ${p.highlights ? `<section><h3 class="row" style="font-size:15px">${icon('verified', 'sm')} จุดเด่นจากรีวิวนักศึกษา</h3>
        <ul class="mt-2" style="margin:8px 0 0;padding-left:20px">${p.highlights.map(h => `<li>${esc(h)}</li>`).join('')}</ul></section>` : ''}
      ${p.courseDetails.length ? `<section><h3 class="row" style="font-size:15px">${icon('menu_book', 'sm')} รายวิชาที่สอน</h3>
        <div class="row wrap mt-2">${p.courseDetails.map(c => `<button class="tag" style="padding:6px 10px" data-action="open-course" data-id="${esc(c.code)}"><b>${esc(c.code)}</b> ${esc(c.titleTh)}</button>`).join('')}</div></section>` : ''}
      ${featured ? `<section>
        <span class="pill pill-amber">★ คอมเมนต์โดดเด่น</span>
        <div class="featured-box mt-2">${reviewCard(featured, { variant: 'compact' }).replace('class="card review-card"', 'class="review-card" style="padding:0"')}</div>
      </section>` : ''}
      <section>
        <h3 class="row" style="font-size:15px">${icon('forum', 'sm')} รีวิวทั้งหมด (${others.length})</h3>
        <div class="stack mt-2" style="gap:12px">${others.length ? others.map(r => reviewCard(r, { variant: 'compact' })).join('') : '<p class="empty" style="padding:20px">ยังไม่มีรีวิวเพิ่มเติม</p>'}</div>
      </section>
    </div>
    <div class="modal-foot">
      <button class="btn btn-ghost btn-sm" data-action="toggle-save" data-type="professor" data-id="${esc(p.id)}">${icon('bookmark', p.saved ? 'fill' : '')} <span>${p.saved ? 'ยกเลิกบันทึก' : 'บันทึกอาจารย์'}</span></button>
      <a class="btn btn-accent btn-sm" href="/reviews.html?type=professor&id=${enc(p.id)}#write">${icon('edit_square', 'sm')} เขียนรีวิวอาจารย์</a>
      <button class="btn btn-ghost btn-sm" style="margin-left:auto" data-close>ปิดหน้าต่าง</button>
    </div>`, { label: p.nameTh });
}

// ================= Report modal =================
const REASONS = [
  ['toxic', '🚨 1. คอมเมนต์ไม่ดี / คำหยาบคาย / คุกคาม', 'ร้ายแรง', 'pill-red', 'ใช้ถ้อยคำหยาบคาย ด่าทอ เสียดสี คุกคาม หรือพาดพิงใส่ร้ายบุคคลอื่นให้เสียหาย'],
  ['fake', '⚠️ 2. หลอกลวง / ข้อมูลเท็จ / บิดเบือนความจริง', 'ข้อมูลเท็จ', 'pill-amber', 'ให้ข้อมูลเกณฑ์ตัดเกรด แนวข้อสอบ หรือเนื้อหารายวิชาไม่ตรงกับความเป็นจริง จงใจทำให้ผู้อื่นเข้าใจผิด'],
  ['spam', '🚫 3. มั่วซั่ว / ข้อมูลไร้สาระ / สแปม', 'สแปม', 'pill-slate', 'พิมพ์มั่วซั่ว สแปมโฆษณา รับจ้างทำการบ้าน/โปรเจกต์ หรือข้อความที่ไม่เกี่ยวกับการเรียนการสอน'],
  ['other', 'ℹ️ 4. อื่นๆ', '', '', 'ปัญหาหรือเหตุผลอื่นๆ นอกเหนือจากตัวเลือกข้างต้น (โปรดระบุรายละเอียดด้านล่าง)'],
];

export function openReportModal(review) {
  const m = openModal(`
    <div class="modal-head">
      <div class="head-icon red">${icon('flag')}</div>
      <div class="grow"><h2 style="font-size:19px">รายงานความไม่เหมาะสมของคอมเมนต์</h2><p class="small muted">Report Inappropriate &amp; Misleading Review</p></div>
      <button class="modal-close" data-close aria-label="ปิด">${icon('close')}</button>
    </div>
    <form class="modal-body" novalidate>
      <div class="card" style="padding:14px;background:var(--bg)">
        <div class="row-between"><span class="row xs semibold muted">${icon('rate_review', 'sm')} คอมเมนต์เป้าหมายที่ถูกรายงาน</span>${ratingBadge(review.rating)}</div>
        <p class="semibold mt-2" style="color:var(--text)">รีวิวใน: ${esc(review.targetName || review.targetId)}</p>
        <blockquote class="quote-box mt-2" style="margin:8px 0 0">“${esc(review.content.length > 180 ? review.content.slice(0, 180) + '…' : review.content)}”</blockquote>
      </div>
      <fieldset style="border:0;padding:0;margin:0" class="stack" >
        <legend class="label" style="margin-bottom:10px">เลือกสาเหตุการรายงานที่ตรงกับปัญหา <span class="req">*</span></legend>
        <div class="stack" style="gap:10px">
          ${REASONS.map(([v, t, pill, cls, d]) => `
          <label class="radio-card"><input type="radio" name="reason" value="${v}">
            <div><div class="t">${t} ${pill ? `<span class="pill ${cls}">${pill}</span>` : ''}</div><div class="d">${d}</div></div>
          </label>`).join('')}
        </div>
        <p class="field-error" data-error="reason" hidden></p>
      </fieldset>
      <div class="field">
        <div class="row-between"><label for="rp-detail">ระบุเหตุผลและหลักฐานเพิ่มเติม <span class="req">*</span></label><span class="xs faint" data-counter>0/500 ตัวอักษร</span></div>
        <textarea id="rp-detail" name="detail" class="textarea" maxlength="500" placeholder="โปรดอธิบายเหตุใดคอมเมนต์นี้จึงไม่เหมาะสมหรือเป็นเท็จ เช่น ข้อความใช้คำด่าทอหยาบคาย หรือเกณฑ์การสอบไม่เป็นความจริง..."></textarea>
        <p class="field-error" data-error="detail" hidden></p>
      </div>
      <label class="switch-row">
        ${icon('visibility_off')}
        <div class="grow"><div class="semibold" style="color:var(--text)">รายงานแบบไม่ระบุตัวตน (Anonymous Report)</div><div class="xs muted">ระบบจะไม่เปิดเผยรหัสนักศึกษาของคุณต่อสาธารณะและผู้ถูกรายงาน</div></div>
        <span class="switch red"><input type="checkbox" name="anonymous" checked><span></span></span>
      </label>
      <button type="submit" hidden></button>
    </form>
    <div class="modal-foot" style="justify-content:flex-end">
      <button class="btn btn-ghost" data-close>ยกเลิก</button>
      <button class="btn btn-danger-solid" data-submit>${icon('send', 'sm')} ยืนยันส่งรายงานความไม่เหมาะสม</button>
    </div>`, { size: 'md', label: 'รายงานความไม่เหมาะสม' });

  const form = $('form', m.el);
  const ta = $('textarea', form);
  ta.addEventListener('input', () => { $('[data-counter]', m.el).textContent = `${ta.value.length}/500 ตัวอักษร`; });
  const submit = async e => {
    e && e.preventDefault();
    const fd = new FormData(form);
    const body = { reviewId: review.id, reason: fd.get('reason'), detail: fd.get('detail'), anonymous: fd.get('anonymous') === 'on' };
    const errs = {};
    if (!body.reason) errs.reason = 'กรุณาเลือกสาเหตุการรายงาน';
    if ((body.detail || '').trim().length < 10) errs.detail = 'กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร';
    showFieldErrors(form, errs);
    if (Object.keys(errs).length) return;
    const btn = $('[data-submit]', m.el);
    btn.disabled = true;
    try {
      await api('/reports', { method: 'POST', body });
      m.close();
      toast('ส่งรายงานเรียบร้อยแล้ว! ทีมงานจะตรวจสอบภายใน 24 ชม.');
    } catch (err) {
      showFieldErrors(form, err.fields);
      toast(err.message, 'error');
      btn.disabled = false;
    }
  };
  form.addEventListener('submit', submit);
  $('[data-submit]', m.el).addEventListener('click', submit);
}

// ================= Global click actions =================
// ทุกปุ่มที่มี data-action ทั่วทั้งเว็บจะถูกจัดการที่นี่ (การ์ดในหน้า + ในหน้าต่าง)
const reviewCache = new Map();
export const rememberReviews = list => list.forEach(r => reviewCache.set(String(r.id), r));

export function installGlobalActions() {
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id, type } = el.dataset;
    if (['open-course', 'open-prof', 'toggle-save', 'like', 'report', 'delete-review'].includes(action)) {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      if (action === 'open-course') await openCourseModal(id);
      else if (action === 'open-prof') await openProfessorModal(id);
      else if (action === 'toggle-save') {
        const { saved } = await api('/saved', { method: 'POST', body: { targetType: type, targetId: id } });
        document.querySelectorAll(`[data-action="toggle-save"][data-type="${type}"][data-id="${CSS.escape(id)}"]`).forEach(b => {
          b.classList.toggle('on', saved);
          const ic = b.querySelector('.icon');
          if (ic) ic.classList.toggle('fill', saved);
          const label = b.querySelector('span:not(.icon)');
          if (label) label.textContent = saved ? 'ยกเลิกบันทึก' : (type === 'course' ? 'บันทึกวิชา' : 'บันทึกอาจารย์');
        });
        toast(saved ? 'บันทึกไว้ในรายการโปรดแล้ว' : 'นำออกจากรายการที่บันทึกแล้ว');
        emitChange({ kind: 'saved' });
      } else if (action === 'like') {
        const r = await api(`/reviews/${id}/helpful`, { method: 'POST' });
        document.querySelectorAll(`[data-action="like"][data-id="${id}"]`).forEach(b => {
          b.classList.toggle('on', r.voted);
          b.setAttribute('aria-pressed', r.voted);
          b.querySelector('.icon').classList.toggle('fill', r.voted);
          b.querySelector('span:not(.icon)').textContent = fmtNum(r.likes);
        });
      } else if (action === 'report') {
        const r = reviewCache.get(String(id));
        if (r) openReportModal(r);
      } else if (action === 'delete-review') {
        const ok = await confirmDialog({ title: 'ลบรีวิวนี้หรือไม่?', message: 'รีวิวจะถูกลบออกจากระบบถาวรและไม่สามารถกู้คืนได้', confirmText: 'ลบรีวิว', danger: true, iconName: 'delete' });
        if (!ok) return;
        await api('/reviews/' + id, { method: 'DELETE' });
        document.querySelectorAll(`[data-review="${id}"]`).forEach(n => n.remove());
        toast('ลบรีวิวเรียบร้อยแล้ว');
        emitChange({ kind: 'review-deleted', id });
      }
    } catch (err) {
      toast(err.message, 'error');
    }
  });
  // เปิดการ์ดด้วยคีย์บอร์ด
  document.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const card = e.target.closest && e.target.closest('article[data-action]');
    if (card && e.target === card) { e.preventDefault(); card.click(); }
  });
}
