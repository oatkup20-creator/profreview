// คำสั่ง SQL ที่ใช้ซ้ำหลายที่ + ตัวแปลงแถวเป็น JSON สำหรับหน้าเว็บ
const { db } = require('../db/database');

const json = (s, fallback = []) => { try { return s ? JSON.parse(s) : fallback; } catch { return fallback; } };
const round1 = n => (n == null ? null : Math.round(n * 10) / 10);

// คะแนนเฉลี่ย = (คะแนนในอดีต + คะแนนรีวิวในระบบ) / จำนวนทั้งหมด
const aggregate = type => `
  (SELECT COUNT(*) FROM reviews r WHERE r.target_type = '${type}' AND r.target_id = t.${type === 'course' ? 'code' : 'id'} AND r.status = 'published') AS live_count,
  (SELECT COALESCE(SUM(rating),0) FROM reviews r WHERE r.target_type = '${type}' AND r.target_id = t.${type === 'course' ? 'code' : 'id'} AND r.status = 'published') AS live_sum`;

const savedFlag = (type, key) => `
  EXISTS (SELECT 1 FROM saved_items s WHERE s.user_id = @uid AND s.target_type = '${type}' AND s.target_id = t.${key}) AS saved`;

function withRating(row) {
  const count = row.base_count + row.live_count;
  return { count, rating: count ? round1((row.base_sum + row.live_sum) / count) : null };
}

function courseOut(row) {
  const { count, rating } = withRating(row);
  return {
    code: row.code, titleTh: row.title_th, titleEn: row.title_en, dept: row.dept, category: row.category,
    credits: row.credits, term: row.term, year: row.year, difficulty: row.difficulty, diffLabel: row.diff_label,
    aRate: row.a_rate, grading: row.grading, workload: row.workload, exam: row.exam, instructor: row.instructor,
    description: row.description, quote: row.quote, tags: json(row.tags), rating, reviewCount: count, saved: !!row.saved,
  };
}

function professorOut(row) {
  const { count, rating } = withRating(row);
  return {
    id: row.id, nameTh: row.name_th, nameEn: row.name_en, faculty: row.faculty, facultyName: row.faculty_name,
    deptLabel: row.dept_label, courses: json(row.courses), tags: json(row.tags), quote: row.quote,
    stats: { clarity: row.clarity, approach: row.approach, extraLabel: row.extra_label, extraVal: row.extra_val },
    photo: row.photo, title: row.title, office: row.office, email: row.email, hours: row.hours,
    highlights: json(row.highlights, null), rating, reviewCount: count, saved: !!row.saved,
  };
}

async function listCourses(uid = 0) {
  return (await db.prepare(`SELECT t.*, ${aggregate('course')}, ${savedFlag('course', 'code')} FROM courses t`).all({ uid })).map(courseOut);
}
async function getCourse(code, uid = 0) {
  const row = await db.prepare(`SELECT t.*, ${aggregate('course')}, ${savedFlag('course', 'code')} FROM courses t WHERE t.code = @code`).get({ uid, code });
  return row ? courseOut(row) : null;
}
async function listProfessors(uid = 0) {
  return (await db.prepare(`SELECT t.*, ${aggregate('professor')}, ${savedFlag('professor', 'id')} FROM professors t`).all({ uid })).map(professorOut);
}
async function getProfessor(id, uid = 0) {
  const row = await db.prepare(`SELECT t.*, ${aggregate('professor')}, ${savedFlag('professor', 'id')} FROM professors t WHERE t.id = @id`).get({ uid, id });
  return row ? professorOut(row) : null;
}

// ---------- รีวิว ----------
const REVIEW_SELECT = `
  SELECT r.*, u.student_id,
    r.base_likes + (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id) AS likes,
    EXISTS (SELECT 1 FROM review_votes v WHERE v.review_id = r.id AND v.user_id = @uid) AS voted,
    CASE r.target_type WHEN 'course' THEN (SELECT c.code || ' ' || c.title_th FROM courses c WHERE c.code = r.target_id)
                       ELSE (SELECT p.name_th FROM professors p WHERE p.id = r.target_id) END AS target_name,
    CASE r.target_type WHEN 'course' THEN (SELECT c.instructor FROM courses c WHERE c.code = r.target_id)
                       ELSE (SELECT p.dept_label FROM professors p WHERE p.id = r.target_id) END AS target_sub
  FROM reviews r LEFT JOIN users u ON u.id = r.user_id`;

function reviewOut(row, uid) {
  let author = row.author_label || 'นักศึกษา';
  if (row.user_id) author = row.is_anonymous ? 'ไม่ระบุตัวตน' : `นักศึกษา ${row.student_id}`;
  return {
    id: row.id, targetType: row.target_type, targetId: row.target_id, targetName: row.target_name, targetSub: row.target_sub,
    author, rating: row.rating, headline: row.headline, content: row.content, tip: row.tip, term: row.term_label, grade: row.grade,
    anonymous: !!row.is_anonymous, featured: !!row.is_featured, likes: row.likes, voted: !!row.voted,
    mine: !!uid && row.user_id === uid, createdAt: row.created_at,
  };
}

async function queryReviews(where = '1=1', params = {}, order = 'r.created_at DESC', limit = 50) {
  const uid = params.uid || 0;
  const rows = await db.prepare(`${REVIEW_SELECT} WHERE r.status = 'published' AND ${where} ORDER BY ${order} LIMIT ${Number(limit) | 0}`)
    .all({ ...params, uid });
  return rows.map(r => reviewOut(r, uid));
}

module.exports = { listCourses, getCourse, listProfessors, getProfessor, queryReviews, json, round1 };
