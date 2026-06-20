export const config = { maxDuration: 300 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

const EMAILS_LIBERADOS = ['raudix5@gmail.com', 'caudix5@gmail.com'];

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

  // ── GET — listar sonhos ──
  if (req.method === 'GET') {
    const { email } = req.query || {};
    if (!email) return res.status(400).json({ error: 'email obrigatório.' });
    // email=all: retorna todos (para o painel admin)
    const filtro = email === 'all'
      ? `/sonhos?order=created_at.desc&select=*&limit=500`
      : `/sonhos?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`;
    const r = await sbFetch(filtro);
    if (!r.ok) return res.status(500).json({ error: 'Erro ao buscar.' });
    return res.status(200).json({ success: true, sonhos: r.data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};

  // ── POST action=salvar|apagar_um — CRUD ──
  if (body.action === 'salvar' || body.action === 'apagar_um') {
    const { action, email, dados, id } = body;

    if (action === 'salvar') {
      if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
      const r = await sbFetch('/sonhos', { method: 'POST', body: JSON.stringify({ email, dados }) });
      if (!r.ok) console.error('Supabase salvar sonho:', r.ok, JSON.stringify(r.data).slice(0,200));
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao salvar.', detail: r.data });
    }

    if (action === 'apagar_um') {
      if (!id || !email) return res.status(400).json({ error: 'ID e email obrigatórios.' });
      const r = await sbFetch(`/sonhos?id=eq.${id}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
      return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro ao apagar.' });
    }
  }

  // ── POST — geração da interpretação do sonho ──
  const { nome, sexo, sonho, emocao, email } = body;
  if (!nome) return res.status(400).json({ error: 'Nome obrigatório.' });
  if (!sonho) return res.status(400).json({ error: 'Descreva o sonho.' });

  // ── Verificação de acesso: email liberado, assinante, ou crédito de trial ──
  const emailLiberado = !!email && EMAILS_LIBERADOS.includes(String(email).toLowerCase().trim());
  const assinante = !emailLiberado && !!email && await temAssinaturaPortal(email);
  if (!emailLiberado && !assinante) {
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
    const saldo = await obterSaldoCreditos(email);
    if (saldo < 1) {
      return res.status(402).json({ error: 'Você não tem créditos disponíveis. Adquira em /planos para continuar.' });
    }
  }

  const firstName = (nome || 'Alma').trim().split(/\s+/)[0];

  const semente = Math.floor(Math.random() * 99999);
  const abordagens = [
    'simbólica e arquetípica', 'akáshica e kármica', 'psicológica e transpessoal',
    'energética e espiritual', 'numerológica e mística', 'mitológica e ancestral',
    'alquímica e transformacional', 'xamânica e visionária',
  ];
  const abordagem = abordagens[semente % abordagens.length];

  const prompt = `Voce e o Grande Interprete dos Registros Akashicos. Interprete o sonho de ${firstName} com profundidade e calor.

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

  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 10000, stream: true, messages: [{ role: 'user', content: prompt }] })
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.text();
      console.error('Anthropic error:', err);
      if (anthropicRes.status === 529) return res.status(503).json({ error: 'Os Guardiões estão em alta demanda. Tente novamente em instantes.' });
      return res.status(500).json({ error: 'Erro na API.', detail: err });
    }

    // Debita o crédito assim que a IA confirma que vai responder — antes do streaming,
    // para não perder o débito caso a função seja interrompida por timeout.
    if (!emailLiberado && !assinante && email) {
      await debitarCredito(email, 'uso_sonho').catch(() => {});
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
    console.error('sonho error:', err.message);
    if (!res.headersSent) res.status(500).json({ error: err.message });
    else res.end();
  }
}
