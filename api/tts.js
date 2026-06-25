export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const OPENAI_KEY = process.env.OPENAI_API_KEY;
  if (!OPENAI_KEY) return res.status(500).json({ error: 'OPENAI_API_KEY não configurada no Vercel.' });

  try {
    const { text, speed } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ error: 'Texto obrigatório.' });

    const cleanText = text.trim();
    console.log('[TTS] chars:', cleanText.length, 'speed:', speed);

    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'onyx',
        input: cleanText,
        speed: speed || 0.92,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const errMsg = `OpenAI ${response.status}: ${errBody.slice(0, 200)}`;
      console.error('[TTS] OpenAI error:', errMsg);
      return res.status(500).json({ error: errMsg });
    }

    const audioBuffer = await response.arrayBuffer();
    console.log('[TTS] OK, bytes:', audioBuffer.byteLength);
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(Buffer.from(audioBuffer));

  } catch (err) {
    console.error('[TTS] catch:', err.message);
    res.status(500).json({ error: err.message });
  }
}
