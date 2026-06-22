export const config = { maxDuration: 300 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function emailEhLiberado(email) {
  if (!email) return false;
  const url = `${SUPABASE_URL}/rest/v1/emails_liberados?email=eq.${encodeURIComponent(String(email).toLowerCase().trim())}&select=email`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function temAssinaturaPortal(email) {
  const url = `${SUPABASE_URL}/rest/v1/assinaturas?email=eq.${encodeURIComponent(email)}&servico=eq.portal_mensal&status=eq.authorized&select=id`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const rows = await resp.json().catch(() => []);
  return Array.isArray(rows) && rows.length > 0;
}

async function obterSaldoCreditos(email) {
  const url = `${SUPABASE_URL}/rest/v1/creditos_movimentos?email=eq.${encodeURIComponent(email)}&select=quantidade`;
  const resp = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
  const linhas = await resp.json().catch(() => []);
  if (!Array.isArray(linhas)) return 0;
  return linhas.reduce((soma, l) => soma + (Number(l.quantidade) || 0), 0);
}

async function debitarCredito(email, motivo) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/creditos_movimentos`, {
    method: 'POST',
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify({ email, quantidade: -1, motivo, referencia: `${motivo}_${Date.now()}` })
  });
  if (!resp.ok) {
    const errTxt = await resp.text().catch(() => '');
    console.error('debitarCredito falhou:', resp.status, errTxt.slice(0,300));
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { nome, sexo, tema, intencao, email } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Dados obrigatórios.' });

  const emailLiberado = !!email && await emailEhLiberado(email);
  const assinante = !emailLiberado && !!email && await temAssinaturaPortal(email);
  if (!emailLiberado && !assinante) {
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
    const saldo = await obterSaldoCreditos(email);
    if (saldo < 1) {
      return res.status(402).json({ error: 'Você não tem créditos disponíveis. Adquira em /planos para continuar.' });
    }
  }

  const firstName = nome.trim().split(/\s+/)[0];

  // Busca dados pessoais do consulente para personalização profunda
  let perfil = {};
  let totalMeditacoes = 0;
  try {
    const [pResp, mResp] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/consulentes?email=eq.${encodeURIComponent(email)}&select=data_nascimento,sexo,cidade,estado,pais`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      }),
      fetch(`${SUPABASE_URL}/rest/v1/creditos_movimentos?email=eq.${encodeURIComponent(email)}&motivo=eq.uso_meditacao&select=id`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
      })
    ]);
    const pd = await pResp.json().catch(() => []);
    const md = await mResp.json().catch(() => []);
    if (Array.isArray(pd) && pd[0]) perfil = pd[0];
    if (Array.isArray(md)) totalMeditacoes = md.length;
  } catch(e) {}

  // Calcula signo solar a partir da data de nascimento — suporta YYYY-MM-DD e DD/MM/YYYY
  function calcularSigno(dataNasc) {
    if (!dataNasc) return null;
    let dia, mes;
    if (/^\d{4}-\d{2}-\d{2}/.test(dataNasc)) {
      // formato ISO: YYYY-MM-DD
      const partes = dataNasc.split('-');
      mes = parseInt(partes[1], 10);
      dia = parseInt(partes[2], 10);
    } else if (/^\d{2}\/\d{2}\/\d{4}/.test(dataNasc)) {
      // formato brasileiro: DD/MM/YYYY
      const partes = dataNasc.split('/');
      dia = parseInt(partes[0], 10);
      mes = parseInt(partes[1], 10);
    } else {
      return null;
    }
    if (!dia || !mes) return null;
    const m = mes, d = dia;
    if ((m===3&&d>=21)||(m===4&&d<=19)) return 'Áries';
    if ((m===4&&d>=20)||(m===5&&d<=20)) return 'Touro';
    if ((m===5&&d>=21)||(m===6&&d<=20)) return 'Gêmeos';
    if ((m===6&&d>=21)||(m===7&&d<=22)) return 'Câncer';
    if ((m===7&&d>=23)||(m===8&&d<=22)) return 'Leão';
    if ((m===8&&d>=23)||(m===9&&d<=22)) return 'Virgem';
    if ((m===9&&d>=23)||(m===10&&d<=22)) return 'Libra';
    if ((m===10&&d>=23)||(m===11&&d<=21)) return 'Escorpião';
    if ((m===11&&d>=22)||(m===12&&d<=21)) return 'Sagitário';
    if ((m===12&&d>=22)||(m===1&&d<=19)) return 'Capricórnio';
    if ((m===1&&d>=20)||(m===2&&d<=18)) return 'Aquário';
    return 'Peixes';
  }

  const signo = calcularSigno(perfil.data_nascimento);
  const cidade = perfil.cidade || null;
  const sessaoNum = totalMeditacoes + 1;

  // Busca títulos e cenários das últimas 3 meditações para evitar repetição
  let ultimasMeditacoes = [];
  try {
    const ultResp = await fetch(
      `${SUPABASE_URL}/rest/v1/meditacoes?email=eq.${encodeURIComponent(email)}&order=created_at.desc&limit=3&select=dados`,
      { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
    );
    const ultData = await ultResp.json().catch(() => []);
    if (Array.isArray(ultData)) {
      ultData.forEach(function(m) {
        try {
          const d = JSON.parse(m.dados || '{}');
          if (d.titulo) ultimasMeditacoes.push(d.titulo);
        } catch(e) {}
      });
    }
  } catch(e) {}

  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const cenarios = [
    'uma floresta de cristais luminosos onde cada pedra ressoa com a sua alma',
    'um templo akáshico suspenso entre nuvens douradas',
    'uma caverna de luz violeta com fontes de água prateada',
    'um jardim celestial onde flores de luz brotam ao seu toque',
    'uma praia de areia dourada sob um céu estrelado e silencioso',
    'um lago espelhado no centro do cosmos refletindo sua essência',
    'uma montanha sagrada onde o vento carrega sussurros dos ancestrais',
    'um vale de névoa prateada onde o tempo se dissolve',
    'um portal de luz entre dimensões onde passado e futuro se encontram',
    'uma ilha flutuante no universo coberta de musgo luminoso e flores etéreas',
    'um observatório cósmico onde cada estrela conta a história da sua alma',
    'uma catedral de bambu dourado onde a brisa toca como música sagrada',
    'um deserto de areia de quartzo rosa sob a Via Láctea',
    'uma gruta submarina de corais de luz pulsando em harmonia com sua respiração',
    'um campo infinito de flores de luz onde cada flor é uma memória curada',
    'uma torre de luz no centro da Terra conectando solo e cosmos',
    'um rio de energia dourada que atravessa planícies de paz eterna',
    'uma floresta de bambu prateado onde o silêncio tem textura e aroma',
    'um santuário de pedras antigas onde cada rocha guarda uma sabedoria',
    'um céu de aurora boreal onde as cores dançam ao ritmo da sua alma'
  ];

  const guias = [
    'um ser de luz dourada sem forma definida, pura presença e amor',
    'um ancião sábio de olhos como galáxias e voz como rio profundo',
    'um anjo de cristal cujas asas refletem todas as cores da criação',
    'a própria voz da sua alma, finalmente audível e clara',
    'um guardião animal de luz — totem da sua jornada atual',
    'uma presença feminina de energia suave como a lua cheia',
    'um mestre de luz sem nome, apenas sensação de reconhecimento profundo',
    'os Guardiões Akáshicos em forma de constelação viva',
    'uma criança de luz que representa sua essência mais pura e original',
    'um ser andrógino de energia equilibrada entre terra e céu',
    'um xamã de luz que conhece os caminhos invisíveis da alma',
    'uma voz suave que vem de dentro — sua própria sabedoria superior',
    'um ser feito de som e vibração, sem corpo, apenas frequência pura'
  ];

  const elementos = [
    'chamas azuis que curam sem queimar',
    'água cristalina que lava memórias antigas',
    'vento sagrado que dissolve o que não serve mais',
    'luz dourada que preenche cada célula do corpo',
    'névoa violeta de transformação profunda',
    'raios de sol branco que atravessam cada camada da alma',
    'energia verde de cura vinda do coração da Terra',
    'poeira de estrelas que revela o caminho da alma',
    'chuva de luz rosada que nutre o coração desperto',
    'trovões de clareza que dissolvem confusão mental',
    'lava de amor que flui suave e reconstrói o interior',
    'vento de prata que carrega bênçãos dos ancestrais',
    'orvalho de luz que renova cada pensamento e emoção',
    'onda de paz profunda que se expande em círculos a partir do peito'
  ];

  const abordagens = [
    'começando pelo corpo físico e subindo até o espiritual',
    'partindo do silêncio interno e expandindo até o cosmos',
    'descendo camada por camada como mergulhar no oceano da consciência',
    'como uma flor que abre pétala por pétala revelando seu centro',
    'como uma viagem de trem onde cada parada revela um aspecto da alma',
    'como acordar de um sonho para um sonho mais verdadeiro',
    'como a maré que avança suave e inevitavelmente',
    'como música que começa em pianíssimo e cresce até plenitude',
    'como o nascer do sol — gradual, inevitável e glorioso',
    'como espiralar para dentro até o centro mais silencioso de si mesmo',
    'como caminhar descalço — sentindo cada detalhe do percurso sagrado',
    'como uma semente que germina em câmera lenta do interior para o exterior'
  ];

  const intensidades = [
    'suave e etérea', 'profunda e transformadora', 'visionária e expansiva',
    'enraizante e integradora', 'libertadora e levitante', 'receptiva e oceânica',
    'vibrante e desperta', 'íntima e reveladora'
  ];

  const cenario   = pick(cenarios);
  const guia      = pick(guias);
  const elemento  = pick(elementos);
  const abordagem = pick(abordagens);
  const intensidade = pick(intensidades);

  const proibicoes = ultimasMeditacoes.length > 0
    ? `\nPROIBIDO REPETIR — estas são as meditações recentes de ${firstName} (crie algo COMPLETAMENTE diferente em cenário, guia, tom e narrativa):\n${ultimasMeditacoes.map((t, i) => `- Sessão anterior ${i + 1}: "${t}"`).join('\n')}\n`
    : '';

  const prompt = `Você é um Guia de meditação de elite. Crie uma meditação guiada ÚNICA e IRREPETÍVEL para ${firstName}.
${proibicoes}
PERFIL ÚNICO DESTE CONSULENTE:
- Nome: ${firstName}
- Sexo: ${sexo || perfil.sexo || 'não informado'}
- Signo solar: ${signo ? signo : 'NÃO INFORMADO — NÃO mencione nem invente nenhum signo'}
- Cidade de origem: ${cidade || 'não informada'}
- Tema escolhido: ${tema || 'Paz Interior'}
- Intenção pessoal: ${intencao || 'não informada'}
- Número desta sessão: ${sessaoNum}ª meditação de ${firstName}

ELEMENTOS DESTA SESSÃO ESPECÍFICA (use todos — eles tornam esta meditação única):
- Cenário sagrado: ${cenario}
- Guia que aparece: ${guia}
- Elemento de transformação: ${elemento}
- Abordagem narrativa: ${abordagem}
- Tonalidade emocional: ${intensidade}
- Código de variação: ${seed}

REGRAS DE PERSONALIZAÇÃO PROFUNDA:
- Use o signo${signo ? ` (${signo})` : ''} para colorir a energia e o simbolismo desta sessão específica
- ${cidade ? `Incorpore a essência energética de ${cidade} de forma sutil — pode ser uma paisagem, luz, temperatura` : 'Crie uma paisagem sensorial única baseada no tema escolhido'}
- ${sessaoNum > 1 ? `Esta é a ${sessaoNum}ª meditação de ${firstName} — aprofunde o que sessões anteriores iniciaram, leve mais longe` : `Esta é a primeira meditação de ${firstName} — seja acolhedor, introduza o processo com cuidado especial`}
- A intenção "${intencao || tema || 'Paz Interior'}" deve ser o fio condutor de CADA parágrafo — não apenas mencionada
- Use o nome ${firstName} pelo menos 6 vezes ao longo do texto
- O título deve ser completamente diferente de qualquer meditação genérica — único para este momento de ${firstName}

ESTRUTURA (siga exatamente):
1. preparacao — 3 parágrafos: acolhimento + respiração guiada + soltura do corpo
2. descida — 4 parágrafos: jornada sensorial completa até o cenário sagrado
3. encontro — 5 parágrafos: núcleo da meditação com o guia, tema e transformação
4. mensagem — 3 parágrafos: mensagem calorosa e específica para ${firstName} sobre sua intenção
5. retorno — 2 parágrafos: retorno suave e integração da experiência

Responda APENAS em JSON válido sem markdown:
{
  "titulo": "Título poético único de 5 a 8 palavras",
  "duracao": "15 minutos",
  "preparacao": "texto...",
  "descida": "texto...",
  "encontro": "texto...",
  "mensagem": "texto...",
  "retorno": "texto..."
}`;

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 16000,
        temperature: 1,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) return res.status(500).json({ error: 'Erro na API.' });

    // Debita o crédito assim que a IA confirma que vai responder — antes do streaming,
    // para não perder o débito caso a função seja interrompida por timeout.
    if (!emailLiberado && !assinante && email) {
      await debitarCredito(email, 'uso_meditacao').catch(() => {});
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
    if (!res.headersSent) res.status(500).json({ error: err.message });
  }
}
