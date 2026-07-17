import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE_NAME = 'pcu_session';
const SESSION_SECONDS = 12 * 60 * 60;

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function signPayload(payloadB64) {
  return createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
}

function createToken(user) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 1,
    sub: String(user.id || ''),
    email: String(user.email || '').toLowerCase().trim(),
    nome: String(user.nome || ''),
    iat: now,
    exp: now + SESSION_SECONDS
  };
  const encoded = base64url(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

function verifyToken(token) {
  if (!SESSION_SECRET || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, signature] = parts;
  const expected = signPayload(payloadB64);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload;
  try { payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')); }
  catch { return null; }
  if (!payload.email || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function parseCookies(req) {
  const raw = req.headers.cookie || '';
  return raw.split(';').reduce((acc, item) => {
    const index = item.indexOf('=');
    if (index > -1) acc[item.slice(0, index).trim()] = decodeURIComponent(item.slice(index + 1).trim());
    return acc;
  }, {});
}

function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_SECONDS}`);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

async function supabaseFetch(path) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  const data = await response.json().catch(() => []);
  return { ok: response.ok, data };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });
  if (!SUPABASE_KEY || !SESSION_SECRET) return res.status(500).json({ error: 'Configuração de sessão incompleta no servidor.' });

  const action = req.body?.action;

  if (action === 'logout') {
    clearSessionCookie(res);
    return res.status(200).json({ success: true });
  }

  if (action === 'verify') {
    const token = parseCookies(req)[COOKIE_NAME];
    const payload = verifyToken(token);
    if (!payload) return res.status(401).json({ valid: false, error: 'Sessão inválida ou expirada.' });

    const result = await supabaseFetch(`/consulentes?email=eq.${encodeURIComponent(payload.email)}&select=id,nome,email,data_nascimento,sexo,cidade,estado,pais,nome_pai,nome_mae&limit=1`);
    if (!result.ok || !Array.isArray(result.data) || !result.data.length) {
      clearSessionCookie(res);
      return res.status(401).json({ valid: false, error: 'Usuário não encontrado.' });
    }
    const user = result.data[0];
    return res.status(200).json({
      valid: true,
      user: { id: user.id, nome: user.nome, email: user.email, data: user.data_nascimento, sexo: user.sexo, cidade: user.cidade, estado: user.estado, pais: user.pais, nome_pai: user.nome_pai, nome_mae: user.nome_mae }
    });
  }

  if (action === 'create') {
    const email = String(req.body?.email || '').toLowerCase().trim();
    const senhaHash = String(req.body?.senha_hash || '');
    if (!email || !senhaHash) return res.status(400).json({ error: 'Credenciais obrigatórias ausentes.' });

    const result = await supabaseFetch(`/consulentes?email=eq.${encodeURIComponent(email)}&select=id,nome,email,senha_hash,data_nascimento,sexo,cidade,estado,pais,nome_pai,nome_mae&limit=1`);
    if (!result.ok || !Array.isArray(result.data) || !result.data.length) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }
    const user = result.data[0];
    const provided = Buffer.from(senhaHash);
    const stored = Buffer.from(String(user.senha_hash || ''));
    if (provided.length !== stored.length || !timingSafeEqual(provided, stored)) {
      return res.status(401).json({ error: 'Credenciais inválidas.' });
    }

    const token = createToken(user);
    setSessionCookie(res, token);
    return res.status(200).json({
      success: true,
      user: { id: user.id, nome: user.nome, email: user.email, data: user.data_nascimento, sexo: user.sexo, cidade: user.cidade, estado: user.estado, pais: user.pais, nome_pai: user.nome_pai, nome_mae: user.nome_mae }
    });
  }

  return res.status(400).json({ error: 'Ação desconhecida.' });
}
