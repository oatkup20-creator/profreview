// REST API ทั้งหมดของ ProfReview
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, giveDefaultSchedule, giveWelcomeNotification } = require('../db/database');
const { createSession, destroySession, requireAuth } = require('../lib/auth');
const Q = require('../lib/queries');

const router = express.Router();
const uidOf = req => (req.user ? req.user.id : 0);
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function paginate(items, page, limit) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / limit));
  const p = Math.min(Math.max(1, parseInt(page) || 1), pages);
  return { items: items.slice((p - 1) * limit, p * limit), total, page: p, pages, limit };
}

// ================= Auth =================
const STUDENT_ID_RE = /^\d{8,10}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.(ac\.th|edu)$/i;

router.post('/auth/register', async (req, res) => {
  const studentId = str(req.body.studentId, 20);
  const email = str(req.body.email, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const errors = {};
  if (!STUDENT_ID_RE.test(studentId)) errors.studentId = 'รหัสนักศึกษาต้องเป็นตัวเลข 8-10 หลัก';
  if (!EMAIL_RE.test(email)) errors.email = 'ต้องมี @ และลงท้ายด้วย .ac.th หรือ .edu เท่านั้น';
  if (password.length < 6 || password.length > 64) errors.password = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
  if (!req.body.acceptTerms) errors.terms = 'กรุณากดยอมรับเงื่อนไขการใช้งานก่อนดำเนินการต่อ';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง', fields: errors });

  const dup = await db.prepare('SELECT student_id, email FROM users WHERE student_id = ? OR email = ?').get(studentId, email);
  if (dup) {
    const fields = dup.student_id === studentId ? { studentId: 'รหัสนักศึกษานี้มีบัญชีอยู่แล้ว' } : { email: 'อีเมลนี้ถูกใช้สมัครแล้ว' };
    return res.status(409).json({ error: 'มีบัญชีนี้อยู่ในระบบแล้ว กรุณาเข้าสู่ระบบ', fields });
  }
  const info = await db.prepare('INSERT INTO users (student_id, email, password_hash) VALUES (?,?,?)')
    .run(studentId, email, bcrypt.hashSync(password, 10));
  await giveDefaultSchedule(info.lastInsertRowid);
  await giveWelcomeNotification(info.lastInsertRowid);
  res.status(201).json({ ok: true, studentId });
});

router.post('/auth/login', async (req, res) => {
  const account = str(req.body.account, 120).toLowerCase();
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const user = await db.prepare('SELECT * FROM users WHERE student_id = ? OR email = ?').get(account, account);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return bad(res, 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบข้อมูล หรือสมัครสมาชิกก่อน', 401);
  }
  await createSession(res, user.id, !!req.body.remember);
  res.json({ ok: true });
});

router.get('/auth/status', async (req, res) => res.json({ loggedIn: !!req.user }));

router.post('/auth/logout', async (req, res) => { await destroySession(req, res); res.json({ ok: true }); });

// ================= Me =================
router.get('/me', requireAuth, async (req, res) => {
  const u = req.user;
  const c = async sql => (await db.prepare(sql).get(u.id)).n;
  res.json({
    studentId: u.student_id, email: u.email, department: u.department, createdAt: u.created_at,
    settings: { notifLike: !!u.notif_like, notifEnroll: !!u.notif_enroll, notifReview: !!u.notif_review },
    counts: {
      myReviews: await c(`SELECT COUNT(*) n FROM reviews WHERE user_id = ? AND status = 'published'`),
      saved: await c(`SELECT COUNT(*) n FROM saved_items WHERE user_id = ?`),
      unread: await c(`SELECT COUNT(*) n FROM notifications WHERE user_id = ? AND unread = 1`),
      helpful: (await db.prepare(`SELECT COALESCE(SUM(r.base_likes + (SELECT COUNT(*) FROM review_votes v WHERE v.review_id = r.id)),0) n
                           FROM reviews r WHERE r.user_id = ?`).get(u.id)).n,
    },
  });
});

router.patch('/me/settings', requireAuth, async (req, res) => {
  const b = req.body;
  await db.prepare(`UPDATE users SET notif_like = ?, notif_enroll = ?, notif_review = ?, department = COALESCE(NULLIF(?, ''), department) WHERE id = ?`)
    .run(b.notifLike ? 1 : 0, b.notifEnroll ? 1 : 0, b.notifReview ? 1 : 0, str(b.department, 120), req.user.id);
  res.json({ ok: true });
});

// ================= Stats & search =================
router.get('/stats', async (req, res) => {
  const courses = await Q.listCourses();
  const profs = await Q.listProfessors();
  const totalReviews = [...courses, ...profs].reduce((s, x) => s + x.reviewCount, 0);
  const avg = arr => Q.round1(arr.reduce((s, x) => s + (x.rating || 0) * x.reviewCount, 0) / Math.max(1, arr.reduce((s, x) => s + x.reviewCount, 0)));
  res.json({ courseCount: courses.length, professorCount: profs.length, totalReviews, courseAvg: avg(courses), professorAvg: avg(profs) });
});

router.get('/search', async (req, res) => {
  const q = norm(req.query.q);
  if (!q) return res.json({ courses: [], professors: [] });
  const uid = uidOf(req);
  const courses = (await Q.listCourses(uid)).filter(c => norm(c.code + c.titleTh + c.titleEn + c.instructor).includes(q)).slice(0, 6);
  const professors = (await Q.listProfessors(uid)).filter(p => norm(p.nameTh + p.nameEn + p.deptLabel).includes(q)).slice(0, 6);
  res.json({ courses, professors });
});

// ================= Courses =================
const SORTERS = {
  rating: (a, b) => (b.rating || 0) - (a.rating || 0) || b.reviewCount - a.reviewCount,
  reviews: (a, b) => b.reviewCount - a.reviewCount,
  easy: (a, b) => (a.difficulty ?? 9) - (b.difficulty ?? 9),
  code: (a, b) => a.code.localeCompare(b.code),
  name: (a, b) => (a.nameTh || '').localeCompare(b.nameTh || '', 'th'),
};

router.get('/courses', async (req, res) => {
  const uid = uidOf(req);
  let items = await Q.listCourses(uid);
  const counts = { all: items.length };
  items.forEach(c => { counts[c.category] = (counts[c.category] || 0) + 1; });
  const q = norm(req.query.q);
  if (q) items = items.filter(c => norm(c.code + c.titleTh + c.titleEn + c.instructor + c.dept).includes(q));
  if (req.query.category && req.query.category !== 'all') items = items.filter(c => c.category === req.query.category);
  if (req.query.saved === '1') items = items.filter(c => c.saved);
  items.sort(SORTERS[req.query.sort] || SORTERS.rating);
  res.json({ ...paginate(items, req.query.page, Math.min(48, parseInt(req.query.limit) || 6)), counts });
});

router.get('/courses/:code', async (req, res) => {
  const uid = uidOf(req);
  const course = await Q.getCourse(req.params.code, uid);
  if (!course) return bad(res, 'ไม่พบรายวิชานี้', 404);
  const reviews = await Q.queryReviews(`r.target_type = 'course' AND r.target_id = @id`, { id: course.code, uid }, 'r.is_featured DESC, likes DESC');
  const professors = (await Q.listProfessors(uid)).filter(p => p.courses.includes(course.code));
  const sections = await db.prepare('SELECT * FROM sections WHERE course_code = ?').all(course.code);
  res.json({ ...course, reviews, professors, sections });
});

// ================= Professors =================
router.get('/professors', async (req, res) => {
  const uid = uidOf(req);
  let items = await Q.listProfessors(uid);
  const counts = { all: items.length };
  items.forEach(p => { counts[p.faculty] = (counts[p.faculty] || 0) + 1; });
  const q = norm(req.query.q);
  if (q) items = items.filter(p => norm(p.nameTh + p.nameEn + p.deptLabel + p.facultyName + p.courses.join('')).includes(q));
  if (req.query.faculty && req.query.faculty !== 'all') items = items.filter(p => p.faculty === req.query.faculty);
  if (req.query.saved === '1') items = items.filter(p => p.saved);
  items.sort(SORTERS[req.query.sort] || SORTERS.rating);
  res.json({ ...paginate(items, req.query.page, Math.min(48, parseInt(req.query.limit) || 6)), counts });
});

router.get('/professors/:id', async (req, res) => {
  const uid = uidOf(req);
  const prof = await Q.getProfessor(req.params.id, uid);
  if (!prof) return bad(res, 'ไม่พบข้อมูลอาจารย์', 404);
  const reviews = await Q.queryReviews(`r.target_type = 'professor' AND r.target_id = @id`, { id: prof.id, uid }, 'r.is_featured DESC, likes DESC');
  const courses = (await Promise.all(prof.courses.map(code => Q.getCourse(code, uid)))).filter(Boolean);
  res.json({ ...prof, reviews, courseDetails: courses });
});

// ================= Reviews =================
router.get('/reviews', async (req, res) => {
  const uid = uidOf(req);
  const where = [];
  const params = { uid };
  if (req.query.scope === 'mine') {
    if (!uid) return bad(res, 'กรุณาเข้าสู่ระบบก่อนใช้งาน', 401);
    where.push('r.user_id = @uid');
  }
  if (['course', 'professor'].includes(req.query.type)) { where.push('r.target_type = @type'); params.type = req.query.type; }
  const order = req.query.sort === 'helpful' ? 'likes DESC' : 'r.created_at DESC';
  res.json(await Q.queryReviews(where.join(' AND ') || '1=1', params, order, Math.min(60, parseInt(req.query.limit) || 12)));
});

router.post('/reviews', requireAuth, async (req, res) => {
  const b = req.body;
  const targetType = b.targetType === 'professor' ? 'professor' : 'course';
  const targetId = str(b.targetId, 40);
  const exists = targetType === 'course'
    ? await db.prepare('SELECT 1 FROM courses WHERE code = ?').get(targetId)
    : await db.prepare('SELECT 1 FROM professors WHERE id = ?').get(targetId);
  const rating = Number(b.rating);
  const headline = str(b.headline, 120);
  const content = str(b.content, 600);
  const errors = {};
  if (!exists) errors.target = targetType === 'course' ? 'กรุณาเลือกรายวิชาจากรายการ' : 'กรุณาเลือกอาจารย์จากรายการ';
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) errors.rating = 'กรุณาให้คะแนน 1-5 ดาว';
  if (headline.length < 3) errors.headline = 'กรุณาใส่หัวข้อรีวิว (อย่างน้อย 3 ตัวอักษร)';
  if (content.length < 10) errors.content = 'กรุณาเขียนรายละเอียดอย่างน้อย 10 ตัวอักษร';
  if (Object.keys(errors).length) return res.status(400).json({ error: 'กรอกข้อมูลไม่ครบถ้วน', fields: errors });

  const dup = await db.prepare(`SELECT id FROM reviews WHERE user_id = ? AND target_type = ? AND target_id = ? AND status = 'published'`)
    .get(req.user.id, targetType, targetId);
  if (dup) return bad(res, 'คุณเคยรีวิวรายการนี้แล้ว — ลบรีวิวเดิมก่อนหากต้องการเขียนใหม่', 409);

  const info = await db.prepare(`INSERT INTO reviews (user_id, target_type, target_id, rating, headline, content, tip, term_label, grade, is_anonymous)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, targetType, targetId, rating, headline, content,
    str(b.tip, 200) || null, str(b.term, 40) || null, str(b.grade, 4) || null, b.anonymous ? 1 : 0);
  const [review] = await Q.queryReviews('r.id = @id', { id: info.lastInsertRowid, uid: req.user.id });
  res.status(201).json(review);
});

router.delete('/reviews/:id', requireAuth, async (req, res) => {
  const r = await db.prepare('DELETE FROM reviews WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  if (!r.changes) return bad(res, 'ไม่พบรีวิว หรือคุณไม่มีสิทธิ์ลบรีวิวนี้', 404);
  await db.prepare('DELETE FROM review_votes WHERE review_id = ?').run(req.params.id);
  await db.prepare('DELETE FROM reports WHERE review_id = ?').run(req.params.id);
  res.json({ ok: true });
});

router.post('/reviews/:id/helpful', requireAuth, async (req, res) => {
  const review = await db.prepare('SELECT user_id FROM reviews WHERE id = ?').get(req.params.id);
  if (!review) return bad(res, 'ไม่พบรีวิว', 404);
  if (review.user_id === req.user.id) return bad(res, 'ไม่สามารถโหวตรีวิวของตัวเองได้');
  const del = await db.prepare('DELETE FROM review_votes WHERE user_id = ? AND review_id = ?').run(req.user.id, req.params.id);
  if (!del.changes) await db.prepare('INSERT INTO review_votes (user_id, review_id) VALUES (?,?)').run(req.user.id, req.params.id);
  const [out] = await Q.queryReviews('r.id = @id', { id: Number(req.params.id), uid: req.user.id });
  res.json({ likes: out.likes, voted: out.voted });
});

// ================= Reports =================
router.post('/reports', requireAuth, async (req, res) => {
  const reviewId = Number(req.body.reviewId);
  const reason = req.body.reason;
  const detail = str(req.body.detail, 500);
  const review = await db.prepare('SELECT user_id FROM reviews WHERE id = ?').get(reviewId);
  if (!review) return bad(res, 'ไม่พบรีวิวที่ต้องการรายงาน', 404);
  if (review.user_id === req.user.id) return bad(res, 'ไม่สามารถรายงานรีวิวของตัวเองได้');
  if (!['toxic', 'fake', 'spam', 'other'].includes(reason)) return res.status(400).json({ error: 'กรุณาเลือกสาเหตุการรายงาน', fields: { reason: 'กรุณาเลือกสาเหตุ' } });
  if (detail.length < 10) return res.status(400).json({ error: 'กรุณาระบุเหตุผลเพิ่มเติมอย่างน้อย 10 ตัวอักษร', fields: { detail: 'อย่างน้อย 10 ตัวอักษร' } });
  const dup = await db.prepare('SELECT 1 FROM reports WHERE user_id = ? AND review_id = ?').get(req.user.id, reviewId);
  if (dup) return bad(res, 'คุณได้รายงานรีวิวนี้ไปแล้ว ทีมงานกำลังตรวจสอบ', 409);
  await db.prepare('INSERT INTO reports (user_id, review_id, reason, detail, is_anonymous) VALUES (?,?,?,?,?)')
    .run(req.user.id, reviewId, reason, detail, req.body.anonymous === false ? 0 : 1);
  res.status(201).json({ ok: true });
});

// ================= Saved =================
router.get('/saved', requireAuth, async (req, res) => {
  const uid = req.user.id;
  res.json({ courses: (await Q.listCourses(uid)).filter(c => c.saved), professors: (await Q.listProfessors(uid)).filter(p => p.saved) });
});

router.post('/saved', requireAuth, async (req, res) => {
  const type = req.body.targetType === 'professor' ? 'professor' : 'course';
  const id = str(req.body.targetId, 40);
  const del = await db.prepare('DELETE FROM saved_items WHERE user_id = ? AND target_type = ? AND target_id = ?').run(req.user.id, type, id);
  if (!del.changes) await db.prepare('INSERT INTO saved_items (user_id, target_type, target_id) VALUES (?,?,?)').run(req.user.id, type, id);
  res.json({ saved: !del.changes });
});

// ================= Schedule =================
const MAX_CREDITS = 22;
const DAY_TH = { Mon: 'จันทร์', Tue: 'อังคาร', Wed: 'พุธ', Thu: 'พฤหัส', Fri: 'ศุกร์' };

async function sectionRows() {
  const courses = Object.fromEntries((await Q.listCourses()).map(c => [c.code, c]));
  return (await db.prepare('SELECT * FROM sections ORDER BY course_code').all()).map(s => {
    const c = courses[s.course_code] || {};
    return {
      id: s.id, code: s.course_code, name: c.titleTh, nameEn: c.titleEn, category: c.category, day: s.day, dayTh: DAY_TH[s.day],
      start: s.start_hour, duration: s.duration, room: s.room, instructor: s.instructor, credits: s.credits,
      compulsory: !!s.compulsory, color: s.color, rating: c.rating, difficulty: c.difficulty,
    };
  });
}
const overlaps = (a, b) => a.day === b.day && a.start < b.start + b.duration && b.start < a.start + a.duration;

router.get('/schedule', requireAuth, async (req, res) => {
  const selected = (await db.prepare('SELECT section_id FROM schedule_items WHERE user_id = ?').all(req.user.id)).map(r => r.section_id);
  res.json({ sections: await sectionRows(), selected, maxCredits: MAX_CREDITS });
});

router.post('/schedule', requireAuth, async (req, res) => {
  const all = await sectionRows();
  const sec = all.find(s => s.id === Number(req.body.sectionId));
  if (!sec) return bad(res, 'ไม่พบเซคชันนี้', 404);
  const mineIds = (await db.prepare('SELECT section_id FROM schedule_items WHERE user_id = ?').all(req.user.id)).map(r => r.section_id);
  const mine = all.filter(s => mineIds.includes(s.id));
  if (mine.some(s => s.code === sec.code)) return bad(res, `วิชา ${sec.code} อยู่ในตารางแล้ว`, 409);
  const credits = mine.reduce((n, s) => n + s.credits, 0);
  if (credits + sec.credits > MAX_CREDITS) return bad(res, `หน่วยกิตเกิน ${MAX_CREDITS} หน่วยกิตสูงสุด (ปัจจุบัน ${credits})`, 409);
  const clash = mine.find(s => overlaps(s, sec));
  if (clash) return bad(res, `เวลาเรียนชนกับ ${clash.code} (${clash.dayTh})`, 409);
  await db.prepare('INSERT INTO schedule_items (user_id, section_id) VALUES (?,?)').run(req.user.id, sec.id);
  res.status(201).json({ ok: true });
});

router.delete('/schedule/:sectionId', requireAuth, async (req, res) => {
  const sec = await db.prepare('SELECT compulsory, course_code FROM sections WHERE id = ?').get(req.params.sectionId);
  if (!sec) return bad(res, 'ไม่พบเซคชันนี้', 404);
  if (sec.compulsory) return bad(res, `${sec.course_code} เป็นวิชาบังคับ ไม่สามารถถอนออกได้`);
  await db.prepare('DELETE FROM schedule_items WHERE user_id = ? AND section_id = ?').run(req.user.id, req.params.sectionId);
  res.json({ ok: true });
});

router.post('/schedule/reset', requireAuth, async (req, res) => {
  await db.prepare('DELETE FROM schedule_items WHERE user_id = ?').run(req.user.id);
  await giveDefaultSchedule(req.user.id);
  res.json({ ok: true });
});

// ================= Notifications =================
router.get('/notifications', requireAuth, async (req, res) => {
  const rows = await db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30').all(req.user.id);
  res.json(rows.map(n => ({ id: n.id, type: n.type, icon: n.icon, title: n.title, message: n.message, courseCode: n.course_code, unread: !!n.unread, createdAt: n.created_at })));
});
router.post('/notifications/read-all', requireAuth, async (req, res) => {
  await db.prepare('UPDATE notifications SET unread = 0 WHERE user_id = ?').run(req.user.id);
  res.json({ ok: true });
});
router.post('/notifications/:id/read', requireAuth, async (req, res) => {
  await db.prepare('UPDATE notifications SET unread = 0 WHERE user_id = ? AND id = ?').run(req.user.id, req.params.id);
  res.json({ ok: true });
});

module.exports = router;
