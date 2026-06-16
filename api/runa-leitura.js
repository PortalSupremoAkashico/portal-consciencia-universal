export const config = { maxDuration: 120 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const RUNAS = [
  { id:1,  nome:'Fehu',     sig:'Riqueza, prosperidade, abundância, energia vital criativa' },
  { id:2,  nome:'Uruz',     sig:'Força primitiva, saúde inabalável, poder selvagem, resistência' },
  { id:3,  nome:'Thurisaz', sig:'Proteção de Thor, portal transformador, obstáculos sagrados' },
  { id:4,  nome:'Ansuz',    sig:'Sabedoria de Odin, comunicação divina, mensagens dos deuses' },
  { id:5,  nome:'Raidho',   sig:'Jornada sagrada, ritmo cósmico, movimento e caminho espiritual' },
  { id:6,  nome:'Kenaz',    sig:'Tocha do conhecimento, criatividade, iluminação interior' },
  { id:7,  nome:'Gebo',     sig:'Presente sagrado, parceria equilibrada, troca de energias' },
  { id:8,  nome:'Wunjo',    sig:'Alegria profunda, harmonia, bem-estar, realização plena' },
  { id:9,  nome:'Hagalaz',  sig:'Tempestade purificadora, ruptura necessária, caos transformador' },
  { id:10, nome:'Nauthiz',  sig:'Necessidade, fogo interior, resistência criativa, perseverança' },
  { id:11, nome:'Isa',      sig:'Gelo cósmico, imobilidade reveladora, clareza cristalina' },
  { id:12, nome:'Jera',     sig:'Colheita sagrada, ciclos naturais, tempo certo, resultado plantado' },
  { id:13, nome:'Eihwaz',   sig:'Yggdrasil, morte e renascimento, eixo do mundo, transformação' },
  { id:14, nome:'Perthro',  sig:'Caldeirão do destino, mistério profundo, sorte, segredos revelados' },
  { id:15, nome:'Algiz',    sig:'Escudo divino, proteção sagrada, conexão com o alto, guarda' },
  { id:16, nome:'Sowilo',   sig:'Sol vitorioso, vontade divina, energia solar, sucesso luminoso' },
  { id:17, nome:'Tiwaz',    sig:'Justiça de Tyr, sacrifício nobre, integridade, guerra sagrada' },
  { id:18, nome:'Berkana',  sig:'Abedul sagrado, fertilidade, renovação, energia materna' },
  { id:19, nome:'Ehwaz',    sig:'Cavalos sagrados, parceria confiante, movimento conjunto' },
  { id:20, nome:'Mannaz',   sig:'Humanidade, o self, mente coletiva, espelho da alma' },
  { id:21, nome:'Laguz',    sig:'Lago sagrado, intuição, fluxo emocional, profundezas do ser' },
  { id:22, nome:'Ingwaz',   sig:'Semente do herói, conclusão fértil, potencial latente, gestação' },
  { id:23, nome:'Dagaz',    sig:'Aurora transformadora, despertar, limiar entre mundos, paradoxo' },
  { id:24, nome:'Othala',   sig:'Herança sagrada, lar ancestral, patrimônio espiritual, raízes' },
  { id:25, nome:'Wyrd',     sig:'Vazio sagrado, destino além do conhecimento, mistério absoluto' },
];

async function sbSalvarRuna(email, dados) {
  if (!SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/leituras_runas`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, dados: JSON.stringify(dados) })
    });
  } catch(e) { console.error('sbSalvarRuna:', e.message); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: buscar histórico de leituras ──
  if (req.method === 'GET') {
    const email = req.query?.email;
    if (!email) return res.status(400).json({ error: 'email obrigatório' });
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/leituras_runas?email=eq.${encodeURIComponent(email)}&order=created_at.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const rows = await r.json();
      return res.json({ success: true, leituras: rows || [] });
    } catch(e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).end();

  // ── POST: apagar leitura ──
  const body = req.body || {};
  if (body.action === 'apagar_um') {
    const { id, email } = body;
    if (!id || !email) return res.status(400).json({ error: 'id e email obrigatórios' });
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/leituras_runas?id=eq.${id}&email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      return res.json({ success: true });
    } catch(e) {
      return res.status(500).json({ success: false, error: e.message });
    }
  }

  // ── POST: nova leitura (streaming) ──
  const { nome, sexo, runas, tiragem, pergunta, email } = body;
  if (!runas || !runas.length) return res.status(400).json({ error: 'Runas obrigatórias.' });

  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];
  const perguntaReal = pergunta || 'leitura livre';

  const runasTexto = runas.map((r, i) =>
    `Runa ${i+1} — Posição "${r.posicao}": ${r.nome} — ${r.sig}`
  ).join('\n');

  const runasJson = runas.map((r, i) =>
    `"runa${i}": "[interpretação profunda da runa ${i+1} — ${r.nome} na posição ${r.posicao}]"`
  ).join(',\n  ');

  const tirNome = tiragem === '1' ? 'Uma Runa — Mensagem Direta' :
                  tiragem === '3' ? 'Três Runas — Meia Lua' : 'Cinco Runas — Cruz Nórdica';

  const prompt = `Você é um Oráculo Akáshico-Nórdico de elite. Lê as runas com profundidade mística para ${firstName}.

TRADIÇÃO COMBINADA: Elder Futhark + Registros Akáshicos — as runas são portais para os Registros Universais, cada símbolo carrega memória cósmica gravada pelos Ancestrais desde o início dos tempos.

CONSULENTE: ${firstName}
PERGUNTA: "${perguntaReal}"
TIRAGEM: ${tirNome}
RUNAS TIRADAS:
${runasTexto}

DIRETRIZES DE LEITURA PROFUNDA:
- Fale DIRETAMENTE com ${firstName} em segunda pessoa
- Conecte cada runa com os Registros Akáshicos E com a tradição nórdica
- Relacione cada runa especificamente com "${perguntaReal}" — não de forma genérica
- Mostre por que ESTA runa em ESTA posição é significativa para ${firstName}
- Conecte as runas entre si — mostre o padrão que emerge do conjunto
- Varie o tom — cada runa tem sua própria voz e energia
- A leitura deve fazer ${firstName} pensar: "Como eles sabem disso?"

Para cada runa escreva 3 parágrafos fluidos e ricos:
§1: O que esta runa carrega nos Registros Akáshicos — sua memória ancestral nórdica e energia cósmica específica
§2: Como esta energia se manifesta ESPECIFICAMENTE para você (${firstName}) nesta posição em relação a "${perguntaReal}"
§3: A mensagem dos Ancestrais e Guardiões Akáshicos para você — orientação concreta, amorosa e acionável

SINTESE: 3 parágrafos — (1) padrão rúnico que emerge do conjunto das runas tiradas; (2) verdade central que os Registros revelam para ${firstName} sobre "${perguntaReal}"; (3) caminho indicado pelas runas com clareza e confiança
ACAO_SAGRADA: 1 ação específica e concreta para ${firstName} nos próximos 7 dias — diretamente conectada com as runas tiradas e com "${perguntaReal}"

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "título poético nórdico-akáshico desta leitura específica",
  ${runasJson},
  "sintese": "...",
  "acao_sagrada": "..."
}`;

  try {
    const claude = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claude.ok) {
      const err = await claude.text();
      return res.status(claude.status).json({ error: err });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = claude.body.getReader();
    const dec = new TextDecoder();
    let buf = '', fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw || raw === '[DONE]') continue;
        try {
          const ev = JSON.parse(raw);
          if (ev.type === 'content_block_delta' && ev.delta?.text) {
            fullText += ev.delta.text;
            res.write(`data: ${JSON.stringify({ delta: ev.delta.text })}\n\n`);
          }
          if (ev.type === 'message_stop') {
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            if (email) {
              // Salva o JSON completo gerado pela IA
              let dadosCompletos = { tiragem, pergunta, runas_nomes: runas.map(r => r.nome) };
              try {
                const clean = fullText.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(clean);
                // Monta array de runas com interpretações
                const runasCompletas = runas.map((r, i) => ({
                  numero: r.id,
                  nome: r.nome,
                  posicao: r.posicao,
                  invertida: r.invertida || false,
                  interpretacao: parsed[`runa${i}`] || ''
                }));
                dadosCompletos = {
                  titulo: parsed.titulo || '',
                  tiragem,
                  pergunta,
                  runas: runasCompletas,
                  sintese: parsed.sintese || '',
                  acao_sagrada: parsed.acao_sagrada || ''
                };
              } catch(e) { console.error('parse runa json:', e.message); }
              sbSalvarRuna(email, dadosCompletos).catch(() => {});
            }
          }
        } catch {}
      }
    }
    res.end();
  } catch(e) {
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
}
