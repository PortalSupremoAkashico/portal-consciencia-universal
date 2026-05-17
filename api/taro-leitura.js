export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { nome, sexo, cartas, tiragem, pergunta, email } = req.body || {};
  if (!cartas || !cartas.length) return res.status(400).json({ error: 'Cartas obrigatórias.' });

  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];
  const perguntaReal = pergunta || 'leitura livre';

  const cartasTexto = cartas.map((c, i) =>
    `${i+1}. Posição "${c.posicao}": ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}`
  ).join('\n');

  const prompt = `Tarólogo akáshico. Leitura para ${firstName}. Seja conciso e direto.

NAIPES: CHAMAS=Fogo, CÁLICES=Água, CRISTAIS=Ar, ESTRELAS=Terra. Arcanos=karma.
CONSULENTE: ${firstName}. PERGUNTA: "${perguntaReal}".

CARTAS:
${cartasTexto}

FORMATO (siga exatamente, 1 parágrafo por carta, sem markdown):

TITULO: [título poético curto]

${cartas.map((c, i) => `CARTA_${i+1}
POSICAO: ${c.posicao}
NOME: ${c.nome}${c.invertida ? ' (INVERTIDA)' : ''}
INTERPRETACAO: [1 parágrafo de 3-4 linhas: significado da carta + conexão direta com a pergunta "${perguntaReal}" + mensagem para ${firstName}]`).join('\n\n')}

SINTESE: [1 parágrafo com o padrão geral e caminho para ${firstName}]

ACAO: [1 frase com ação concreta para ${firstName}]`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 2500,
        stream: false,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', anthropicRes.status, err.slice(0, 200));
      return res.status(500).json({ error: 'Erro na API Anthropic.', status: anthropicRes.status });
    }

    const data = await anthropicRes.json();
    const texto = data.content?.[0]?.text || '';

    if (!texto) return res.status(500).json({ error: 'Resposta vazia da API.' });

    // Parsear o formato de texto simples
    const result = parsearLeitura(texto, cartas);

    // Salvar no Supabase (tabela leituras_taro)
    if (email) {
      try {
        const dadosParaSalvar = {
          titulo: result.titulo,
          tiragem: tiragem || 'Leitura Livre',
          pergunta: pergunta || '',
          cartas: result.cartas,
          sintese: result.sintese,
        };
        await fetch(`${process.env.SUPABASE_URL}/rest/v1/leituras_taro`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': process.env.SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_ANON_KEY}`,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({ email, dados: JSON.stringify(dadosParaSalvar) })
        });
      } catch(e) { /* salvar não é crítico */ }
    }

    return res.status(200).json({ success: true, leitura: result });

  } catch (err) {
    console.error('taro-leitura error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function parsearLeitura(texto, cartas) {
  const linhas = texto.split('\n');

  let titulo = '';
  const cartasParsed = [];
  let sintese = '';
  let acao = '';

  let cartaAtual = null;
  let interpretacaoLines = [];
  let sinteseLines = [];
  let acaoLines = [];
  let modo = '';

  for (const linha of linhas) {
    const trim = linha.trim();

    if (trim.startsWith('TITULO:')) {
      titulo = trim.replace('TITULO:', '').trim();
      modo = '';
    } else if (/^CARTA_\d+$/.test(trim)) {
      if (cartaAtual && interpretacaoLines.length) {
        cartaAtual.interpretacao = interpretacaoLines.join('\n').trim();
        cartasParsed.push(cartaAtual);
      }
      cartaAtual = { posicao: '', carta: '', invertida: false, interpretacao: '' };
      interpretacaoLines = [];
      modo = 'carta';
    } else if (trim.startsWith('POSICAO:') && cartaAtual) {
      cartaAtual.posicao = trim.replace('POSICAO:', '').trim();
    } else if (trim.startsWith('NOME:') && cartaAtual) {
      const nomeCompleto = trim.replace('NOME:', '').trim();
      cartaAtual.invertida = nomeCompleto.includes('(INVERTIDA)');
      cartaAtual.carta = nomeCompleto.replace('(INVERTIDA)', '').trim();
    } else if (trim.startsWith('INTERPRETACAO:') && cartaAtual) {
      const resto = trim.replace('INTERPRETACAO:', '').trim();
      if (resto) interpretacaoLines.push(resto);
      modo = 'interpretacao';
    } else if (trim.startsWith('SINTESE:')) {
      if (cartaAtual && interpretacaoLines.length) {
        cartaAtual.interpretacao = interpretacaoLines.join('\n').trim();
        cartasParsed.push(cartaAtual);
        cartaAtual = null;
      }
      const resto = trim.replace('SINTESE:', '').trim();
      if (resto) sinteseLines.push(resto);
      modo = 'sintese';
    } else if (trim.startsWith('ACAO:')) {
      const resto = trim.replace('ACAO:', '').trim();
      if (resto) acaoLines.push(resto);
      modo = 'acao';
    } else if (trim) {
      if (modo === 'interpretacao' && cartaAtual) interpretacaoLines.push(trim);
      else if (modo === 'sintese') sinteseLines.push(trim);
      else if (modo === 'acao') acaoLines.push(trim);
    }
  }

  // Finalizar última carta
  if (cartaAtual && interpretacaoLines.length) {
    cartaAtual.interpretacao = interpretacaoLines.join('\n').trim();
    cartasParsed.push(cartaAtual);
  }

  sintese = sinteseLines.join('\n').trim();
  acao = acaoLines.join('\n').trim();

  // Fallback: usar dados originais das cartas se parsear falhou
  const cartasFinais = cartas.map((c, i) => {
    const parsed = cartasParsed[i];
    return {
      posicao: c.posicao,
      carta: parsed?.carta || c.nome,
      invertida: c.invertida,
      interpretacao: parsed?.interpretacao || c.nome
    };
  });

  return {
    titulo: titulo || 'Leitura Akáshica',
    cartas: cartasFinais,
    sintese: sintese || '',
    acao_sagrada: acao || ''
  };
}
