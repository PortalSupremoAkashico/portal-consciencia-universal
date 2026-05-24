export const config = { maxDuration: 300 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation', ...(options.headers||{}) }
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, data };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // ── GET — listar meditações, sonhos ou tarô ──
  if (req.method === 'GET') {
    const { tipo, email } = req.query || {};
    if (!tipo || !email) return res.status(400).json({ error: 'tipo e email obrigatórios.' });
    const tabela = tipo === 'meditacoes' ? 'meditacoes' : tipo === 'taro' ? 'leituras_taro' : 'sonhos';
    const chave  = tipo === 'meditacoes' ? 'meditacoes' : tipo === 'taro' ? 'taro' : 'sonhos';
    // email=all: retorna todos (para o painel admin)
    const filtro = email === 'all'
      ? `/${tabela}?order=created_at.desc&select=*&limit=500`
      : `/${tabela}?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`;
    const r = await sbFetch(filtro);
    if (!r.ok) return res.status(500).json({ error: 'Erro ao buscar.' });
    return res.status(200).json({ success: true, [chave]: r.data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // ── POST action=salvar|apagar_um — CRUD ──
  if (body.action === 'salvar' || body.action === 'apagar_um') {
    const { action, tipo, email, dados, id } = body;
    const tabela = tipo === 'meditacoes' ? 'meditacoes' : tipo === 'taro' ? 'leituras_taro' : 'sonhos';

    if (action === 'salvar') {
      if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const r = await sbFetch(`/${tabela}`, { method: 'POST', body: JSON.stringify({ email, dados }) });
      console.log('Supabase salvar:', tabela, r.ok, JSON.stringify(r.data).slice(0,200));
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao salvar.', detail: r.data });
    }

    if (action === 'apagar_um') {
      if (!id || !email) return res.status(400).json({ error: 'ID e email obrigatórios.' });
      const r = await sbFetch(`/${tabela}?id=eq.${id}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  // ── POST — geração de meditação, sonho ou tarô ──
  const { tipo, nome, sexo, tema, intencao, sonho, emocao, cartas, tiragem, pergunta } = body;
  if (!nome && tipo !== 'taro') return res.status(400).json({ error: 'Nome obrigatório.' });

  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];
  let prompt = '';

if (tipo === 'meditacao') {
    const semente = Math.floor(Math.random() * 10000);
    const lugares = ['floresta de cristal', 'templo akáshico nas nuvens', 'praia de areia dourada sob estrelas', 'caverna de luz', 'jardim celestial', 'lago espelhado no cosmos', 'montanha sagrada', 'vale de flores luminosas', 'portal entre dimensões', 'ilha flutuante no universo'];
    const guias = ['O Portal', 'O Portal', 'um ser de luz dourada', 'um ancião sábio', 'um anjo de cristal', 'a própria voz da alma'];
    const elementos = ['luz dourada', 'chamas azuis', 'água cristalina', 'vento sagrado', 'terra fértil', 'névoa prateada', 'raios de sol', 'energia violeta'];
    const lugar = lugares[Math.floor(Math.random() * lugares.length)];
    const guia = guias[Math.floor(Math.random() * guias.length)];
    const elemento = elementos[Math.floor(Math.random() * elementos.length)];

    prompt = `Você é um Guia Akáshico de meditação. Crie uma meditação guiada ÚNICA, IMERSIVA e PROFUNDAMENTE PERSONALIZADA para ${firstName}.

DADOS DA SESSÃO:
- Nome: ${firstName}
- Tema central: ${tema || 'Paz Interior'}
- Intenção pessoal: ${intencao || 'encontrar paz e clareza'}
- Cenário sagrado: ${lugar}
- Guia espiritual: ${guia}
- Elemento de cura: ${elemento}
- Variação: ${semente}

DIRETRIZES DE QUALIDADE:
- Fale DIRETAMENTE com ${firstName} em segunda pessoa: "você sente", "sua respiração", "deixe seu corpo"
- O tema "${tema || 'Paz Interior'}" e a intenção "${intencao || 'encontrar paz e clareza'}" devem ser o FIO CONDUTOR de cada seção
- Use detalhes sensoriais concretos: cheiro, textura, temperatura, som, cor — não apenas "imagine um lugar bonito"
- Alterne frases curtas (impacto) com frases longas (imersão)
- Use reticências (...) para criar pausas naturais que o consulente vai sentir
- Cada seção deve ter uma "textura emocional" diferente

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético de 5 a 7 palavras que capture a essência desta jornada",
  "duracao": "15 minutos",
  "preparacao": "3 parágrafos ricos: (1) acolha ${firstName} com calor e nomeie o tema ${tema || 'Paz Interior'} como algo que está prestes a se abrir; (2) guie a respiração com detalhes físicos — onde sentir no corpo, como o ar entra e sai; (3) convide o corpo a soltar tensão ponto por ponto, da cabeça aos pés, com sensações específicas",
  "descida": "3 parágrafos imersivos: conduza ${firstName} até ${lugar} com detalhes sensoriais completos — o que se vê, cheira, ouve, sente na pele. O ${elemento} aparece como presença viva e curadora. A intenção ${intencao || 'de paz'} começa a se manifestar como sensação no peito",
  "encontro": "4 parágrafos — o coração da meditação: (1) encontro com ${guia} descrito com emoção e presença física; (2) mensagem profunda e específica sobre ${tema || 'Paz Interior'} — não genérica, mas dirigida ao momento de vida de ${firstName}; (3) momento de silêncio onde algo é recebido; (4) transformação — algo se dissolve, algo se acende",
  "mensagem": "3 parágrafos: mensagem calorosa e específica dos Guardiões para ${firstName} sobre seu momento atual. Termine com uma frase que ${firstName} vai querer guardar e repetir",
  "retorno": "2 parágrafos: traga ${firstName} de volta suavemente. Encerre com uma afirmação de poder sobre ${tema || 'Paz Interior'} e uma frase que desperte o desejo de voltar a este espaço"
}`;
  } else if (tipo === 'sonho') {
    if (!sonho) return res.status(400).json({ error: 'Descreva o sonho.' });

    const semente = Math.floor(Math.random() * 99999);
    const abordagens = [
      'simbólica e arquetípica', 'akáshica e kármica', 'psicológica e transpessoal',
      'energética e espiritual', 'numerológica e mística', 'mitológica e ancestral',
      'alquímica e transformacional', 'xamânica e visionária',
    ];
    const perspectivas = [
      'revelando o que a alma tenta comunicar através de imagens',
      'decodificando os padrões kármicos ocultos nas cenas do sonho',
      'traduzindo a linguagem simbólica do inconsciente profundo',
      'lendo as mensagens dos Guardiões inscritas nas imagens oníricas',
      'interpretando os arquétipos universais presentes no sonho',
      'conectando o sonho com a missão e o momento de vida atual',
    ];
    const abordagem = abordagens[semente % abordagens.length];
    const perspectiva = perspectivas[Math.floor(semente / 7) % perspectivas.length];
    const palavrasChave = sonho.split(/\s+/).filter(w => w.length > 4).slice(0, 10).join(', ');

    prompt = `Voce e o Grande Interprete dos Registros Akashicos. Interprete o sonho de ${firstName} com profundidade e calor.

Nome: ${firstName}
Sexo: ${sexo || 'nao informado'}
Sonho: ${sonho}
Emocao ao acordar: ${emocao || 'nao informada'}
Abordagem: ${abordagem}
Codigo unico: ${semente}

REGRAS ABSOLUTAS:
- Cite elementos concretos do sonho em cada secao
- Use o nome ${firstName} pelo menos 4 vezes
- Seja especifico, profundo, envolvente e verdadeiro
- Nunca coloque aspas duplas dentro dos valores do JSON
- Separe paragrafos com a sequencia barra-n (dois caracteres: barra invertida seguida de n)
- Responda APENAS com JSON valido, sem markdown, sem texto fora do JSON

REGRAS DE QUALIDADE PARA TORNAR A INTERPRETACAO CRIVEL:
- Cite pelo menos 3 elementos ESPECIFICOS do sonho descrito em cada secao — nunca interprete de forma generica
- O consulente deve reconhecer o proprio sonho em cada paragrafo
- Use frases que so fazem sentido para ESTE sonho especifico, nao para qualquer outro
- A emocao ao acordar "${emocao || 'sentida'}" deve ser fio condutor de toda a leitura
- Fale diretamente com ${firstName} em segunda pessoa: "voce", "seu sonho", "o que voce sentiu"

Responda neste formato exato (substitua os textos entre parenteses):
{"titulo":"(titulo poetico de 5 a 7 palavras que capture a essencia DESTE sonho especifico)","revelacao":"(4 paragrafos generosos separados por \\n\\n — comece citando um elemento concreto do sonho; revele o padrao de alma por tras; conecte com o momento de vida atual de ${firstName}; mensagem dos Guardioes diretamente a ${firstName})","simbolos":"(4 paragrafos generosos separados por \\n\\n — interprete cada simbolo ESPECIFICO do sonho com seu significado universal E particular para ${firstName}; mostre como os simbolos se conectam formando uma mensagem coerente)","karma":"(3 paragrafos generosos separados por \\n\\n — qual padrao karmico este sonho especifico esta refletindo; conexao com vidas anteriores ou padroes familiares; qual licao a alma de ${firstName} esta trabalhando agora)","mensagem":"(3 paragrafos generosos separados por \\n\\n — mensagem acolhedora dos Guardioes reconhecendo o que ${firstName} esta vivendo; o que os Registros querem que ${firstName} saiba sobre este sonho; afirmacao poderosa que ${firstName} vai querer guardar)","acao":"(2 paragrafos generosos separados por \\n\\n — pratica espiritual concreta ligada aos simbolos DESTE sonho; convite caloroso para ${firstName} continuar trazendo seus sonhos pois cada um e uma mensagem sagrada)"}`;

  } else if (tipo === 'taro') {
    if (!cartas || !cartas.length) return res.status(400).json({ error: 'Cartas obrigatórias.' });

    const perguntaReal = pergunta || 'leitura livre';
    const cartasTexto = cartas.map((c, i) =>
      `${i+1}. [${c.posicao}] ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}`
    ).join('\n');

    prompt = `Você é um tarólogo akáshico. Interprete cada carta de forma RICA e DIRETA.

NAIPES: CHAMAS=Fogo/ação/criatividade, CALICES=Água/emoção/amor, CRISTAIS=Ar/mente/conflito, ESTRELAS=Terra/trabalho/dinheiro

CONSULENTE: ${firstName}
PERGUNTA: "${perguntaReal}"
TIRAGEM: ${tiragem || 'Leitura Livre'}

CARTAS:
${cartasTexto}

REGRAS DE RESPOSTA:
- Responda APENAS com JSON puro, sem markdown, sem quebras de linha dentro das strings
- Use o separador |||  entre paragrafos dentro de cada interpretacao
- Cada interpretacao deve ter 3 partes separadas por ||| :
  PARTE 1: O significado desta carta no tarot e seus simbolos
  PARTE 2: Como esta energia afeta ${firstName} nesta posicao em relacao a "${perguntaReal}"
  PARTE 3: Mensagem e conselho dos Registros Akashicos

{"titulo":"titulo poetico da leitura","cartas":[{"posicao":"nome da posicao","carta":"nome da carta","invertida":false,"interpretacao":"significado e simbolos da carta||| como afeta ${firstName} nesta posicao||| mensagem dos Registros"}],"sintese":"padrao geral das cartas||| verdade central para ${firstName}||| caminho indicado","acao_sagrada":"acao concreta para ${firstName}"}`;


  } else {
    return res.status(400).json({ error: 'Tipo inválido.' });
  }

  // Tarô: resposta direta (não streaming) para evitar parse de JSON fragmentado
  if (tipo === 'taro') {
    try {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2500, stream: true, messages: [{ role: 'user', content: prompt }] })
      });
      if (!anthropicRes.ok) {
        const err = await anthropicRes.text();
        return res.status(500).json({ error: 'Erro na API.', detail: err });
      }
      const data = await anthropicRes.json();
      const texto = data.content?.[0]?.text || '';
      return res.status(200).json({ texto });
    } catch (err) {
      console.error('taro error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  // Meditação e sonho: streaming
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: tipo === 'meditacao' ? 8000 : tipo === 'sonho' ? 10000 : 3000, stream: true, messages: [{ role: 'user', content: prompt }] })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', err);
      if (anthropicRes.status === 529) return res.status(503).json({ error: 'Os Guardiões estão em alta demanda. Tente novamente em instantes.' });
      return res.status(500).json({ error: 'Erro na API.', detail: err });
    }

    const reader = anthropicRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            res.write(`data: ${JSON.stringify({ delta: parsed.delta.text })}\n\n`);
          }
        } catch {}
      }
    }
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error('espiritualidade error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
}
