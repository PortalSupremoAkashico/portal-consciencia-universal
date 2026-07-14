const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) console.error(`Supabase ${res.status}:`, JSON.stringify(data).slice(0,200));
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const email = req.query?.email;
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
    const filter = email === 'all'
      ? `/meditacoes?order=created_at.desc&select=*`
      : `/meditacoes?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`;
    const result = await supabaseFetch(filter);
    if (!result.ok) return res.status(500).json({ error: 'Erro ao buscar meditações.' });
    return res.status(200).json({ success: true, meditacoes: result.data || [] });
  }

  if (req.method === 'POST') {
    const { action, email, dados, id } = req.body;

    if (action === 'salvar') {
      if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const insert = await supabaseFetch('/meditacoes', {
        method: 'POST',
        body: JSON.stringify({ email, dados })
      });
      if (!insert.ok) return res.status(500).json({ error: 'Erro ao salvar meditação.' });
      const registro = Array.isArray(insert.data) ? insert.data[0] : insert.data;
      return res.status(200).json({ success: true, id: registro?.id });
    }

    if (action === 'salvar_audio_url') {
      const { med_id, audio_url } = req.body;
      if (!med_id || !audio_url || !email) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const upd = await supabaseFetch(
        `/meditacoes?id=eq.${med_id}&email=eq.${encodeURIComponent(email)}`,
        { method: 'PATCH', body: JSON.stringify({ audio_url }) }
      );
      return res.status(upd.ok ? 200 : 500).json(upd.ok ? { success: true } : { error: 'Erro ao salvar URL.' });
    }

    // ── OBTER URL ASSINADA PARA UPLOAD DE ÁUDIO (evita o limite de tamanho de
    // requisição da Vercel — o áudio vai direto do navegador pro Supabase Storage) ──
    if (action === 'obter_url_upload_audio') {
      const { med_id } = req.body;
      if (!email || !med_id) return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });

      // Confirma que essa meditação realmente pertence a esse e-mail antes de autorizar o upload
      const dono = await supabaseFetch(
        `/meditacoes?id=eq.${med_id}&email=eq.${encodeURIComponent(email)}&select=id`,
        { method: 'GET' }
      );
      if (!dono.ok || !Array.isArray(dono.data) || dono.data.length === 0) {
        return res.status(403).json({ error: 'Meditação não encontrada para este usuário.' });
      }

      const emailArquivo = String(email).replace(/[^a-zA-Z0-9]/g, '_');
      const fn = `${emailArquivo}_${med_id}.mp3`;

      const signResp = await fetch(`${SUPABASE_URL}/storage/v1/object/upload/sign/meditacoes-audio/${fn}`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ upsert: true })
      });

      if (!signResp.ok) {
        const errTxt = await signResp.text().catch(() => '');
        console.error('Erro ao assinar upload de áudio de meditação:', signResp.status, errTxt.slice(0, 300));
        return res.status(500).json({ error: 'Erro ao preparar upload do áudio.' });
      }

      const signData = await signResp.json().catch(() => ({}));
      if (!signData.url) {
        return res.status(500).json({ error: 'Resposta inválida ao assinar upload.' });
      }

      return res.status(200).json({
        success: true,
        uploadUrl: `${SUPABASE_URL}/storage/v1${signData.url}`,
        publicUrl: `${SUPABASE_URL}/storage/v1/object/public/meditacoes-audio/${fn}`
      });
    }

    if (action === 'apagar_um') {
      if (!id || !email) return res.status(400).json({ error: 'ID e email obrigatórios.' });
      const del = await supabaseFetch(
        `/meditacoes?id=eq.${id}&email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }

    if (action === 'apagar') {
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
      const del = await supabaseFetch(
        `/meditacoes?email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
