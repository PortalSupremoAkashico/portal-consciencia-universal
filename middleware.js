// A proteção das páginas internas é feita por vercel.json + api/protected-page.js.
// Este arquivo apenas neutraliza versões anteriores do middleware.
export const config = { matcher: '/__pcu_middleware_desativado__' };
export default function middleware() {
  return new Response(null, { status: 204 });
}
