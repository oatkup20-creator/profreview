// ระบบล็อกอินด้วย session token ใน cookie (httpOnly)
const crypto = require('crypto');
const { db } = require('../db/database');

const COOKIE = 'pr_session';
const DAY = 24 * 60 * 60 * 1000;

async function createSession(res, userId, remember) {
  const token = crypto.randomBytes(32).toString('hex');
  const ttl = remember ? 30 * DAY : DAY;
  await db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?,?,?)').run(token, userId, Date.now() + ttl);
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: remember ? ttl : undefined, // ไม่ติ๊ก "จดจำ" = หมดอายุเมื่อปิดเบราว์เซอร์
  });
}

async function destroySession(req, res) {
  const token = req.cookies[COOKIE];
  if (token) await db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE);
}

/** ใส่ req.user ถ้ามี session ที่ยังไม่หมดอายุ (ไม่บังคับล็อกอิน) */
async function loadUser(req, _res, next) {
  try {
    const token = req.cookies[COOKIE];
    if (token) {
      const row = await db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
                                    WHERE s.token = ? AND s.expires_at > ?`).get(token, Date.now());
      if (row) req.user = row;
    }
    next();
  } catch (e) { next(e); }
}

/** บังคับว่าต้องล็อกอิน */
function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบก่อนใช้งาน' });
  next();
}

module.exports = { createSession, destroySession, loadUser, requireAuth };
