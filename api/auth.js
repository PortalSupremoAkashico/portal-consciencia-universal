import { createHash } from 'node:crypto';

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...options,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) console.error(`Supabase ${res.status}:`, JSON.stringify(data).slice(0,200));
  return { ok: res.ok, status: res.status, data };
}

// SHA-256 idêntico ao cliente (Web Crypto API usa UTF-8 — igual ao Node)
function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export default async function handler(req, res) {
  console.log('SUPABASE_KEY presente:', !!process.env.SUPABASE_ANON_KEY);
  console.log('Node version:', process.version);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!SUPABASE_KEY) return res.status(500).json({ error: 'Configuração do servidor incompleta.' });

  const { action, nome, email, senha, senha_hash, data_nascimento, sexo, cidade, estado, pais, nome_pai, nome_mae } = req.body;
  const semEmail = ['listar_consulentes'];
  if (!action) return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  if (!email && !semEmail.includes(action)) return res.status(400).json({ error: 'Dados obrigatórios ausentes' });

  // Normaliza: aceita senha em texto (novo) ou SHA-256 do cliente (legado)
  function resolverHash(senhaTexto, hashCliente) {
    if (hashCliente && typeof hashCliente === 'string') return hashCliente;
    if (senhaTexto && typeof senhaTexto === 'string') return sha256(senhaTexto);
    return null;
  }

  // ── CADASTRO ──
  if (action === 'cadastro') {
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const finalHash = resolverHash(senha, senha_hash);
    if (!finalHash) return res.status(400).json({ error: 'Senha obrigatória' });

    const check = await supabaseFetch(`/consulentes?email=eq.${encodeURIComponent(email)}&select=id`, { method: 'GET' });
    if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado. Faça login.' });
    }

    const insert = await supabaseFetch('/consulentes', {
      method: 'POST',
      body: JSON.stringify({ nome, email, senha_hash: finalHash, data_nascimento, sexo, cidade, estado, pais, nome_pai, nome_mae })
    });
    if (!insert.ok) return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });

    const user = Array.isArray(insert.data) ? insert.data[0] : insert.data;
    return res.status(200).json({
      success: true,
      user: { id: user.id, nome: user.nome, email: user.email, data: user.data_nascimento, hora_nascimento: user.hora_nascimento || '', sexo: user.sexo, cidade: user.cidade, estado: user.estado, pais: user.pais, nome_pai: user.nome_pai, nome_mae: user.nome_mae }
    });
  }

  // ── LOGIN ──
  if (action === 'login') {
    const result = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}&select=id,nome,email,senha_hash,data_nascimento,hora_nascimento,sexo,cidade,estado,pais,nome_pai,nome_mae`,
      { method: 'GET' }
    );
    if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
      return res.status(401).json({ error: 'E-mail não encontrado. Verifique ou cadastre-se.' });
    }

    const user = result.data[0];
    const inputHash = resolverHash(senha, senha_hash);

    if (!inputHash || user.senha_hash !== inputHash) {
      return res.status(401).json({ error: 'Senha incorreta.' });
    }

    await supabaseFetch(`/consulentes?id=eq.${user.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ last_login: new Date().toISOString() })
    });

    return res.status(200).json({
      success: true,
      user: { id: user.id, nome: user.nome, email: user.email, data: user.data_nascimento, hora_nascimento: user.hora_nascimento || '', sexo: user.sexo, cidade: user.cidade, estado: user.estado, pais: user.pais, nome_pai: user.nome_pai, nome_mae: user.nome_mae }
    });
  }

  // ── LISTAR TODOS CONSULENTES (admin) ──
  if (action === 'listar_consulentes') {
    const result = await supabaseFetch(
      `/consulentes?select=id,nome,email,created_at&order=created_at.desc`,
      { method: 'GET' }
    );
    if (!result.ok) return res.status(500).json({ error: 'Erro ao listar consulentes.' });
    return res.status(200).json({ success: true, consulentes: result.data || [] });
  }

  // ── VERIFICAR EMAIL ──
  if (action === 'check_email') {
    const result = await supabaseFetch(`/consulentes?email=eq.${encodeURIComponent(email)}&select=id,nome`, { method: 'GET' });
    const exists = result.ok && Array.isArray(result.data) && result.data.length > 0;
    return res.status(200).json({ exists, nome: exists ? result.data[0].nome : null });
  }

  // ── REDEFINIR SENHA ──
  if (action === 'reset_senha') {
    const finalHash = resolverHash(senha, senha_hash);
    if (!finalHash) return res.status(400).json({ error: 'Senha obrigatória.' });
    const update = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}`,
      { method: 'PATCH', body: JSON.stringify({ senha_hash: finalHash }) }
    );
    if (!update.ok) return res.status(500).json({ error: 'Erro ao redefinir senha.' });
    return res.status(200).json({ success: true });
  }

  // ── ATUALIZAR CADASTRO ──
  if (action === 'atualizar_cadastro') {
    const { cidade, estado, pais, nome_pai, nome_mae, hora_nascimento } = req.body;
    const update = await supabaseFetch(
      `/consulentes?email=eq.${encodeURIComponent(email)}`,
      { method: 'PATCH', body: JSON.stringify({ cidade, estado, pais, nome_pai, nome_mae, hora_nascimento }) }
    );
    if (!update.ok) return res.status(500).json({ error: 'Erro ao atualizar dados.' });
    return res.status(200).json({ success: true });
  }

  return res.status(400).json({ error: 'Ação desconhecida' });
}
