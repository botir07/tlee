import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const COOKIE = 'volta_session';
const cookieBase = 'Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800';
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
function getToken(request) {
  const raw = request.headers.get('cookie') || '';
  const pair = raw.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(COOKIE.length + 1)) : null;
}
function getUser(request) {
  const token = getToken(request);
  if (!token) return null;
  try { return jwt.verify(token, process.env.JWT_SECRET); } catch { return null; }
}
let schemaReady = null;
function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = sql`CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`.catch(e => { schemaReady = null; throw e; });
  }
  return schemaReady;
}
export default async (request) => {
  if (!process.env.DATABASE_URL || !process.env.JWT_SECRET) return json({ error: 'Server sozlamalari to‘liq emas.' }, 500);
  const sql = neon(process.env.DATABASE_URL);
  try { await ensureSchema(sql); } catch (e) { console.error(e); return json({ error: 'Ma’lumotlar bazasiga ulanib bo‘lmadi.' }, 500); }
  const url = new URL(request.url);
  if (request.method === 'GET' && url.searchParams.get('action') === 'me') {
    const user = getUser(request);
    return user ? json({ user: { id: user.id, name: user.name, email: user.email } }) : json({ error: 'Kirish talab qilinadi.' }, 401);
  }
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Noto‘g‘ri so‘rov.' }, 400); }
  const { action, email, password, name } = body;
  if (action === 'logout') return json({ ok: true }, 200, { 'Set-Cookie': `${COOKIE}=; ${cookieBase}; Max-Age=0` });
  if (!['login', 'register'].includes(action)) return json({ error: 'Noma’lum amal.' }, 400);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(cleanEmail) || typeof password !== 'string' || password.length < 8 || password.length > 72) return json({ error: 'Email yoki parol formati noto‘g‘ri. Parol 8–72 belgi bo‘lsin.' }, 400);
  let row;
  if (action === 'register') {
    const cleanName = String(name || '').trim().slice(0, 80);
    if (cleanName.length < 2) return json({ error: 'Ism kamida 2 ta belgidan iborat bo‘lsin.' }, 400);
    const hash = await bcrypt.hash(password, 12);
    try {
      const rows = await sql`INSERT INTO users (name, email, password_hash) VALUES (${cleanName}, ${cleanEmail}, ${hash}) RETURNING id, name, email`;
      row = rows[0];
    } catch (e) {
      if (e.code === '23505') return json({ error: 'Bu email bilan hisob avval yaratilgan.' }, 409);
      console.error(e); return json({ error: 'Hisob yaratishda xatolik.' }, 500);
    }
  } else {
    const rows = await sql`SELECT id, name, email, password_hash FROM users WHERE email = ${cleanEmail} LIMIT 1`;
    row = rows[0];
    if (!row || !(await bcrypt.compare(password, row.password_hash))) return json({ error: 'Email yoki parol noto‘g‘ri.' }, 401);
  }
  const token = jwt.sign({ id: row.id, name: row.name, email: row.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
  return json({ ok: true, user: { id: row.id, name: row.name, email: row.email } }, 200, { 'Set-Cookie': `${COOKIE}=${encodeURIComponent(token)}; ${cookieBase}` });
};
