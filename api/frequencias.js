export const config = { maxDuration: 120 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function sbFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json', 'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { ok: res.ok, data };
}

async function emailEhLiberado(email) {
  if (!email) return false;
  const url = `/emails_liberados?email=eq.${encodeURIComponent(String(email).toLowerCase().trim())}&select=email`;
  const r = await sbFetch(url);
  return Array.isArray(r.data) && r.data.length > 0;
}

async function temAssinaturaPortal(email) {
  const url = `/assinaturas?email=eq.${encodeURIComponent(email)}&servico=in.(plano_despertar,plano_expansao,plano_infinito,portal_mensal)&status=eq.authorized&select=id`;
  const r = await sbFetch(url);
  return Array.isArray(r.data) && r.data.length > 0;
}

async function obterSaldoCreditos(email) {
  const url = `/creditos_movimentos?email=eq.${encodeURIComponent(email)}&select=quantidade`;
  const r = await sbFetch(url);
  if (!Array.isArray(r.data)) return 0;
  return r.data.reduce((soma, l) => soma + (Number(l.quantidade) || 0), 0);
}

async function debitarCredito(email, motivo) {
  const r = await sbFetch('/creditos_movimentos', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({ email, quantidade: -1, motivo, referencia: `${motivo}_${Date.now()}` })
  });
  if (!r.ok) console.error('debitarCredito falhou:', motivo, r.data);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: 'email obrigatório' });
    const path = email === 'all'
      ? '/frequencias_sessoes?order=created_at.desc&select=*'
      : `/frequencias_sessoes?email=eq.${encodeURIComponent(email)}&order=created_at.desc&select=*`;
    const r = await sbFetch(path);
    return res.status(200).json({ success: true, sessoes: r.data || [] });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { action, email, nome, estado, intencao, dados, id } = req.body || {};

  if (action === 'salvar') {
    if (!email || !dados) return res.status(400).json({ error: 'Dados obrigatórios.' });
    const r = await sbFetch('/frequencias_sessoes', { method: 'POST', body: JSON.stringify({ email, dados }) });
    if (!r.ok) return res.status(500).json({ error: 'Erro ao salvar.' });
    const reg = Array.isArray(r.data) ? r.data[0] : r.data;
    return res.status(200).json({ success: true, id: reg?.id });
  }

  if (action === 'apagar') {
    if (!id || !email) return res.status(400).json({ error: 'ID e email obrigatórios.' });
    const r = await sbFetch(`/frequencias_sessoes?id=eq.${id}&email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
    return res.status(r.ok ? 200 : 500).json(r.ok ? { success: true } : { error: 'Erro.' });
  }

  if (action === 'gerar') {
    if (!nome || !estado) return res.status(400).json({ error: 'Nome e estado obrigatórios.' });
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });

    const emailLiberado = await emailEhLiberado(email);
    const assinante = !emailLiberado && await temAssinaturaPortal(email);
    if (!emailLiberado && !assinante) {
      const saldo = await obterSaldoCreditos(email);
      if (saldo < 1) {
        return res.status(402).json({ error: 'Você não tem créditos disponíveis. Adquira em /planos para continuar.' });
      }
    }

    const firstName = nome.trim().split(/\s+/)[0];

    const prompt = `Você é um guia de frequências de cura e geometria sagrada. Analise profundamente o estado de ${firstName} e selecione a frequência e a geometria sagrada mais alinhadas com este momento específico.

CONSULENTE: ${firstName}
ESTADO ATUAL: ${estado}
SEED DE VARIAÇÃO: ${Math.floor(Math.random()*9000)+1000}
INTENÇÃO: ${intencao || 'não informada'}

AS 9 FREQUÊNCIAS SOLFÈGE:
174 Hz — Raiz e Segurança: alívio de dor, ancoragem, sensação de proteção
285 Hz — Regeneração: regeneração celular, campo energético, vitalidade
396 Hz — Libertação: liberação de medo, culpa e bloqueios emocionais profundos
417 Hz — Dissolução: dissolução de padrões antigos, abertura radical para a mudança
528 Hz — Amor e Milagres: transformação, reparação do DNA, amor incondicional
639 Hz — Conexão: relacionamentos, comunicação, harmonia interpessoal
741 Hz — Expressão: intuição, limpeza energética, clareza de propósito
852 Hz — Despertar: despertar espiritual, intuição superior, visão ampliada
963 Hz — Unidade Divina: conexão com o cosmos, consciência pura, dissolução do ego

GEOMETRIAS SAGRADAS DISPONÍVEIS:
Flor da Vida, Semente da Vida, Vesica Piscis, Espiral Áurea, Cubo de Metatron, Merkaba, Sri Yantra, Torus, Fruto da Vida, Tetraedro Sagrado, Triquetra, Triskelion, Estrela de 8 Pontas, Lotus de 8 Pétalas, Cruz Solar Celta, Hexagrama, Dodecaedro, Icosaedro, Tetractys, Yantra da Lua

REGRAS:
- REGRA CRÍTICA: analise genuinamente o estado de ${firstName} e escolha a frequência e geometria mais adequadas — NUNCA como padrão ou por familiaridade. 528 Hz e Flor da Vida são apenas duas das 9 frequências e 20 geometrias disponíveis. Distribua as escolhas com critério real. Se o estado não indicar claramente 528 Hz, escolha outra. Surpreenda — use frequências como 174, 285, 396, 639, 741, 852 ou 963 Hz quando pertinentes, e geometrias além das mais comuns
- Cada texto deve ser específico ao estado de ${firstName}, não genérico
- Conecte diretamente com o que ${firstName} descreveu
- Português do Brasil, segunda pessoa direta
- Texto CURTO mas PROFUNDO: cada parágrafo deve ser denso em significado, não extenso em palavras
- CAMINHO DA ESCOLHA: 3 parágrafos. Por que esta frequência para ${firstName} agora, o que ela dissolve, o que ela abre. Filosófico e direto
- CURA PROFUNDA: 3 parágrafos. Como a combinação frequência e geometria age no campo de ${firstName}. Espiritual e sensorial
- INTENÇÃO PLANTADA: 2 parágrafos. A intenção de ${firstName} em camadas — imediata e da alma. Transformador
- Cada parágrafo: 3 frases potentes, sem enrolação
- Nunca use listas, marcadores ou subtítulos
- PROIBIDO usar travessão (—) em qualquer parte do texto. Substitua por vírgula, dois-pontos ou ponto-e-vírgula

Responda APENAS em JSON válido, sem markdown, sem aspas tipográficas, sem quebras de linha dentro dos valores — use \\n para separar parágrafos:
{
  "frequencia_hz": número,
  "frequencia_nome": "nome",
  "geometria": "nome da geometria",
  "mensagem": "1 frase curta e direta conectando a frequência com o que ${firstName} está vivendo — ex: Esta frequência vem ao seu encontro porque...",
  "significado_geometria": "2 parágrafos: primeiro explica o que esta geometria sagrada é e representa universalmente; segundo conecta especificamente com o momento e a intenção de ${firstName}",
  "leitura": {
    "escolha": "parágrafo 1\\n\\nparágrafo 2\\n\\nparágrafo 3",
    "cura": "parágrafo 1\\n\\nparágrafo 2\\n\\nparágrafo 3",
    "intencao": "parágrafo 1\\n\\nparágrafo 2"
  }
}`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL_SONNET || 'claude-sonnet-4-6', max_tokens: 1800, messages: [{ role: 'user', content: prompt }] })
      });
      if (!resp.ok) { const e = await resp.text(); return res.status(500).json({ error: 'Erro na API.', detail: e }); }

      if (!emailLiberado && !assinante) {
        await debitarCredito(email, 'frequencias').catch(() => {});
      }

      const apiData = await resp.json();
      let text = apiData.content?.[0]?.text || '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(500).json({ error: 'Resposta inválida.' });

      // Tenta parse direto; se falhar, limpa caracteres problemáticos
      let parsed;
      try {
        parsed = JSON.parse(match[0]);
      } catch(parseErr) {
        // Remove aspas tipográficas, escapa aspas dentro de strings JSON
        let cleaned = match[0]
          .replace(/[\u201C\u201D\u201E\u201F\u2033\u2036]/g, '\"') // aspas tipográficas duplas
          .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "\'") // aspas tipográficas simples
          .replace(/\r\n/g,'\\n').replace(/\r/g,'\\n').replace(/\n/g,'\\n') // quebras de linha
          .replace(/\t/g,'\\t'); // tabs
        try {
          parsed = JSON.parse(cleaned);
        } catch(e2) {
          // Última tentativa: extrai campos individualmente com regex
          const hz  = text.match(/"frequencia_hz"\s*:\s*(\d+)/)?.[1];
          const nom = text.match(/"frequencia_nome"\s*:\s*"([^"]+)"/)?.[1];
          const geo = text.match(/"geometria"\s*:\s*"([^"]+)"/)?.[1];
          // Para o texto da leitura, pega tudo entre as chaves de leitura
          const leitMatch = text.match(/"leitura"\s*:\s*\{([\s\S]*?)\}\s*\}/);
          const leitTxt = leitMatch ? leitMatch[1] : '';
          const esc = text.match(/"escolha"\s*:\s*"([\s\S]*?)(?=","cura")/)?.[1]?.replace(/"/g,"'")||'';
          const cur = text.match(/"cura"\s*:\s*"([\s\S]*?)(?=","intencao")/)?.[1]?.replace(/"/g,"'")||'';
          const int = text.match(/"intencao"\s*:\s*"([\s\S]*?)(?="\}|$)/)?.[1]?.replace(/"/g,"'")||'';
          if (!hz) return res.status(500).json({ error: 'Não foi possível interpretar a resposta da IA.', raw: text.slice(0,300) });
          parsed = { frequencia_hz: parseInt(hz), frequencia_nome: nom||'', geometria: geo||'Flor da Vida',
            leitura: { escolha: esc, cura: cur, intencao: int } };
        }
      }
      // Remove travessões de todos os textos antes de retornar
      function semTravessao(obj) {
        if (typeof obj === 'string') return obj.replace(/—/g, ',').replace(/--/g, ',');
        if (Array.isArray(obj)) return obj.map(semTravessao);
        if (obj && typeof obj === 'object') {
          const r = {};
          for (const k in obj) r[k] = semTravessao(obj[k]);
          return r;
        }
        return obj;
      }
      return res.status(200).json({ success: true, ...semTravessao(parsed) });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(400).json({ error: 'Ação não reconhecida.' });
}
