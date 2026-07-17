import { next } from '@vercel/functions';

const COOKIE_NAME = 'pcu_session';
const SECRET = process.env.SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const config = {
  matcher: [
    '/consulta', '/consulta.html',
    '/mentoria', '/mentoria.html',
    '/historico', '/historico.html',
    '/perfil', '/perfil.html',
    '/reflexoes', '/reflexoes.html',
    '/meditacao', '/meditacao.html',
    '/sonho', '/sonho.html',
    '/mentor-ufologico', '/mentor-ufologico.html',
    '/frequencias', '/frequencias.html',
    '/gerar-cliques', '/gerar-cliques.html',
    '/gerar-sons', '/gerar-sons.html',
    '/ritual', '/ritual-fala.html',
    '/gerar-ritual', '/gerar-audio-ritual.html'
  ]
};

function getCookie(request, name) {
  const raw = request.headers.get('cookie') || '';
  for (const item of raw.split(';')) {
    const index = item.indexOf('=');
    if (index < 0) continue;
    const key = item.slice(0, index).trim();
    if (key === name) return decodeURIComponent(item.slice(index + 1).trim());
  }
  return '';
}

function base64urlToBytes(value) {
  let base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function verifySession(token) {
  if (!SECRET || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;

  try {
    const [payloadB64, signatureB64] = parts;
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const validSignature = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlToBytes(signatureB64),
      encoder.encode(payloadB64)
    );
    if (!validSignature) return false;

    const payload = JSON.parse(decoder.decode(base64urlToBytes(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    return Boolean(payload.email && payload.exp && payload.exp > now);
  } catch {
    return false;
  }
}

export default async function middleware(request) {
  const token = getCookie(request, COOKIE_NAME);
  if (await verifySession(token)) {
    return next({
      headers: {
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow, noarchive'
      }
    });
  }

  const target = new URL('/', request.url);
  target.searchParams.set('acesso', 'restrito');
  const response = Response.redirect(target, 302);
  response.headers.append(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
