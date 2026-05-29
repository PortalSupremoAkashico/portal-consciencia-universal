export const config = { maxDuration: 120 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// 64 Hexagramas do I Ching
const HEXAGRAMAS = [
  { id:1,  nome:'Ch\'ien',    titulo:'O Criativo',             linhas:'111111', elemento:'Céu' },
  { id:2,  nome:'K\'un',      titulo:'O Receptivo',            linhas:'000000', elemento:'Terra' },
  { id:3,  nome:'Chun',       titulo:'A Dificuldade Inicial',  linhas:'100010', elemento:'Água/Trovão' },
  { id:4,  nome:'Meng',       titulo:'A Inexperiência Jovem',  linhas:'010001', elemento:'Montanha/Água' },
  { id:5,  nome:'Hsü',        titulo:'A Espera',               linhas:'111010', elemento:'Água/Céu' },
  { id:6,  nome:'Sung',       titulo:'O Conflito',             linhas:'010111', elemento:'Céu/Água' },
  { id:7,  nome:'Shih',       titulo:'O Exército',             linhas:'010000', elemento:'Terra/Água' },
  { id:8,  nome:'Pi',         titulo:'A União',                linhas:'000010', elemento:'Água/Terra' },
  { id:9,  nome:'Hsiao Ch\'u', titulo:'O Poder Domesticador do Pequeno', linhas:'111011', elemento:'Vento/Céu' },
  { id:10, nome:'Lü',         titulo:'A Pisada',               linhas:'110111', elemento:'Céu/Lago' },
  { id:11, nome:'T\'ai',      titulo:'A Paz',                  linhas:'000111', elemento:'Terra/Céu' },
  { id:12, nome:'P\'i',       titulo:'A Estagnação',           linhas:'111000', elemento:'Céu/Terra' },
  { id:13, nome:'T\'ung Jen', titulo:'A Comunidade com os Homens', linhas:'111101', elemento:'Céu/Fogo' },
  { id:14, nome:'Ta Yu',      titulo:'A Grande Possessão',     linhas:'101111', elemento:'Fogo/Céu' },
  { id:15, nome:'Ch\'ien',    titulo:'A Modéstia',             linhas:'000100', elemento:'Terra/Montanha' },
  { id:16, nome:'Yü',         titulo:'O Entusiasmo',           linhas:'001000', elemento:'Trovão/Terra' },
  { id:17, nome:'Sui',        titulo:'O Seguimento',           linhas:'011001', elemento:'Lago/Trovão' },
  { id:18, nome:'Ku',         titulo:'O Trabalho sobre o que foi Corrompido', linhas:'100110', elemento:'Montanha/Vento' },
  { id:19, nome:'Lin',        titulo:'A Aproximação',          linhas:'000011', elemento:'Terra/Lago' },
  { id:20, nome:'Kuan',       titulo:'A Contemplação',         linhas:'110000', elemento:'Vento/Terra' },
  { id:21, nome:'Shih Ho',    titulo:'Morder através',         linhas:'101001', elemento:'Fogo/Trovão' },
  { id:22, nome:'Pi',         titulo:'A Graça',                linhas:'100101', elemento:'Montanha/Fogo' },
  { id:23, nome:'Po',         titulo:'A Divisão',              linhas:'100000', elemento:'Montanha/Terra' },
  { id:24, nome:'Fu',         titulo:'O Retorno',              linhas:'000001', elemento:'Terra/Trovão' },
  { id:25, nome:'Wu Wang',    titulo:'A Inocência',            linhas:'111001', elemento:'Céu/Trovão' },
  { id:26, nome:'Ta Ch\'u',   titulo:'O Poder Domesticador do Grande', linhas:'100111', elemento:'Montanha/Céu' },
  { id:27, nome:'I',          titulo:'As Comissuras da Boca',  linhas:'100001', elemento:'Montanha/Trovão' },
  { id:28, nome:'Ta Kuo',     titulo:'A Preponderância do Grande', linhas:'011110', elemento:'Lago/Vento' },
  { id:29, nome:'K\'an',      titulo:'O Abismal',              linhas:'010010', elemento:'Água/Água' },
  { id:30, nome:'Li',         titulo:'O Aderente',             linhas:'101101', elemento:'Fogo/Fogo' },
  { id:31, nome:'Hsien',      titulo:'A Influência',           linhas:'011100', elemento:'Lago/Montanha' },
  { id:32, nome:'Hêng',       titulo:'A Duração',              linhas:'001110', elemento:'Trovão/Vento' },
  { id:33, nome:'Tun',        titulo:'A Retirada',             linhas:'111100', elemento:'Céu/Montanha' },
  { id:34, nome:'Ta Chuang',  titulo:'O Poder do Grande',      linhas:'001111', elemento:'Trovão/Céu' },
  { id:35, nome:'Chin',       titulo:'O Progresso',            linhas:'101000', elemento:'Fogo/Terra' },
  { id:36, nome:'Ming I',     titulo:'O Escurecimento da Luz', linhas:'000101', elemento:'Terra/Fogo' },
  { id:37, nome:'Chia Jen',   titulo:'A Família',              linhas:'110101', elemento:'Vento/Fogo' },
  { id:38, nome:'K\'uei',     titulo:'A Oposição',             linhas:'101011', elemento:'Fogo/Lago' },
  { id:39, nome:'Chien',      titulo:'O Obstáculo',            linhas:'010100', elemento:'Água/Montanha' },
  { id:40, nome:'Hsieh',      titulo:'A Libertação',           linhas:'001010', elemento:'Trovão/Água' },
  { id:41, nome:'Sun',        titulo:'A Diminuição',           linhas:'100011', elemento:'Montanha/Lago' },
  { id:42, nome:'I',          titulo:'O Aumento',              linhas:'110001', elemento:'Vento/Trovão' },
  { id:43, nome:'Kuai',       titulo:'A Resolução',            linhas:'011111', elemento:'Lago/Céu' },
  { id:44, nome:'Kou',        titulo:'O Encontro',             linhas:'111110', elemento:'Céu/Vento' },
  { id:45, nome:'Ts\'ui',     titulo:'A Reunião',              linhas:'011000', elemento:'Lago/Terra' },
  { id:46, nome:'Shêng',      titulo:'O Impulso para Cima',    linhas:'000110', elemento:'Terra/Vento' },
  { id:47, nome:'K\'un',      titulo:'O Esgotamento',          linhas:'011010', elemento:'Lago/Água' },
  { id:48, nome:'Ching',      titulo:'O Poço',                 linhas:'010110', elemento:'Água/Vento' },
  { id:49, nome:'Ko',         titulo:'A Revolução',            linhas:'011101', elemento:'Lago/Fogo' },
  { id:50, nome:'Ting',       titulo:'O Caldeirão',            linhas:'101110', elemento:'Fogo/Vento' },
  { id:51, nome:'Chên',       titulo:'O Despertar',            linhas:'001001', elemento:'Trovão/Trovão' },
  { id:52, nome:'Kên',        titulo:'O Aquietamento',         linhas:'100100', elemento:'Montanha/Montanha' },
  { id:53, nome:'Chien',      titulo:'O Desenvolvimento',      linhas:'110100', elemento:'Vento/Montanha' },
  { id:54, nome:'Kuei Mei',   titulo:'A Donzela que se Casa',  linhas:'001011', elemento:'Trovão/Lago' },
  { id:55, nome:'Fêng',       titulo:'A Abundância',           linhas:'001101', elemento:'Trovão/Fogo' },
  { id:56, nome:'Lü',         titulo:'O Viajante',             linhas:'101100', elemento:'Fogo/Montanha' },
  { id:57, nome:'Sun',        titulo:'O Suave',                linhas:'110110', elemento:'Vento/Vento' },
  { id:58, nome:'Tui',        titulo:'O Alegre',               linhas:'011011', elemento:'Lago/Lago' },
  { id:59, nome:'Huan',       titulo:'A Dispersão',            linhas:'110010', elemento:'Vento/Água' },
  { id:60, nome:'Chieh',      titulo:'A Limitação',            linhas:'010011', elemento:'Água/Lago' },
  { id:61, nome:'Chung Fu',   titulo:'A Verdade Interior',     linhas:'110011', elemento:'Vento/Lago' },
  { id:62, nome:'Hsiao Kuo',  titulo:'A Preponderância do Pequeno', linhas:'001100', elemento:'Trovão/Montanha' },
  { id:63, nome:'Chi Chi',    titulo:'Após a Conclusão',       linhas:'010101', elemento:'Água/Fogo' },
  { id:64, nome:'Wei Chi',    titulo:'Antes da Conclusão',     linhas:'101010', elemento:'Fogo/Água' },
];

// Mapa de linhas para hexagrama
const LINHA_MAP = {};
HEXAGRAMAS.forEach(h => { LINHA_MAP[h.linhas] = h; });

function lancarMoedas() {
  // 3 moedas: cara=3, coroa=2 → soma 6,7,8,9
  // 6=yin mutante, 7=yang fixo, 8=yin fixo, 9=yang mutante
  const moedas = [0,1,2].map(() => Math.random() < 0.5 ? 3 : 2);
  const soma = moedas.reduce((a, b) => a + b, 0);
  return soma; // 6,7,8,9
}

function sorteiarHexagrama() {
  const linhas = [];
  const mutantes = [];
  for (let i = 0; i < 6; i++) {
    const v = lancarMoedas();
    if (v === 6) { linhas.push(0); mutantes.push(i); }      // yin mutante → vira yang
    else if (v === 7) { linhas.push(1); }                    // yang fixo
    else if (v === 8) { linhas.push(0); }                    // yin fixo
    else { linhas.push(1); mutantes.push(i); }               // yang mutante → vira yin
  }
  const chave = linhas.join('');
  const hexPrincipal = LINHA_MAP[chave] || HEXAGRAMAS[Math.floor(Math.random()*64)];

  // Hexagrama de mutação
  const linhasMutadas = [...linhas];
  mutantes.forEach(i => { linhasMutadas[i] = linhasMutadas[i] === 1 ? 0 : 1; });
  const chaveMutada = linhasMutadas.join('');
  const hexMutacao = mutantes.length > 0 ? (LINHA_MAP[chaveMutada] || HEXAGRAMAS[Math.floor(Math.random()*64)]) : null;

  return { hexPrincipal, hexMutacao, linhas, mutantes };
}

async function sbSalvar(email, dados) {
  if (!SUPABASE_KEY) return;
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/leituras_iching`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ email, dados: JSON.stringify(dados) })
    });
    if (!r.ok) console.error('iching save:', r.status, await r.text());
  } catch(e) { console.error('sbSalvar iching:', e.message); }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET: buscar histórico ──
  if (req.method === 'GET') {
    const email = req.query?.email;
    if (!email) return res.status(400).json({ error: 'email obrigatório' });
    try {
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/leituras_iching?email=eq.${encodeURIComponent(email)}&order=created_at.desc`,
        { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      const rows = await r.json();
      return res.json({ success: true, leituras: rows || [] });
    } catch(e) { return res.status(500).json({ success: false, error: e.message }); }
  }

  if (req.method !== 'POST') return res.status(405).end();

  const body = req.body || {};

  // ── POST: apagar leitura ──
  if (body.action === 'apagar_um') {
    const { id, email } = body;
    if (!id || !email) return res.status(400).json({ error: 'id e email obrigatórios' });
    try {
      await fetch(
        `${SUPABASE_URL}/rest/v1/leituras_iching?id=eq.${id}&email=eq.${encodeURIComponent(email)}`,
        { method: 'DELETE', headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
      );
      return res.json({ success: true });
    } catch(e) { return res.status(500).json({ success: false, error: e.message }); }
  }

  // ── POST: nova leitura (streaming) ──
  const { nome, pergunta, email } = body;
  if (!pergunta) return res.status(400).json({ error: 'Pergunta obrigatória.' });

  const { hexPrincipal, hexMutacao, linhas, mutantes } = sorteiarHexagrama();
  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];

  const linhasTexto = linhas.map((l, i) => {
    const pos = i + 1;
    const tipo = mutantes.includes(i) ? (l === 1 ? 'Nove' : 'Seis') : (l === 1 ? 'Yang fixo' : 'Yin fixo');
    const mutStr = mutantes.includes(i) ? ' ← LINHA MUTANTE' : '';
    return `Linha ${pos} (de baixo): ${tipo}${mutStr}`;
  }).join('\n');

  const linhasMutantesTexto = mutantes.length > 0
    ? `Linhas mutantes: ${mutantes.map(i => `linha ${i+1}`).join(', ')} — estas linhas têm textos específicos no Livro e determinam o hexagrama resultante`
    : 'Nenhuma linha mutante — hexagrama estável, lê-se apenas o Julgamento e a Imagem';

  const mutacaoTexto = hexMutacao
    ? `HEXAGRAMA RESULTANTE (após mutação): #${hexMutacao.id} ${hexMutacao.nome} — "${hexMutacao.titulo}" (${hexMutacao.elemento})`
    : '';

  const prompt = `Você é um mestre intérprete do I Ching com conhecimento profundo das traduções de Richard Wilhelm/Cary Baynes, Thomas Cleary, e do Texto de Mao. Sua missão é uma leitura fiel à tradição clássica chinesa — sem esotericismo genérico, sem mistura com outras tradições. Apenas o Livro das Mutações em sua profundidade original.

CONSULENTE: ${firstName}
PERGUNTA: "${pergunta}"

HEXAGRAMA OBTIDO: #${hexPrincipal.id} ${hexPrincipal.nome} (${hexPrincipal.titulo})
Trigramas: ${hexPrincipal.elemento}
Configuração das linhas (da base ao topo):
${linhasTexto}
${linhasMutantesTexto}
${mutacaoTexto}

METODOLOGIA DE LEITURA FIEL AO I CHING CLÁSSICO:

**HEXAGRAMA PRESENTE** — Desenvolva em 4 parágrafos:
§1 — O JULGAMENTO (Tuan): Exponha o texto do Julgamento deste hexagrama segundo a tradição (Wilhelm/Baynes ou equivalente), com sua interpretação clássica. Explique o que o Julgamento diz literalmente e seu significado profundo no contexto da filosofia taoísta e da mutação.
§2 — A IMAGEM (Hsiang): Apresente a Imagem tradicional — os dois trigramas que formam o hexagrama, o fenômeno natural que representam, e o que o superior homem (chün-tzu) aprende com esta imagem. Esta é a sabedoria prática clássica do hexagrama.
§3 — CONTEXTO DA SITUAÇÃO: Como os trigramas "${hexPrincipal.elemento}" interagem entre si e o que esta interação específica revela sobre o momento de ${firstName} em relação a "${pergunta}". Use os atributos clássicos dos trigramas.
§4 — CONSELHO CLÁSSICO: O que o Livro aconselha diretamente para esta situação — baseado no caráter do hexagrama, sua posição no ciclo das 64 situações, e sua relação com os princípios do Tao.

**LINHAS MUTANTES** — ${mutantes.length > 0
    ? `Para cada linha mutante (${mutantes.map(i=>`linha ${i+1}`).join(', ')}), escreva em parágrafo separado: o texto clássico da linha segundo Wilhelm (a sentença oracular original), sua interpretação dentro do contexto do hexagrama, e o que especificamente muda na situação de ${firstName}. As linhas de Yang mutante (Nove) e Yin mutante (Seis) têm textos distintos — cite-os e os interprete.`
    : 'Sem linhas mutantes. Escreva sobre a estabilidade desta situação: quando não há mutação, o I Ching indica que a situação é completa em si — o que significa permanecer fiel ao caráter do hexagrama sem forçar mudanças. Desenvolva em 1 parágrafo.'
}

**HEXAGRAMA FUTURO** — ${hexMutacao
    ? `Desenvolva em 3 parágrafos: §1 — O caráter do hexagrama resultante #${hexMutacao.id} ${hexMutacao.nome} ("${hexMutacao.titulo}") segundo a tradição — seu Julgamento e Imagem clássicos. §2 — A relação dinâmica entre o hexagrama presente e o resultante: que transformação específica está em curso, o que se dissolve e o que emerge. §3 — Como ${firstName} deve se posicionar diante desta transformação, segundo o espírito do I Ching.`
    : 'Como não há mutação, não há hexagrama resultante. Desenvolva 2 parágrafos sobre como a situação presente se completa e resolve dentro de si mesma, segundo a tradição do hexagrama #' + hexPrincipal.id + '.'
}

**MENSAGEM CENTRAL** — 2 parágrafos concisos:
§1 — A verdade essencial que o I Ching revela para ${firstName} sobre "${pergunta}" — destilada em linguagem direta, sem floreios, fiel ao espírito oracular do Livro.
§2 — A orientação concreta: o que fazer, o que evitar, e qual atitude interior cultivar agora — nos termos do hexagrama e da filosofia clássica (wu wei, equilíbrio yin-yang, o momento propício).

IMPORTANTE:
- Cite frases e conceitos reais do I Ching (ex: "Perseverança traz boa fortuna", "O superior homem...", "Avançar traz humilhação", etc.)
- Use terminologia clássica: Tao, yang, yin, ch'i, chün-tzu (homem superior), li (princípio), trigramas Ch'ien/K'un/Chen/K'an/Ken/Sun/Li/Tui
- Não misture com Tarô, Kabbalá, Registros Akáshicos ou outras tradições
- Tom: sábio, direto, oracular — como o próprio Livro fala
- Fale com ${firstName} em segunda pessoa

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "título que evoca o hexagrama e a situação de ${firstName} — pode usar o nome chinês e a tradução",
  "hexagrama_presente": "4 parágrafos: Julgamento, Imagem, contexto dos trigramas, conselho clássico",
  "linhas_mutantes": "texto das linhas mutantes com citações clássicas, ou sobre a estabilidade sem mutação",
  "hexagrama_futuro": "hexagrama resultante e transformação, ou resolução interna se sem mutação",
  "mensagem_central": "2 parágrafos: verdade essencial e orientação prática fiel ao I Ching"
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!claude.ok) {
      const err = await claude.text();
      return res.status(claude.status).json({ error: err });
    }

    // Envia dados do hexagrama imediatamente antes do stream
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Primeiro evento: dados dos hexagramas
    res.write(`data: ${JSON.stringify({
      hexagrama: {
        principal: { id: hexPrincipal.id, nome: hexPrincipal.nome, titulo: hexPrincipal.titulo, elemento: hexPrincipal.elemento, linhas: hexPrincipal.linhas },
        mutacao: hexMutacao ? { id: hexMutacao.id, nome: hexMutacao.nome, titulo: hexMutacao.titulo, elemento: hexMutacao.elemento, linhas: hexMutacao.linhas } : null,
        linhas,
        mutantes
      }
    })}\n\n`);

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
              let dadosSalvar = { pergunta, hexPrincipal: hexPrincipal.id, hexMutacao: hexMutacao?.id || null, linhas, mutantes };
              try {
                const clean = fullText.replace(/```json|```/g, '').trim();
                const parsed = JSON.parse(clean);
                dadosSalvar = {
                  titulo: parsed.titulo || '',
                  pergunta,
                  hexagrama_principal: { id: hexPrincipal.id, nome: hexPrincipal.nome, titulo: hexPrincipal.titulo, elemento: hexPrincipal.elemento, linhas: hexPrincipal.linhas },
                  hexagrama_mutacao: hexMutacao ? { id: hexMutacao.id, nome: hexMutacao.nome, titulo: hexMutacao.titulo, elemento: hexMutacao.elemento, linhas: hexMutacao.linhas } : null,
                  linhas_tiradas: linhas,
                  mutantes,
                  hexagrama_presente: parsed.hexagrama_presente || '',
                  linhas_mutantes: parsed.linhas_mutantes || '',
                  hexagrama_futuro: parsed.hexagrama_futuro || '',
                  mensagem_central: parsed.mensagem_central || ''
                };
              } catch(e) { console.error('parse iching json:', e.message); }
              sbSalvar(email, dadosSalvar).catch(() => {});
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
