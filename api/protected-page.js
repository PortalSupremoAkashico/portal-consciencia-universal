import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const COOKIE_NAME = 'pcu_session';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_FILES = new Set([
  'consulta.html',
  'mentoria.html',
  'historico.html',
  'perfil.html',
  'reflexoes.html',
  'meditacao.html',
  'sonho.html',
  'mentor-ufologico.html',
  'frequencias.html',
  'gerar-cliques.html',
  'gerar-sons.html',
  'ritual-fala.html',
  'gerar-audio-ritual.html'
]);

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((cookies, item) => {
    const index = item.indexOf('=');
    if (index > -1) {
      const key = item.slice(0, index).trim();
      const value = item.slice(index + 1).trim();
      try { cookies[key] = decodeURIComponent(value); }
      catch { cookies[key] = value; }
    }
    return cookies;
  }, {});
}

function signPayload(payloadB64) {
  return createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
}

function verifyToken(token) {
  if (!SESSION_SECRET || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expected = signPayload(payloadB64);
  const receivedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    receivedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    const now = Math.floor(Date.now() / 1000);
    if (!payload.email || !payload.exp || payload.exp <= now) return null;
    return payload;
  } catch {
    return null;
  }
}

async function loadHtml(filename) {
  const candidates = [
    path.join(process.cwd(), filename),
    fileURLToPath(new URL(`../${filename}`, import.meta.url))
  ];

  for (const candidate of candidates) {
    try { return await readFile(candidate, 'utf8'); }
    catch { /* tenta o próximo caminho */ }
  }
  throw new Error(`Arquivo protegido não encontrado: ${filename}`);
}

function redirectToIndex(res) {
  res.statusCode = 302;
  res.setHeader('Location', '/?acesso=restrito');
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    return res.end('Método não permitido');
  }

  const filename = String(req.query?.file || '');
  if (!ALLOWED_FILES.has(filename)) {
    res.statusCode = 404;
    return res.end('Página não encontrada');
  }

  const token = parseCookies(req)[COOKIE_NAME];
  const session = verifyToken(token);
  if (!session) return redirectToIndex(res);

  try {
    let html = await loadHtml(filename);

    // A sessão já foi validada acima. Injeta apenas os dados mínimos necessários
    // para a página iniciar imediatamente, sem uma segunda requisição e sem flash.
    const sessionForPage = JSON.stringify({
      id: String(session.sub || ''),
      email: String(session.email || ''),
      nome: String(session.nome || '')
    }).replace(/</g, '\\u003c');

    html = html.replace(
      /<head([^>]*)>/i,
      (headTag) => `${headTag}\n<script>window.__PCU_SERVER_SESSION__=${sessionForPage};<\/script>`
    );

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'private, no-store, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    if (req.method === 'HEAD') return res.end();
    return res.end(html);
  } catch (error) {
    console.error(error);
    res.statusCode = 500;
    res.setHeader('Cache-Control', 'no-store');
    return res.end('Não foi possível carregar esta área protegida.');
  }
}
