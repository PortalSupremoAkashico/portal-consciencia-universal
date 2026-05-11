export const config = { maxDuration: 60 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const BUCKET = 'audio-consultas';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OpenAI API key não configurada.' });

  try {
    const { text, consulta_id, save } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Texto obrigatório.' });

    const cleanText = text.slice(0, 4000).trim();

    // ── Gera o áudio na OpenAI ──
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'onyx',
        input: cleanText,
        speed: 0.92,
        response_format: 'mp3'
      })
    });

    if (!ttsRes.ok) {
      const err = await ttsRes.json().catch(() => ({}));
      return res.status(500).json({ error: err.error?.message || `OpenAI error ${ttsRes.status}` });
    }

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    // ── Se pedir para salvar (consulta completa) → Supabase Storage ──
    if (save && consulta_id && SUPABASE_KEY) {
      const fileName = `consultas/${consulta_id}.mp3`;

      const uploadRes = await fetch(
        `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${fileName}`,
        {
          method: 'POST',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'audio/mpeg',
            'x-upsert': 'true'
          },
          body: audioBuffer
        }
      );

      if (uploadRes.ok) {
        const audio_url = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${fileName}`;

        // Salva a URL na tabela consultas
        await fetch(`${SUPABASE_URL}/rest/v1/consultas?id=eq.${consulta_id}`, {
          method: 'PATCH',
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ audio_url })
        });

        return res.status(200).json({ success: true, audio_url });
      }
    }

    // ── Modo imediato (preview ao vivo) → retorna MP3 direto ──
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(audioBuffer);

  } catch (err) {
    console.error('TTS error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
