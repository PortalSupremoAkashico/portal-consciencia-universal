export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { nome, sexo, tema, intencao } = req.body || {};
  if (!nome) return res.status(400).json({ error: 'Dados obrigatórios.' });

  const firstName = nome.trim().split(/\s+/)[0];

  // Elementos aleatórios que garantem unicidade mesmo com o mesmo tema
  const seed = Math.floor(Math.random() * 999999);

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
    'uma catedral de bambu dourado onde a brisa toca como música sagrada'
  ];

  const guias = [
    'um ser de luz dourada sem forma definida, pura presença e amor',
    'um ancião sábio de olhos como galáxias e voz como rio profundo',
    'um anjo de cristal cujas asas refletem todas as cores da criação',
    'a própria voz da sua alma, finalmente audível e clara',
    'um guardião animal de luz — totem da sua jornada atual',
    'uma presença feminina de energia suave como a lua cheia',
    'um mestre de luz sem nome, apenas sensação de reconhecimento profundo',
    'os próprios Guardiões Akáshicos em forma de constelação viva'
  ];

  const elementos = [
    'chamas azuis que curam sem queimar',
    'água cristalina que lava memórias antigas',
    'vento sagrado que dissolve o que não serve mais',
    'luz dourada que preenche cada célula do corpo',
    'névoa violeta de transformação profunda',
    'raios de sol branco que atravessam cada camada da alma',
    'energia verde de cura vinda do coração da Terra',
    'poeira de estrelas que revela o caminho da alma'
  ];

  const abordagens = [
    'começando pelo corpo físico e subindo até o espiritual',
    'partindo do silêncio interno e expandindo até o cosmos',
    'descendo camada por camada como mergulhar no oceano da consciência',
    'como uma flor que abre pétala por pétala revelando seu centro',
    'como uma viagem de trem onde cada parada revela um aspecto da alma',
    'como acordar de um sonho para um sonho mais verdadeiro',
    'como a maré que avança suave e inevitavelmente',
    'como música que começa em pianíssimo e cresce até plenitude'
  ];

  const cenario  = cenarios [seed % cenarios.length];
  const guia     = guias    [Math.floor(seed / 3) % guias.length];
  const elemento = elementos[Math.floor(seed / 7) % elementos.length];
  const abordagem= abordagens[Math.floor(seed / 13) % abordagens.length];
  const intensidade = ['suave e etérea', 'profunda e transformadora', 'visionária e expansiva', 'enraizante e integradora'][seed % 4];

  const prompt = `Você é um Guia Akáshico de meditação. Crie uma meditação guiada ÚNICA e IRREPETÍVEL para ${firstName}.

DADOS:
- Nome: ${firstName}
- Tema: ${tema || 'Paz Interior'}
- Intenção: ${intencao || 'não informada'}
- Sexo: ${sexo || 'não informado'}

ELEMENTOS DESTA SESSÃO ESPECÍFICA (use todos — eles tornam esta meditação única):
- Cenário sagrado: ${cenario}
- Guia que aparece: ${guia}
- Elemento de transformação: ${elemento}
- Abordagem narrativa: ${abordagem}
- Tonalidade emocional: ${intensidade}
- Código de variação: ${seed}

REGRAS DE UNICIDADE:
- O título deve refletir o cenário e o tema juntos — nunca genérico
- A descida deve descrever o cenário com detalhes sensoriais únicos (cheiro, textura, temperatura, som específico)
- O guia deve aparecer de forma concreta e descrita — não apenas "uma presença"
- A mensagem dos Guardiões deve mencionar a intenção de ${firstName} de forma direta
- Use o nome ${firstName} pelo menos 6 vezes ao longo do texto
- Cada parágrafo deve ter entre 3 e 5 linhas — nem muito curto nem excessivamente longo

ESTRUTURA (siga exatamente):
1. preparacao — 3 parágrafos: acolhimento + respiração guiada + soltura do corpo
2. descida — 4 parágrafos: jornada sensorial completa até o cenário sagrado
3. encontro — 5 parágrafos: núcleo da meditação com o guia, tema e transformação
4. mensagem — 3 parágrafos: mensagem calorosa e específica dos Guardiões para ${firstName}
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
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8000,
        temperature: 1,
        stream: true,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) return res.status(500).json({ error: 'Erro na API.' });

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
