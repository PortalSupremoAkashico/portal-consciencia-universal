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
  if (!res.ok) console.error(`Supabase ${res.status} em ${path}:`, JSON.stringify(data).slice(0, 300));
  return { ok: res.ok, status: res.status, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!SUPABASE_KEY) {
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // ── SALVAR CONSULTA ──
  if (req.method === 'POST') {
    const { action } = req.body;

    if (action === 'salvar') {
      const { email, nome, data_nascimento, sexo, tema, estado, pergunta, sections } = req.body;

      if (!email || !pergunta) {
        return res.status(400).json({ error: 'Dados obrigatórios ausentes.' });
      }

      // Busca o ID do consulente pelo email
      let consulente_id = null;
      const userRes = await supabaseFetch(
        `/consulentes?email=eq.${encodeURIComponent(email)}&select=id`,
        { method: 'GET' }
      );
      if (userRes.ok && Array.isArray(userRes.data) && userRes.data.length > 0) {
        consulente_id = userRes.data[0].id;
      }

      const insert = await supabaseFetch('/consultas', {
        method: 'POST',
        body: JSON.stringify({
          consulente_id,
          nome,
          email,
          data_nascimento,
          sexo,
          tema,
          estado,
          pergunta,
          revelation:          (sections?.revelation         || '').slice(0, 5000),
          earth_future:        (sections?.earthFuture        || '').slice(0, 3000),
          other_civilizations: (sections?.evolution || sections?.otherCivilizations || '').slice(0, 3000),
          technology_future:   (sections?.technologyFuture   || '').slice(0, 3000),
          warning:             (sections?.warning            || '').slice(0, 2000),
          action:              (sections?.action             || '').slice(0, 2000),
          audio_url: null
        })
      });

      if (!insert.ok) {
        return res.status(500).json({ error: 'Erro ao salvar consulta.' });
      }

      // Retorna o ID para o cliente gerar e salvar o áudio
      const consulta_id = Array.isArray(insert.data) ? insert.data[0]?.id : insert.data?.id;
      return res.status(200).json({ success: true, consulta_id });
    }

    // ── APAGAR CONSULTA ──
    if (action === 'apagar_consulta') {
      const { id } = req.body;
      if (!id) return res.status(400).json({ error: 'ID obrigatório.' });

      const del = await supabaseFetch(`/consultas?id=eq.${id}`, { method: 'DELETE' });
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }

    // ── APAGAR TODAS AS CONSULTAS DE UM CONSULENTE ──
    if (action === 'apagar_consulente') {
      const { email } = req.body;
      if (!email) return res.status(400).json({ error: 'Email obrigatório.' });

      const del = await supabaseFetch(
        `/consultas?email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE' }
      );
      return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  // ── LISTAR CONSULTAS (admin) ──
  if (req.method === 'GET') {
    const { email } = req.query;

    let path = '/consultas?order=created_at.desc&select=id,nome,email,tema,estado,pergunta,created_at,revelation,earth_future,other_civilizations,technology_future,warning,action,audio_url';

    if (email) {
      path += `&email=eq.${encodeURIComponent(email)}`;
    }

    const result = await supabaseFetch(path, { method: 'GET' });

    if (!result.ok) {
      return res.status(500).json({ error: 'Erro ao buscar consultas.' });
    }

    return res.status(200).json({ success: true, consultas: result.data });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
