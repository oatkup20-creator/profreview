// ฐานข้อมูล: ใช้ libSQL (SQLite)
//  - รันในเครื่อง  → เก็บเป็นไฟล์ db/profreview.db อัตโนมัติ
//  - ขึ้นออนไลน์   → ตั้งค่า TURSO_DATABASE_URL และ TURSO_AUTH_TOKEN เพื่อเก็บข้อมูลบน Turso (คลาวด์)
const path = require('path');
const fs = require('fs');
const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

function localUrl() {
  const file = process.env.DB_FILE || path.join(__dirname, 'profreview.db');
  // ใช้ path แบบสัมพัทธ์ + เครื่องหมาย / เพื่อให้ทำงานได้ทั้ง Windows และ Mac/Linux
  const rel = path.relative(process.cwd(), file).split(path.sep).join('/');
  return 'file:' + (rel || 'profreview.db');
}

const remote = !!process.env.TURSO_DATABASE_URL;
const client = createClient({
  url: process.env.TURSO_DATABASE_URL || localUrl(),
  authToken: process.env.TURSO_AUTH_TOKEN,
});

const clean = v => (v === undefined ? null : v);
function toArgs(a) {
  if (a.length === 1 && a[0] && typeof a[0] === 'object' && !Array.isArray(a[0])) {
    return Object.fromEntries(Object.entries(a[0]).map(([k, v]) => [k, clean(v)]));
  }
  return a.map(clean);
}
const toRows = r => r.rows.map(row => Object.fromEntries(r.columns.map((c, i) => [c, row[i]])));

/** ใช้งานคล้าย better-sqlite3: db.prepare(sql).get/all/run(...) แต่เป็น async (ต้อง await) */
const db = {
  prepare(sql) {
    const exec = a => client.execute({ sql, args: toArgs(a) });
    return {
      all: async (...a) => toRows(await exec(a)),
      get: async (...a) => toRows(await exec(a))[0],
      run: async (...a) => {
        const r = await exec(a);
        return { changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid) };
      },
    };
  },
  /** รันหลายคำสั่งในครั้งเดียวแบบ transaction: [[sql, args], ...] */
  batch(stmts) {
    return client.batch(stmts.map(([sql, args]) => ({ sql, args: (args || []).map(clean) })), 'write');
  },
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  department    TEXT DEFAULT 'ภาควิชาวิทยาการคอมพิวเตอร์',
  notif_like    INTEGER DEFAULT 1,
  notif_enroll  INTEGER DEFAULT 1,
  notif_review  INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS courses (
  code TEXT PRIMARY KEY, title_th TEXT NOT NULL, title_en TEXT, dept TEXT,
  category TEXT,               -- ge | scitech | humansoc | free
  credits TEXT, term TEXT, year TEXT, difficulty REAL, diff_label TEXT, a_rate INTEGER,
  grading TEXT, workload TEXT, exam TEXT, instructor TEXT, description TEXT, quote TEXT,
  tags TEXT,                   -- JSON array
  base_sum REAL DEFAULT 0,     -- คะแนนสะสมจากรีวิวในอดีตที่ไม่มีข้อความ
  base_count INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS professors (
  id TEXT PRIMARY KEY, name_th TEXT NOT NULL, name_en TEXT,
  faculty TEXT,                -- sci | eng | arts | biz
  faculty_name TEXT, dept_label TEXT, courses TEXT, tags TEXT, quote TEXT,
  clarity INTEGER, approach INTEGER, extra_label TEXT, extra_val INTEGER,
  photo TEXT, title TEXT, office TEXT, email TEXT, hours TEXT, highlights TEXT,
  base_sum REAL DEFAULT 0, base_count INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reviews (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_label TEXT,
  target_type  TEXT NOT NULL CHECK (target_type IN ('course','professor')),
  target_id    TEXT NOT NULL,
  rating       REAL NOT NULL CHECK (rating BETWEEN 1 AND 5),
  headline TEXT, content TEXT NOT NULL, tip TEXT, term_label TEXT, grade TEXT,
  is_anonymous INTEGER DEFAULT 0,
  is_featured  INTEGER DEFAULT 0,
  base_likes   INTEGER DEFAULT 0,
  status       TEXT DEFAULT 'published',
  created_at   TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
CREATE TABLE IF NOT EXISTS review_votes (
  user_id INTEGER NOT NULL, review_id INTEGER NOT NULL, PRIMARY KEY (user_id, review_id)
);
CREATE TABLE IF NOT EXISTS saved_items (
  user_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')), PRIMARY KEY (user_id, target_type, target_id)
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, review_id INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('toxic','fake','spam','other')),
  detail TEXT, is_anonymous INTEGER DEFAULT 1, status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT, course_code TEXT NOT NULL,
  day TEXT NOT NULL, start_hour REAL NOT NULL, duration REAL NOT NULL,
  room TEXT, instructor TEXT, credits INTEGER NOT NULL, compulsory INTEGER DEFAULT 0, color TEXT
);
CREATE TABLE IF NOT EXISTS schedule_items (
  user_id INTEGER NOT NULL, section_id INTEGER NOT NULL, PRIMARY KEY (user_id, section_id)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
  type TEXT, icon TEXT, title TEXT, message TEXT, course_code TEXT,
  unread INTEGER DEFAULT 1, created_at TEXT DEFAULT (datetime('now'))
);`;

const DEMO = { studentId: '6501012345', email: 'student@university.ac.th', password: 'password' };

/** ตารางเรียนเริ่มต้นของผู้ใช้ใหม่: วิชาบังคับทั้งหมด + ART 220 + WEB 201 (ตามหน้าจอต้นแบบ) */
async function giveDefaultSchedule(userId) {
  await db.prepare(`INSERT OR IGNORE INTO schedule_items (user_id, section_id)
    SELECT ?, id FROM sections WHERE compulsory = 1 OR course_code IN ('ART 220','WEB 201')`).run(userId);
}

async function giveWelcomeNotification(userId) {
  await db.prepare(`INSERT INTO notifications (user_id, type, icon, title, message) VALUES (?,?,?,?,?)`)
    .run(userId, 'system', 'waving_hand', 'ยินดีต้อนรับสู่ ProfReview 🎉',
      'เริ่มต้นค้นหาวิชาและอาจารย์ บันทึกวิชาที่สนใจ และลองจัดตารางเรียนภาคเรียนถัดไปได้เลย');
}

async function seed() {
  const { n } = await db.prepare('SELECT COUNT(*) AS n FROM courses').get();
  if (n) return;
  const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'seed-data.json'), 'utf8'));

  // นับรีวิวแบบมีข้อความของแต่ละเป้าหมาย เพื่อให้คะแนนรวมออกมาตรงกับหน้าจอต้นแบบ
  const textual = {};
  for (const r of [...data.reviews, ...data.demoUserReviews]) {
    const k = r.targetType + ':' + r.targetId;
    textual[k] = textual[k] || { n: 0, sum: 0 };
    textual[k].n++; textual[k].sum += r.rating;
  }
  const base = (type, id, rating, count) => {
    const t = textual[type + ':' + id] || { n: 0, sum: 0 };
    const cnt = Math.max(count - t.n, 0);
    return { sum: Math.max(rating * (cnt + t.n) - t.sum, 0), n: cnt };
  };

  // บัญชีทดลอง
  const u = await db.prepare('INSERT INTO users (student_id, email, password_hash) VALUES (?,?,?)')
    .run(DEMO.studentId, DEMO.email, bcrypt.hashSync(DEMO.password, 10));
  const uid = u.lastInsertRowid;

  const stmts = [];
  for (const c of data.courses) {
    const b = base('course', c.code, c.rating, c.reviewCount);
    stmts.push([`INSERT INTO courses (code,title_th,title_en,dept,category,credits,term,year,difficulty,diff_label,a_rate,grading,workload,exam,instructor,description,quote,tags,base_sum,base_count)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [c.code, c.titleTh, c.titleEn, c.dept, c.category || 'free', c.credits, c.term, c.year, c.difficulty, c.diffLabel, c.aRate,
      c.grading, c.workload, c.exam, c.instructor, c.description, c.quote, JSON.stringify(c.tags || []), b.sum, b.n]]);
  }
  for (const p of data.professors) {
    const b = base('professor', p.id, p.rating, p.reviewCount);
    stmts.push([`INSERT INTO professors (id,name_th,name_en,faculty,faculty_name,dept_label,courses,tags,quote,clarity,approach,extra_label,extra_val,photo,title,office,email,hours,highlights,base_sum,base_count)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.id, p.nameTh, p.nameEn, p.faculty, p.facultyName, p.deptLabel, JSON.stringify(p.courses || []), JSON.stringify(p.tags || []),
      p.quote, p.clarity, p.approach, p.extraLabel, p.extraVal, p.photo, p.title, p.office, p.email, p.hours,
      p.highlights ? JSON.stringify(p.highlights) : null, b.sum, b.n]]);
  }
  const REVIEW_SQL = `INSERT INTO reviews (user_id,author_label,target_type,target_id,rating,headline,content,tip,term_label,grade,is_anonymous,is_featured,base_likes,created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;
  for (const r of data.reviews) {
    stmts.push([REVIEW_SQL, [null, r.author, r.targetType, r.targetId, r.rating, r.headline, r.content, r.tip, r.term, r.grade,
      r.anonymous ? 1 : 0, r.featured ? 1 : 0, r.likes || 0, r.date]]);
  }
  for (const r of data.demoUserReviews) {
    stmts.push([REVIEW_SQL, [uid, null, r.targetType, r.targetId, r.rating, r.headline, r.content, null, r.term, null,
      r.anonymous ? 1 : 0, 0, r.likes || 0, r.date]]);
  }
  for (const s of data.sections) {
    stmts.push([`INSERT INTO sections (course_code,day,start_hour,duration,room,instructor,credits,compulsory,color) VALUES (?,?,?,?,?,?,?,?,?)`,
      [s.courseCode, s.day, s.start, s.duration, s.room, s.instructor, s.credits, s.compulsory ? 1 : 0, s.color]]);
  }
  for (const c of ['CS 201', 'CS 490', 'ART 220', 'SOC 105']) {
    stmts.push(['INSERT INTO saved_items (user_id,target_type,target_id) VALUES (?,?,?)', [uid, 'course', c]]);
  }
  stmts.push(['INSERT INTO saved_items (user_id,target_type,target_id) VALUES (?,?,?)', [uid, 'professor', 'sarah']]);
  const ages = ['-10 minutes', '-1 hours', '-3 hours', '-1 days'];
  data.notifications.forEach((nf, i) => stmts.push([
    `INSERT INTO notifications (user_id,type,icon,title,message,course_code,unread,created_at) VALUES (?,?,?,?,?,?,?,datetime('now', ?))`,
    [uid, nf.type, nf.icon, nf.title, nf.message, nf.courseCode, nf.unread ? 1 : 0, ages[i] || '-2 days']]));

  await db.batch(stmts);
  await giveDefaultSchedule(uid);
  console.log('✔ ใส่ข้อมูลตัวอย่างแล้ว — บัญชีทดลอง: %s / %s', DEMO.studentId, DEMO.password);
}

/** เรียกครั้งเดียวตอนเปิดเซิร์ฟเวอร์ */
async function init() {
  await client.executeMultiple(SCHEMA);
  await seed();
  console.log(remote ? '✔ เชื่อมต่อฐานข้อมูล Turso (ออนไลน์) แล้ว' : '✔ ใช้ฐานข้อมูลไฟล์ในเครื่อง (db/profreview.db)');
}

module.exports = { db, init, giveDefaultSchedule, giveWelcomeNotification, DEMO };
