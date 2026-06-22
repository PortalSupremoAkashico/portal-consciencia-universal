import { createHash } from 'node:crypto';

export const config = { maxDuration: 30 };

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

// Domínios de e-mail descartável/temporário mais comuns — bloqueados no cadastro
const DOMINIOS_DESCARTAVEIS = new Set([
  'mailinator.com','10minutemail.com','10minutemail.net','guerrillamail.com','guerrillamail.net',
  'guerrillamail.org','guerrillamail.biz','guerrillamail.de','sharklasers.com','tempmail.com',
  'temp-mail.org','tempmail.net','tempmailo.com','yopmail.com','yopmail.net','yopmail.fr',
  'throwawaymail.com','dispostable.com','fakeinbox.com','getnada.com','maildrop.cc','mintemail.com',
  'moakt.com','spambog.com','tempinbox.com','tempr.email','mohmal.com','emailondeck.com',
  'trashmail.com','trashmail.net','trash-mail.com','mailnesia.com','mailcatch.com','mvrht.com',
  'discard.email','discardmail.com','spamgourmet.com','33mail.com','mytemp.email','tempmailapp.com',
  'inboxbear.com','burnermail.io','dropmail.me','luxusmail.org','mailsac.com','crazymailing.com',
  'fakemailgenerator.com','emailfake.com','tempemail.co','tempmail.dev','nada.email','spam4.me',
  'mailtemp.net','tmpmail.org','tmpmail.net','tmail.ws','wegwerfemail.de','einrot.com',
  'mailme.lv','mailnull.com','mt2015.com','noclickemail.com','spamfree24.org','tafmail.com',
  'tagyourself.com','trbvm.com','trickmail.net','veryrealemail.com','wh4f.org','zippymail.info'
]);

function emailEhDescartavel(email) {
  const dominio = (email || '').split('@')[1];
  return dominio ? DOMINIOS_DESCARTAVEIS.has(dominio.toLowerCase().trim()) : false;
}

function obterIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || '';
}

async function enviarEmailCodigo(to, nome, codigo) {
  const firstName = nome ? nome.trim().split(/\s+/)[0] : 'viajante';
  const corpo = `Olá ${firstName},\n\nSeu código de verificação para criar sua conta é:\n\n${codigo}\n\nVálido por 15 minutos.\n\nPORTAL DA CONSCIÊNCIA UNIVERSAL`;
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://www.portaldaconscienciauniversal.com';
    const resp = await fetch(`${base}/api/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject: 'Código de Verificação — Portal da Consciência Universal', body: corpo })
    });
    const data = await resp.json().catch(() => ({}));
    console.log('[auth] envio código via /api/email:', resp.status, JSON.stringify(data).slice(0, 150));
  } catch (e) { console.error('[auth] erro ao enviar código:', e.message); }
}

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
  const semEmail = ['listar_consulentes', 'listar_forum'];
  if (!action) return res.status(400).json({ error: 'Dados obrigatórios ausentes' });
  if (!email && !semEmail.includes(action)) return res.status(400).json({ error: 'Dados obrigatórios ausentes' });

  // Normaliza: aceita senha em texto (novo) ou SHA-256 do cliente (legado)
  function resolverHash(senhaTexto, hashCliente) {
    if (hashCliente && typeof hashCliente === 'string') return hashCliente;
    if (senhaTexto && typeof senhaTexto === 'string') return sha256(senhaTexto);
    return null;
  }

  // ── INICIAR CADASTRO (valida, gera código, envia e-mail) ──
  if (action === 'iniciar_cadastro') {
    if (!nome) return res.status(400).json({ error: 'Nome obrigatório' });
    const finalHash = resolverHash(senha, senha_hash);
    if (!finalHash) return res.status(400).json({ error: 'Senha obrigatória' });

    if (emailEhDescartavel(email)) {
      return res.status(400).json({ error: 'Por favor, use um e-mail pessoal válido. E-mails temporários não são aceitos.' });
    }

    const check = await supabaseFetch(`/consulentes?email=eq.${encodeURIComponent(email)}&select=id`, { method: 'GET' });
    if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
      return res.status(409).json({ error: 'E-mail já cadastrado. Faça login.' });
    }

    const { fingerprint } = req.body;
    const ip = obterIp(req);
    const codigo = String(Math.floor(100000 + Math.random() * 900000));
    const expira_em = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const dados = { nome, email, senha_hash: finalHash, data_nascimento, sexo, cidade, estado, pais, nome_pai, nome_mae };

    // Remove pendências antigas do mesmo e-mail (permite reenviar código)
    await supabaseFetch(`/verificacoes_cadastro?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });

    const insertVerif = await supabaseFetch('/verificacoes_cadastro', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ email, codigo, dados, fingerprint: fingerprint || '', ip, expira_em })
    });
    if (!insertVerif.ok) return res.status(500).json({ error: 'Erro ao iniciar cadastro. Tente novamente.' });

    await enviarEmailCodigo(email, nome, codigo);

    return res.status(200).json({ success: true });
  }

  // ── CONFIRMAR CADASTRO (valida código, cria conta, decide créditos trial) ──
  if (action === 'confirmar_cadastro') {
    const { codigo } = req.body;
    if (!codigo) return res.status(400).json({ error: 'Código obrigatório.' });

    const verifResult = await supabaseFetch(
      `/verificacoes_cadastro?email=eq.${encodeURIComponent(email)}&select=*&order=criado_em.desc&limit=1`,
      { method: 'GET' }
    );
    const pendente = verifResult.ok && Array.isArray(verifResult.data) ? verifResult.data[0] : null;
    if (!pendente) return res.status(400).json({ error: 'Sessão expirada. Solicite um novo código.' });
    if (new Date(pendente.expira_em).getTime() < Date.now()) {
      await supabaseFetch(`/verificacoes_cadastro?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
      return res.status(400).json({ error: 'Código expirado. Solicite um novo.' });
    }
    if (String(codigo) !== String(pendente.codigo)) {
      return res.status(400).json({ error: 'Código incorreto.' });
    }

    // Checagem de corrida: e-mail pode ter sido cadastrado entre o início e a confirmação
    const check = await supabaseFetch(`/consulentes?email=eq.${encodeURIComponent(email)}&select=id`, { method: 'GET' });
    if (check.ok && Array.isArray(check.data) && check.data.length > 0) {
      await supabaseFetch(`/verificacoes_cadastro?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
      return res.status(409).json({ error: 'E-mail já cadastrado. Faça login.' });
    }

    const d = pendente.dados || {};
    const insert = await supabaseFetch('/consulentes', {
      method: 'POST',
      body: JSON.stringify({
        nome: d.nome, email: d.email, senha_hash: d.senha_hash, data_nascimento: d.data_nascimento,
        sexo: d.sexo, cidade: d.cidade, estado: d.estado, pais: d.pais, nome_pai: d.nome_pai, nome_mae: d.nome_mae
      })
    });
    if (!insert.ok) return res.status(500).json({ error: 'Erro ao criar conta. Tente novamente.' });
    const user = Array.isArray(insert.data) ? insert.data[0] : insert.data;

    // Decide se concede os 3 créditos de boas-vindas (anti-fraude por dispositivo/IP)
    const fingerprint = pendente.fingerprint || '';
    const ip = pendente.ip || '';
    let concederCreditos = true;

    if (fingerprint) {
      const fpResult = await supabaseFetch(`/trial_dispositivos?fingerprint=eq.${encodeURIComponent(fingerprint)}&select=id&limit=1`, { method: 'GET' });
      if (fpResult.ok && Array.isArray(fpResult.data) && fpResult.data.length > 0) concederCreditos = false;
    }
    if (concederCreditos && ip) {
      const ipResult = await supabaseFetch(`/trial_dispositivos?ip=eq.${encodeURIComponent(ip)}&select=id`, { method: 'GET' });
      if (ipResult.ok && Array.isArray(ipResult.data) && ipResult.data.length >= 3) concederCreditos = false;
    }

    if (concederCreditos) {
      await supabaseFetch('/creditos_movimentos', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ email, quantidade: 3, motivo: 'trial_boas_vindas', referencia: `trial_${user.id}` })
      });
    }
    await supabaseFetch('/trial_dispositivos', {
      method: 'POST',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify({ fingerprint, ip, email })
    });

    await supabaseFetch(`/verificacoes_cadastro?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });

    return res.status(200).json({
      success: true,
      creditos_concedidos: concederCreditos ? 3 : 0,
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

  // ── ADMIN: LISTAR POSTS DO FÓRUM ──
  if (action === 'listar_forum') {
    const result = await supabaseFetch(`/forum_ufologico?select=*&order=created_at.desc`, { method: 'GET' });
    if (!result.ok) return res.status(500).json({ error: 'Erro ao listar fórum.' });
    return res.status(200).json({ success: true, posts: result.data || [] });
  }

  // ── ADMIN: APAGAR UM POST DO FÓRUM ──
  if (action === 'apagar_forum_post') {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'ID obrigatório.' });
    const del = await supabaseFetch(`/forum_ufologico?id=eq.${id}`, { method: 'DELETE' });
    return res.status(del.ok ? 200 : 500).json(del.ok ? { success: true } : { error: 'Erro ao apagar post.' });
  }

  // ── ADMIN: EXCLUIR CONSULENTE COMPLETAMENTE ──
  if (action === 'excluir_consulente_completo') {
    if (!email) return res.status(400).json({ error: 'Email obrigatório.' });
    const del = await supabaseFetch(`/consulentes?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
    if (!del.ok) return res.status(500).json({ error: 'Erro ao excluir consulente.' });
    return res.status(200).json({ success: true });
  }

  // ── VERIFICAR ACESSO (assinatura ou créditos de trial) ──
  if (action === 'verificar_acesso') {
    // 0. E-mails liberados de pagamento (tabela emails_liberados) — acesso sempre garantido
    if (email) {
      const liberadoResult = await supabaseFetch(
        `/emails_liberados?email=eq.${encodeURIComponent(email.toLowerCase().trim())}&select=email`,
        { method: 'GET' }
      );
      if (liberadoResult.ok && Array.isArray(liberadoResult.data) && liberadoResult.data.length > 0) {
        return res.status(200).json({ acesso: true, tipo: 'liberado' });
      }
    }

    // 1. Verifica assinatura ativa
    const subResult = await supabaseFetch(
      `/assinaturas?email=eq.${encodeURIComponent(email)}&servico=eq.portal_mensal&status=eq.authorized&select=id`,
      { method: 'GET' }
    );
    if (subResult.ok && Array.isArray(subResult.data) && subResult.data.length > 0) {
      return res.status(200).json({ acesso: true, tipo: 'assinante' });
    }

    // 2. Verifica créditos de trial
    const credResult = await supabaseFetch(
      `/creditos_movimentos?email=eq.${encodeURIComponent(email)}&select=quantidade`,
      { method: 'GET' }
    );
    const saldo = credResult.ok && Array.isArray(credResult.data)
      ? credResult.data.reduce((s, l) => s + (Number(l.quantidade) || 0), 0)
      : 0;

    if (saldo >= 1) return res.status(200).json({ acesso: true, tipo: 'trial', saldo });
    return res.status(200).json({ acesso: false });
  }

  return res.status(400).json({ error: 'Ação desconhecida' });
}
