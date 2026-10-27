// หน้าแผงควบคุม (Dashboard)
import { api, qs } from '../api.js';
import { $, esc, icon, ratingBadge, stars, avatar, fmtNum, timeAgo, debounce } from '../ui.js';
import { mountLayout } from '../layout.js';
import { courseCard, reviewCard, rememberReviews } from '../components.js';

const me = await mountLayout('dashboard');
if (me) render();

async function render() {
  const main = $('#main');
  main.innerHTML = `
    <section class="hero">
      <div class="row-between wrap">
        <div>
          <span class="hero-kicker">${icon('waving_hand', 'sm')} สวัสดี นักศึกษา ${esc(me.studentId)}</span>
          <h1 class="mt-3" style="font-size:24px">ค้นหารายวิชาหรืออาจารย์ที่คุณสนใจอ่านรีวิว</h1>
        </div>
        <div class="hero-filters" role="group" aria-label="ตัวกรองการค้นหา">ตัวกรอง:
          <button data-scope="all" class="on">ทั้งหมด</button><button data-scope="course">รายวิชา</button><button data-scope="prof">อาจารย์</button>
        </div>
      </div>
      <form class="hero-search" id="hero-form" role="search">
        <div class="field-wrap">${icon('search')}<input id="hero-q" type="search" placeholder="เช่น CS 201, ENG 101, ศ. เดวิด เฉิน..." autocomplete="off" aria-label="คำค้นหา"></div>
        <button class="btn btn-primary" style="background:#fff;color:var(--navy-900)">ค้นหา</button>
      </form>
    </section>

    <section id="search-section" hidden></section>

    <section class="kpis" id="kpis">
      ${[1, 2, 3, 4].map(() => '<div class="skeleton" style="height:96px"></div>').join('')}
    </section>

    <div class="dash-grid">
      <section>
        <div class="section-head">
          <h2 class="section-title">${icon('trending_up')} วิชายอดนิยม</h2>
          <a class="btn-text" href="/courses.html?sort=reviews">ดูทั้งหมด →</a>
        </div>
        <div class="grid grid-2" id="popular">${'<div class="skeleton" style="height:300px"></div>'.repeat(2)}</div>
      </section>
      <section>
        <div class="section-head">
          <h2 class="section-title">${icon('school')} อาจารย์แนะนำ</h2>
          <a class="btn-text" href="/professors.html">ดูทั้งหมด →</a>
        </div>
        <div class="stack" style="gap:12px" id="profs">${'<div class="skeleton" style="height:76px"></div>'.repeat(4)}</div>
      </section>
    </div>

    <section>
      <div class="section-head">
        <h2 class="section-title">${icon('forum')} รีวิวล่าสุด</h2>
        <a class="btn-text" href="/reviews.html?tab=mine">ไปที่รีวิวของฉัน →</a>
      </div>
      <div class="grid grid-3" id="latest">${'<div class="skeleton" style="height:200px"></div>'.repeat(3)}</div>
    </section>`;

  wireHeroSearch();

  const [stats, popular, profs, latest] = await Promise.all([
    api('/stats'),
    api('/courses' + qs({ sort: 'reviews', limit: 4 })),
    api('/professors' + qs({ sort: 'rating', limit: 4 })),
    api('/reviews' + qs({ limit: 6 })),
  ]);

  $('#kpis').innerHTML = [
    ['rate_review', 'รีวิวในระบบ', fmtNum(stats.totalReviews), 'จากนักศึกษาทุกคณะ'],
    ['star', 'คะแนนเฉลี่ยรายวิชา', `${stats.courseAvg} ★`, `${stats.courseCount} รายวิชา`],
    ['person_search', 'คณาจารย์ในระบบ', `${stats.professorCount} ท่าน`, `คะแนนเฉลี่ย ${stats.professorAvg} ★`],
    ['bookmark', 'รายการที่คุณบันทึก', `${me.counts.saved}`, `เขียนรีวิวแล้ว ${me.counts.myReviews} รายการ`],
  ].map(([ic, l, v, s]) => `
    <div class="card kpi"><div class="top"><span class="lbl">${l}</span><span class="ico">${icon(ic, 'sm')}</span></div>
    <div class="val">${v}</div><div class="sub">${s}</div></div>`).join('');

  $('#popular').innerHTML = popular.items.map(courseCard).join('');

  $('#profs').innerHTML = profs.items.map(p => `
    <button class="card card-hover prof-mini" data-action="open-prof" data-id="${esc(p.id)}" style="text-align:left">
      ${avatar(p.nameTh, p.photo, 'lg sq')}
      <span class="grow"><h4>${esc(p.nameTh)}</h4><span class="small muted truncate" style="display:block">${esc(p.deptLabel || '')}</span></span>
      <span style="text-align:right"><span class="bold" style="color:#b45309">★ ${p.rating}</span><span class="xs faint" style="display:block">${fmtNum(p.reviewCount)} รีวิว</span></span>
    </button>`).join('');

  rememberReviews(latest);
  const recent = latest.filter(r => r.targetType === 'course').slice(0, 3);
  $('#latest').innerHTML = recent.map(r => `
    <article class="card review-card" data-review="${r.id}">
      <div class="row-between"><b style="color:var(--text);font-size:15px">${esc(r.targetId)}</b>${stars(r.rating)}</div>
      <p class="quote clamp-3">“${esc(r.content)}”</p>
      <div class="review-actions">
        <span class="review-meta">${timeAgo(r.createdAt)}</span>
        <span class="row">
          <button class="like-btn ${r.voted ? 'on' : ''}" data-action="like" data-id="${r.id}" ${r.mine ? 'disabled' : ''}>${icon('thumb_up', 'sm' + (r.voted ? ' fill' : ''))} <span>${fmtNum(r.likes)}</span></button>
          <button class="btn-text" data-action="open-course" data-id="${esc(r.targetId)}">ดูวิชา</button>
        </span>
      </div>
    </article>`).join('');
}

function wireHeroSearch() {
  let scope = 'all';
  const section = $('#search-section');
  document.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => {
    scope = b.dataset.scope;
    document.querySelectorAll('[data-scope]').forEach(x => x.classList.toggle('on', x === b));
    run();
  }));
  const run = async () => {
    const q = $('#hero-q').value.trim();
    if (!q) { section.hidden = true; return; }
    const data = await api('/search' + qs({ q }));
    const courses = scope === 'prof' ? [] : data.courses;
    const profs = scope === 'course' ? [] : data.professors;
    section.hidden = false;
    section.innerHTML = `
      <div class="section-head"><h2 class="section-title">${icon('search')} ผลการค้นหา “${esc(q)}”</h2>
        <button class="btn-text" id="clear-search">ล้างการค้นหา ✕</button></div>
      ${!courses.length && !profs.length ? `<div class="card empty">${icon('search_off')}<h4>ไม่พบรายวิชาหรืออาจารย์ที่ตรงกับคำค้นหา</h4><p>ลองค้นหาด้วยรหัสวิชา เช่น CS 201 หรือชื่ออาจารย์</p></div>` : ''}
      ${courses.length ? `<div class="grid grid-3">${courses.map(courseCard).join('')}</div>` : ''}
      ${profs.length ? `<div class="grid grid-3 mt-4">${profs.map(p => `
        <button class="card card-hover prof-mini" data-action="open-prof" data-id="${esc(p.id)}" style="text-align:left">
          ${avatar(p.nameTh, p.photo, 'lg sq')}<span class="grow"><h4>${esc(p.nameTh)}</h4><span class="small muted">${esc(p.deptLabel || '')}</span></span>${ratingBadge(p.rating)}
        </button>`).join('')}</div>` : ''}`;
    $('#clear-search').onclick = () => { $('#hero-q').value = ''; section.hidden = true; };
  };
  $('#hero-form').addEventListener('submit', e => { e.preventDefault(); run(); });
  $('#hero-q').addEventListener('input', debounce(run, 300));
}
