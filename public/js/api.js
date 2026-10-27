// ตัวช่วยเรียก REST API ของเซิร์ฟเวอร์
export class ApiError extends Error {
  constructor(message, status, fields) {
    super(message);
    this.status = status;
    this.fields = fields || {};
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  let data = null;
  try { data = await res.json(); } catch { /* ไม่มี body */ }
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth')) {
      const next = encodeURIComponent(location.pathname + location.search);
      location.href = `/login.html?next=${next}`;
    }
    throw new ApiError((data && data.error) || 'เกิดข้อผิดพลาด กรุณาลองใหม่', res.status, data && data.fields);
  }
  return data;
}

export const qs = params => {
  const p = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') p.set(k, v); });
  const s = p.toString();
  return s ? '?' + s : '';
};
