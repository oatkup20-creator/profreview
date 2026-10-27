// ลบฐานข้อมูลในเครื่อง แล้วสร้างใหม่พร้อมข้อมูลตัวอย่าง: npm run reset-db
// (ใช้กับไฟล์ในเครื่องเท่านั้น จะไม่ลบข้อมูลบน Turso)
const fs = require('fs');
const path = require('path');

if (process.env.TURSO_DATABASE_URL) {
  console.error('ไม่รีเซ็ต: ตอนนี้ตั้งค่าให้ใช้ฐานข้อมูล Turso อยู่ (ลบข้อมูลออนไลน์ผ่านหน้าเว็บ Turso แทน)');
  process.exit(1);
}
const file = process.env.DB_FILE || path.join(__dirname, '..', 'db', 'profreview.db');
for (const f of [file, file + '-wal', file + '-shm']) if (fs.existsSync(f)) fs.unlinkSync(f);
require('../db/database').init().then(() => console.log('✔ รีเซ็ตฐานข้อมูลเรียบร้อย'));
