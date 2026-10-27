// ProfReview — Express server
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { init } = require('./db/database');
const { loadUser } = require('./lib/auth');
const api = require('./routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

app.disable('x-powered-by');
app.set('trust proxy', 1); // จำเป็นเมื่อรันหลัง proxy เช่น Render เพื่อให้ cookie แบบ secure ทำงาน
app.use(express.json({ limit: '50kb' }));
app.use(cookieParser());
app.use(loadUser);

app.use('/api', api);
app.use('/api', (req, res) => res.status(404).json({ error: 'ไม่พบ API นี้' }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err);
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'ข้อมูลที่ส่งมาไม่ถูกต้อง' });
  res.status(500).json({ error: 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
});

init()
  .then(() => app.listen(PORT, () => console.log(`🎓 ProfReview พร้อมใช้งานที่ http://localhost:${PORT}`)))
  .catch(err => {
    console.error('❌ เชื่อมต่อฐานข้อมูลไม่สำเร็จ:', err.message);
    process.exit(1);
  });
