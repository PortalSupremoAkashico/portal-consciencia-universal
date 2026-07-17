import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE_NAME = 'pcu_session';

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, item) => {
    const index = item.indexOf('=');
    if (index > -1) acc[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
    return acc;
  }, {});
}

function verifyToken(token) {
  if (!SESSION_SECRET || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expected = createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')); }
  catch { return null; }

  if (!payload.email || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

export default async function handler(req, res) {
  const cookies = parseCookies(req);
  const rawToken = cookies[COOKIE_NAME];
  const session = verifyToken(rawToken);

  if (!session) {
    res.setHeader('Cache-Control', 'no-store');

    // Primeiro acesso sem sessão: mostra a página inicial do portal.
    // Sessão expirada/inválida: pede novo login e preserva o retorno.
    const destination = rawToken
      ? '/login?redirect=%2Fmentoria&sessao=expirada'
      : '/?acesso=restrito&destino=mentoria';

    res.setHeader('Location', destination);
    return res.status(302).end();
  }

  try {
    const html = await readFile(new URL('../mentoria.html', import.meta.url), 'utf8');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0, must-revalidate');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    return res.status(200).send(html);
  } catch (error) {
    console.error('Erro ao carregar Mentoria protegida:', error);
    return res.status(500).send('Não foi possível carregar a página protegida.');
  }
}
