// หน้าเข้าสู่ระบบ / สมัครสมาชิก
import { api } from '../api.js';
import { $, $$, toast, showFieldErrors } from '../ui.js';

const params = new URLSearchParams(location.search);
const next = (() => {
  const n = params.get('next') || '/';
  return n.startsWith('/') && !n.startsWith('//') ? n : '/'; // กัน open redirect
})();

// ถ้าล็อกอินอยู่แล้วให้เข้าหน้าหลักเลย
fetch('/api/auth/status', { credentials: 'same-origin' }).then(r => r.json()).then(d => { if (d.loggedIn) location.replace(next); }).catch(() => {});

function show(view) {
  $('#view-signup').hidden = view !== 'signup';
  $('#view-signin').hidden = view !== 'signin';
  $('#subheading').textContent = view === 'signup' ? 'สมัครสมาชิกเพื่อเข้าสู่ระบบพอร์ทัลนักศึกษา' : 'เข้าสู่ระบบพอร์ทัลนักศึกษาเพื่ออ่านและเขียนรีวิว';
  document.title = (view === 'signup' ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ') + ' | ProfReview';
  (view === 'signup' ? $('#su-id') : $('#si-account')).focus();
}
show(params.get('mode') === 'signup' ? 'signup' : 'signin');

$$('[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
$$('[data-eye]').forEach(b => b.addEventListener('click', () => {
  const input = document.getElementById(b.dataset.eye);
  const showing = input.type === 'text';
  input.type = showing ? 'password' : 'text';
  b.querySelector('.icon').textContent = showing ? 'visibility' : 'visibility_off';
  b.setAttribute('aria-label', showing ? 'แสดงรหัสผ่าน' : 'ซ่อนรหัสผ่าน');
}));
$$('[data-terms]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('รีวิวต้องเป็นความจริง สุภาพ และไม่โจมตีบุคคล — ระบบไม่เปิดเผยรหัสนักศึกษาเมื่อเลือกโหมดไม่ระบุตัวตน'); }));
$('#forgot').addEventListener('click', e => { e.preventDefault(); toast('กรุณาติดต่อแผนกทะเบียนสถาบันการศึกษาเพื่อขอรีเซ็ตรหัสผ่าน'); });

// ---------- สมัครสมาชิก ----------
function validateSignup(f) {
  const e = {};
  if (!/^\d{8,10}$/.test(f.studentId.value.trim())) e.studentId = 'รหัสนักศึกษาต้องเป็นตัวเลข 8-10 หลัก';
  if (!/^[^\s@]+@[^\s@]+\.(ac\.th|edu)$/i.test(f.email.value.trim())) e.email = 'ต้องมี @ และลงท้ายด้วย .ac.th หรือ .edu เท่านั้น';
  if (f.password.value.length < 6) e.password = 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร';
  if (!f.confirm.value || f.confirm.value !== f.password.value) e.confirm = 'รหัสผ่านทั้งสองช่องไม่ตรงกัน';
  if (!f.acceptTerms.checked) e.terms = 'กรุณากดยอมรับเงื่อนไขการใช้งานก่อนดำเนินการต่อ';
  return e;
}

$('#signup-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target;
  const alert = $('#signup-alert');
  const errs = validateSignup(f);
  showFieldErrors(f, errs);
  if (Object.keys(errs).length) {
    alert.textContent = '❌ ข้อมูลไม่ถูกต้อง! กรุณาตรวจสอบและแก้ไขข้อมูลให้ครบถ้วนถูกต้อง';
    alert.hidden = false;
    return;
  }
  alert.hidden = true;
  const btn = $('#su-submit');
  btn.disabled = true;
  try {
    const r = await api('/auth/register', {
      method: 'POST',
      body: { studentId: f.studentId.value.trim(), email: f.email.value.trim(), password: f.password.value, acceptTerms: true },
    });
    f.reset();
    show('signin');
    $('#si-account').value = r.studentId;
    $('#signin-success').hidden = false;
    $('#si-pass').focus();
  } catch (err) {
    showFieldErrors(f, err.fields);
    alert.textContent = '❌ ' + err.message;
    alert.hidden = false;
  } finally { btn.disabled = false; }
});

// ---------- เข้าสู่ระบบ ----------
$('#signin-form').addEventListener('submit', async ev => {
  ev.preventDefault();
  const f = ev.target;
  const alert = $('#signin-alert');
  if (!f.account.value.trim() || !f.password.value) {
    alert.textContent = 'กรุณากรอกรหัสนักศึกษา/อีเมล และรหัสผ่าน';
    alert.hidden = false;
    return;
  }
  const btn = $('#si-submit');
  btn.disabled = true;
  btn.textContent = 'กำลังเข้าสู่ระบบ...';
  try {
    await api('/auth/login', { method: 'POST', body: { account: f.account.value.trim(), password: f.password.value, remember: f.remember.checked } });
    location.replace(next);
  } catch (err) {
    alert.textContent = err.message;
    alert.hidden = false;
    $('#signin-success').hidden = true;
    btn.disabled = false;
    btn.textContent = 'เข้าสู่ระบบ (Sign In)';
  }
});
