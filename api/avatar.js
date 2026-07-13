const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, imageBase64 } = req.body || {};
    if (!email || !imageBase64) {
      return res.status(400).json({ error: 'Email e imagem são obrigatórios.' });
    }

    const emailNorm = String(email).toLowerCase().trim();

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
