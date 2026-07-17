import { createHmac, timingSafeEqual } from 'node:crypto';

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const COOKIE_NAME = 'pcu_session';

// ── Mesma verificação de sessão usada em api/session.js ──
function base64url(input) {
  return Buffer.from(input).toString('base64url');
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_KEY || !SESSION_SECRET) {
    return res.status(500).json({ error: 'Configuração de sessão incompleta no servidor.' });
  }

  try {
    // ── Confere se quem está enviando a foto está realmente logado ──
    const token = parseCookies(req)[COOKIE_NAME];
    const sessao = verifyToken(token);
    if (!sessao || !sessao.email) {
      return res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
    }

    const { imageBase64 } = req.body || {};
    if (!imageBase64) {
      return res.status(400).json({ error: 'Imagem é obrigatória.' });
    }

    // O e-mail usado é sempre o da sessão logada — nunca o que vier do
    // corpo da requisição — para impedir que alguém troque a foto de outra conta.
    const emailNorm = sessao.email.toLowerCase().trim();

    // Confirma que o e-mail pertence a um consulente cadastrado antes de gravar
    const checkResp = await fetch(
      `${SUPABASE_URL}/rest/v1/consulentes?email=eq.${encodeURIComponent(emailNorm)}&select=id`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const rows = await checkResp.json().catch(() => []);
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    // Limite de 2MB (o base64 chega ~33% maior que o binário original)
    const sizeBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (sizeBytes > 2 * 1024 * 1024) {
      return res.status(400).json({ error: 'Foto muito grande. Máximo 2MB.' });
    }

    let buffer;
    try {
      buffer = Buffer.from(imageBase64, 'base64');
    } catch {
      return res.status(400).json({ error: 'Imagem inválida.' });
    }

    const key = emailNorm.replace(/[^a-z0-9]/gi, '_');

    const upResp = await fetch(`${SUPABASE_URL}/storage/v1/object/avatars/${key}.jpg`, {
      method: 'PUT',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'image/jpeg',
        'x-upsert': 'true'
      },
      body: buffer
    });

    if (!upResp.ok) {
      const errTxt = await upResp.text().catch(() => '');
      console.error('Erro ao enviar avatar:', upResp.status, errTxt.slice(0, 300));
      return res.status(500).json({ error: 'Erro ao enviar foto.' });
    }

    return res.status(200).json({
      success: true,
      url: `${SUPABASE_URL}/storage/v1/object/public/avatars/${key}.jpg`
    });
  } catch (e) {
    console.error('avatar.js erro:', e);
    return res.status(500).json({ error: 'Erro interno.' });
  }
}
