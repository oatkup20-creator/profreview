# ProfReview — ระบบรีวิวรายวิชาและอาจารย์

แปลงจากหน้าจอต้นแบบ Google Stitch 7 หน้า ให้เป็นเว็บแอปที่ใช้งานได้จริง
**Frontend:** HTML / CSS / JavaScript ล้วน (ไม่ต้อง build) • **Backend:** Node.js + Express + SQLite (libSQL) — รันในเครื่องได้ และนำขึ้นออนไลน์ด้วย Render + Turso ได้ฟรี

## วิธีรัน

ต้องมี Node.js เวอร์ชัน 20 ขึ้นไป

```bash
npm install
npm start
```

> Windows: ถ้าขึ้น `npm.ps1 cannot be loaded` ให้ใช้ `npm.cmd install` และ `npm.cmd start` แทน

แล้วเปิด http://localhost:3000

**บัญชีทดลอง:** รหัสนักศึกษา `6501012345` รหัสผ่าน `password`
(หรือกด “สมัครสมาชิก” เพื่อสร้างบัญชีใหม่ ใช้อีเมลที่ลงท้ายด้วย .ac.th หรือ .edu)

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm start` | รันเซิร์ฟเวอร์ |
| `npm run dev` | รันแบบรีสตาร์ตอัตโนมัติเมื่อแก้โค้ด |
| `npm run reset-db` | ล้างฐานข้อมูลแล้วใส่ข้อมูลตัวอย่างใหม่ |

เปลี่ยนพอร์ตได้ด้วย `PORT=8080 npm start`

## หน้าเว็บ

| หน้า | ไฟล์ | ทำอะไรได้ |
|---|---|---|
| เข้าสู่ระบบ / สมัครสมาชิก | `login.html` | ตรวจรูปแบบรหัสนักศึกษา อีเมลสถาบัน รหัสผ่าน, จดจำการเข้าสู่ระบบ |
| แผงควบคุม | `index.html` | ค้นหาวิชา/อาจารย์, สถิติภาพรวม, วิชายอดนิยม, อาจารย์แนะนำ, รีวิวล่าสุด |
| รายชื่อวิชา | `courses.html` | ค้นหา, กรองหมวด, เรียงลำดับ, แบ่งหน้า, บันทึกวิชา, ดูรายละเอียด + รีวิว |
| รายชื่ออาจารย์ | `professors.html` | ค้นหา, กรองคณะ, ดูโปรไฟล์ คะแนน และรีวิว |
| แบบจำลองตารางเรียน | `schedule.html` | เพิ่ม/ถอนวิชาเลือก, ตรวจเวลาชนและหน่วยกิตเกิน 22, วิเคราะห์ความสมดุล, พิมพ์เป็น PDF |
| ศูนย์เขียนรีวิว | `reviews.html` | เขียนรีวิว (มีตัวอย่างสด), รีวิวของฉัน, ลบรีวิว, รีวิวยอดนิยม |

ทุกหน้ามี: แจ้งเตือน, ค้นหาด่วน (กด `/`), กดถูกใจรีวิว, รายงานรีวิวไม่เหมาะสม, ตั้งค่าโปรไฟล์, ออกจากระบบ และรองรับมือถือ

## โครงสร้างโปรเจกต์

```
server.js               เซิร์ฟเวอร์ Express
routes/api.js           REST API ทั้งหมด
lib/auth.js             ระบบล็อกอิน (session cookie แบบ httpOnly, รหัสผ่านเข้ารหัสด้วย bcrypt)
lib/queries.js          คำสั่ง SQL ที่ใช้ซ้ำ + คำนวณคะแนนเฉลี่ย
db/database.js          เชื่อมต่อฐานข้อมูล (ไฟล์ในเครื่อง หรือ Turso) + สร้างตาราง + ใส่ข้อมูลตัวอย่างครั้งแรก
db/seed-data.json       ข้อมูลวิชา อาจารย์ รีวิว ที่ดึงมาจากไฟล์ Stitch
public/                 หน้าเว็บ
  css/styles.css        ดีไซน์ซิสเต็มทั้งหมด (สี ตัวอักษร การ์ด ปุ่ม ฟอร์ม modal ฯลฯ)
  js/api.js             ตัวช่วยเรียก API
  js/ui.js              ตัวช่วย UI (toast, modal, ดาว, วันที่ไทย, แบ่งหน้า)
  js/layout.js          แถบบน + เมนูข้าง + แจ้งเตือน + ค้นหา (ใช้ร่วมทุกหน้า)
  js/components.js      การ์ดวิชา/อาจารย์/รีวิว + หน้าต่างรายละเอียด + หน้าต่างรายงาน
  js/pages/*.js         โค้ดเฉพาะของแต่ละหน้า
```

## API

| Method | Path | คำอธิบาย |
|---|---|---|
| POST | `/api/auth/register` | สมัครสมาชิก |
| POST | `/api/auth/login` · `/api/auth/logout` | เข้า / ออกจากระบบ |
| GET | `/api/me` · PATCH `/api/me/settings` | ข้อมูลผู้ใช้ / ตั้งค่า |
| GET | `/api/stats` · `/api/search?q=` | สถิติรวม / ค้นหาด่วน |
| GET | `/api/courses` · `/api/courses/:code` | รายชื่อวิชา (q, category, sort, page, saved) / รายละเอียด |
| GET | `/api/professors` · `/api/professors/:id` | รายชื่ออาจารย์ (q, faculty, sort, page) / รายละเอียด |
| GET/POST | `/api/reviews` · DELETE `/api/reviews/:id` | รีวิว (scope=mine, type, sort=helpful) / เขียน / ลบ |
| POST | `/api/reviews/:id/helpful` | กด/ยกเลิก ถูกใจ |
| POST | `/api/reports` | รายงานรีวิว |
| GET/POST | `/api/saved` | รายการที่บันทึก / บันทึก-ยกเลิก |
| GET/POST | `/api/schedule` · DELETE `/api/schedule/:id` · POST `/api/schedule/reset` | ตารางเรียน |
| GET | `/api/notifications` · POST `/read-all` · POST `/:id/read` | การแจ้งเตือน |

## นำขึ้นออนไลน์ (ฟรี) — Render + Turso

1. **Turso (ฐานข้อมูล):** สมัครที่ turso.tech → สร้าง Database → คัดลอก **Database URL** (ขึ้นต้นด้วย `libsql://`) และกดสร้าง **Token**
2. **GitHub:** สร้าง repository ใหม่ → อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้ (ยกเว้น `node_modules` และ `db/profreview.db`)
3. **Render (เว็บ):** สมัครที่ render.com ด้วยบัญชี GitHub → New → **Web Service** → เลือก repository
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Instance Type: **Free**
   - Environment Variables:
     - `TURSO_DATABASE_URL` = Database URL จากข้อ 1
     - `TURSO_AUTH_TOKEN` = Token จากข้อ 1
     - `NODE_ENV` = `production`
4. กด Deploy รอ 2-3 นาที จะได้ลิงก์ `https://ชื่อเว็บ.onrender.com` ส่งให้ใครก็ได้

ข้อมูลจะเก็บอยู่บน Turso ถาวร แม้เว็บรีสตาร์ต — แผนฟรีของ Render จะพักเว็บเมื่อไม่มีคนเข้า 15 นาที คนแรกที่เข้าหลังจากนั้นต้องรอประมาณ 1 นาที

## หมายเหตุ

- ข้อมูลวิชา อาจารย์ และรีวิวทั้งหมดเป็นข้อมูลตัวอย่างจากไฟล์ต้นแบบ
- รูปอาจารย์ใช้ลิงก์รูปเดิมจาก Stitch ถ้าลิงก์หมดอายุหรือโหลดไม่ได้ ระบบจะแสดงอักษรย่อแทนอัตโนมัติ
- คะแนนเฉลี่ยคำนวณจาก “คะแนนสะสมเดิม” รวมกับรีวิวที่เขียนในระบบ จึงขยับตามรีวิวใหม่
- รายงานรีวิวถูกเก็บในตาราง `reports` (สถานะ `pending`) สำหรับทำหน้าแอดมินต่อในอนาคต
- ฟอนต์และไอคอนโหลดจาก Google Fonts (ต้องต่ออินเทอร์เน็ต)
- ก่อนนำขึ้นใช้งานจริง ให้ตั้ง `NODE_ENV=production` และเปิดผ่าน HTTPS เพื่อให้ cookie ปลอดภัย
