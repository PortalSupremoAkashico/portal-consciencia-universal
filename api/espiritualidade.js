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
    const semente = Math.floor(Math.random() * 99999);
    const hora = new Date().getHours();
    const periodos = hora < 12 ? 'manhã' : hora < 18 ? 'tarde' : 'noite';

    const lugares = [
      'uma floresta de cristais que cantam ao vento',
      'um templo akáshico suspenso entre estrelas',
      'uma praia de areia dourada sob uma lua cheia enorme',
      'uma caverna onde a rocha emite luz própria, suave e violeta',
      'um jardim celestial onde cada flor pulsa com luz viva',
      'um lago perfeito que espelha toda a Via Láctea',
      'o cume de uma montanha sagrada acima das nuvens',
      'um vale onde flores luminosas crescem ao ritmo da respiração',
      'uma ponte de luz entre dois mundos, sobre um oceano de estrelas',
      'uma ilha que flutua no cosmos, rodeada de aurora boreal',
      'um santuário submerso de luz âmbar no coração da terra',
      'uma clareira secreta onde o tempo para e a natureza respira junto',
    ];
    const guias = [
      'um ser de luz dourada de olhos de safira',
      'uma anciã sábia de voz suave como água corrente',
      'um anjo de asas cristalinas e presença acolhedora',
      'um guardião silencioso que fala através de sensações no coração',
      'uma figura luminosa sem rosto mas com calor de sol',
      'o próprio campo dos Registros Akáshicos em forma de voz',
      'uma criança de luz que carrega a sabedoria de todas as vidas',
    ];
    const elementos = [
      'luz dourada que aquece cada célula por dentro',
      'chamas azuis que purificam sem queimar',
      'água cristalina que carrega memórias de cura',
      'vento sagrado perfumado de flores impossíveis',
      'névoa prateada que dissolve o que não serve mais',
      'energia violeta que vibra na frequência do amor incondicional',
      'raios de sol branco que atravessam gentilmente o corpo',
      'chuva fina de luz verde que regenera e renova',
    ];
    const respiracoes = [
      'Inspire contando 4 tempos... segure por 4... expire em 6',
      'Três respirações fundo, cada expiração mais longa que a anterior',
      'Inspire pelo nariz como se fosse cheirar uma flor rara... expire pela boca como um suspiro de alívio',
      'Deixe a respiração encontrar seu próprio ritmo suave, como ondas chegando à margem',
    ];

    const lugar = lugares[semente % lugares.length];
    const guia  = guias[Math.floor(semente / 3) % guias.length];
    const elemento = elementos[Math.floor(semente / 7) % elementos.length];
    const respiracao = respiracoes[Math.floor(semente / 11) % respiracoes.length];
    const temaSelecionado = tema || 'Paz Interior';
    const intencaoReal = intencao && intencao.length > 3 ? intencao : 'encontrar paz e clareza';

    prompt = `Você é o Guia Supremo dos Registros Akáshicos, especialista em meditações guiadas transformadoras.

Crie uma meditação guiada COMPLETAMENTE ORIGINAL e PROFUNDAMENTE PERSONALIZADA para ${firstName}.

PERFIL DA SESSÃO:
- Nome: ${firstName}
- Tema escolhido: ${temaSelecionado}
- Intenção pessoal: "${intencaoReal}"
- Período do dia: ${periodos}
- Cenário sagrado: ${lugar}
- Guia espiritual: ${guia}
- Elemento de cura: ${elemento}
- Técnica de respiração: ${respiracao}
- Código de unicidade: ${semente}

DIRETRIZES OBRIGATÓRIAS:

PERSONALIZAÇÃO PROFUNDA:
— Use o nome ${firstName} naturalmente ao longo do texto (mínimo 4 vezes)
— O tema "${temaSelecionado}" deve ser o FIO CONDUTOR de toda a meditação, não apenas mencionado
— A intenção "${intencaoReal}" deve ser integrada na mensagem central e na jornada
— Cada elemento do cenário deve ter detalhes sensoriais únicos: cheiro, textura, temperatura, som, cor

LINGUAGEM E TOM:
— Voz calorosa e íntima, como um abraço em palavras
— Frases alternando curtas (impacto) com longas (imersão), criando ondas de relaxamento
— Use reticências (...) para pausas intencionais que o consulente vai sentir naturalmente
— Fale DIRETAMENTE com ${firstName}, nunca em terceira pessoa
— Evite clichês espirituais; cada frase deve soar nova e verdadeira
— Verbos suaves no presente: "sinta", "perceba", "deixe", "observe", "respire"

ESTRUTURA NARRATIVA:
— A meditação deve ter uma HISTÓRIA com começo, desenvolvimento e clímax emocional
— O ápice acontece no "encontro": o momento mais poderoso e transformador
— Termine deixando ${firstName} com a sensação de que algo real mudou em seu interior

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético de 4 a 7 palavras que capture a essência desta jornada única",
  "duracao": "15 minutos",
  "preparacao": "3 parágrafos ricos: primeiro, acolha ${firstName} com calor e nomeie o tema ${temaSelecionado} como um presente prestes a ser aberto; segundo, guie a técnica de respiração ${respiracao} de forma detalhada e sensorial; terceiro, convide o corpo a soltar cada ponto de tensão do topo da cabeça até os pés com detalhes físicos de sensação",
  "descida": "3 parágrafos imersivos: conduza ${firstName} até ${lugar} passo a passo com detalhes sensoriais completos — o que se vê, cheira, ouve, sente na pele. O ${elemento} aparece como presença viva. A intenção ${intencaoReal} começa a se manifestar como uma sensação no peito",
  "encontro": "4 parágrafos — o coração da meditação: primeiro, o encontro com ${guia} descrito com emoção e presença; segundo, a mensagem revelada especificamente sobre ${temaSelecionado} e ${intencaoReal} — profunda e original; terceiro, um momento de silêncio interior poderoso onde ${firstName} recebe algo intangível mas real; quarto, a transformação acontece — algo que ${firstName} carregava se dissolve, algo que precisava se acende",
  "mensagem": "3 parágrafos: mensagem direta e pessoal dos Guardiões para ${firstName} sobre seu momento de vida, conectando ${temaSelecionado} com ${intencaoReal}. Tranquilizante e inspirador. Termine com uma frase que ${firstName} vai querer guardar",
  "retorno": "2 parágrafos: traga ${firstName} de volta suavemente ancorando no corpo com gratidão. Encerre com uma afirmação poderosa sobre ${temaSelecionado} para carregar pelo resto do dia — e com uma frase sutil que desperte a vontade de retornar a este espaço sagrado"
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

    prompt = `Você é o Grande Intérprete dos Registros Akáshicos — um mestre em revelar os mistérios ocultos nos sonhos.

Sua missão: criar uma interpretação ÚNICA, PROFUNDA e INESQUECÍVEL do sonho de ${firstName}.

DADOS DO SONHO:
- Nome: ${firstName}
- Sexo: ${sexo || 'não informado'}
- Sonho descrito: "${sonho}"
- Emoção ao acordar: ${emocao || 'não informada'}
- Elementos-chave: ${palavrasChave}
- Abordagem desta leitura: ${abordagem}
- Perspectiva: ${perspectiva}
- Código único: ${semente}

REGRAS INVIOLÁVEIS:

1. UNICIDADE: Esta leitura deve ser completamente diferente de qualquer outra. Use o código ${semente} como semente criativa. Se o sonho descrito for diferente de sonhos anteriores, a interpretação deve refletir essa diferença com precisão.

2. ESPECIFICIDADE TOTAL: Cite elementos CONCRETOS do sonho em cada seção. Nunca generalize. Se o sonho menciona "uma porta vermelha", interprete "a porta vermelha" — não "uma porta". O consulente deve reconhecer o próprio sonho em cada parágrafo.

3. PROFUNDIDADE REAL: Vá além do óbvio. Conecte o sonho com padrões de vida, missão da alma, medos profundos, desejos não realizados, mensagens de vidas passadas. Surpreenda ${firstName} com insights que ele/ela ainda não havia percebido.

4. TOM ENVOLVENTE: Escreva como um sábio que fala ao coração — caloroso, direto, poético mas claro. Alterne frases curtas de impacto com frases longas de imersão. Use o nome ${firstName} pelo menos 5 vezes.

5. VONTADE DE VOLTAR: A última seção deve deixar ${firstName} com a sensação de que há sempre mais para descobrir — que cada sonho é uma mensagem sagrada que merece ser trazida e interpretada.

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético de 5 a 8 palavras que capture a essência única DESTE sonho específico",
  "revelacao": "3 parágrafos revelando a mensagem central — comece com um elemento ESPECÍFICO do sonho de ${firstName}, explique o que representa no plano akáshico usando a abordagem ${abordagem}, conecte com o momento de vida atual, aprofunde no significado da emoção '${emocao || 'ao acordar'}', revele a mensagem principal que a alma de ${firstName} está enviando através deste sonho",
  "simbolos": "3 parágrafos interpretando cada símbolo presente no sonho — cite textualmente os elementos mencionados, explique o arquétipo universal de cada um, como essa simbologia afeta ${firstName} especificamente, o que cada símbolo está tentando revelar, e como todos se conectam para formar uma mensagem coerente e significativa",
  "karma": "2 parágrafos sobre padrões kármicos e lições da alma — qual padrão de vida este sonho está espelhando, conexão com experiências de vidas anteriores ou padrões familiares herdados, qual lição a alma de ${firstName} está trabalhando neste momento, e qual transformação os Registros estão pedindo",
  "mensagem": "2 parágrafos de mensagem direta dos Guardiões para ${firstName} — primeiro parágrafo acolhedor que reconhece o que ${firstName} está vivendo agora; segundo parágrafo revelando o que os Guardiões querem que ${firstName} saiba especificamente sobre este sonho e este momento; terceiro parágrafo com uma frase de poder que ${firstName} vai querer guardar e repetir",
  "acao": "2 parágrafos com orientações concretas — uma prática espiritual específica relacionada aos símbolos deste sonho; uma mudança de perspectiva ou atitude que os Registros recomendam para ${firstName}; um convite caloroso para continuar esse diálogo sagrado com a própria alma, trazendo outros sonhos para serem revelados"
}`;

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
        body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 2500, stream: false, messages: [{ role: 'user', content: prompt }] })
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
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: tipo === 'meditacao' ? 4500 : tipo === 'sonho' ? 2500 : 3000, stream: true, messages: [{ role: 'user', content: prompt }] })
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
