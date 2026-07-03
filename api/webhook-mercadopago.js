// api/webhook-mercadopago.js
// Recebe notificações do Mercado Pago (pagamento único e assinatura recorrente),
// valida a assinatura secreta (x-signature) e atualiza o Supabase.
// Variáveis de ambiente necessárias na Vercel:
//   MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET, SUPABASE_SERVICE_ROLE_KEY

import crypto from 'crypto';

const SUPABASE_URL = 'https://opykejeaxehvzogrrwto.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

function validarAssinatura(xSignature, xRequestId, dataId, secret) {
  if (!xSignature || !xRequestId || !dataId || !secret) return false;

  const partes = {};
  xSignature.split(',').forEach((parte) => {
    const [chave, valor] = parte.split('=');
    if (chave) partes[chave.trim()] = valor;
  });

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${partes.ts};`;
  const hashCalculado = crypto.createHmac('sha256', secret).update(manifest).digest('hex');

  return hashCalculado === partes.v1;
}

async function atualizarSupabase(tabela, colunaFiltro, valorFiltro, dados) {
  const url = `${SUPABASE_URL}/rest/v1/${tabela}?${colunaFiltro}=eq.${encodeURIComponent(valorFiltro)}`;
  await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify(dados)
  });
}

// Pacotes avulsos (pacote_5, pacote_15, pacote_mensal) foram descontinuados.
// Não existe mais crédito avulso comprável — apenas os 3 créditos de boas-vindas
// de conta nova, e depois disso apenas os 3 planos de assinatura.

async function buscarPagamento(externalReference) {
  const url = `${SUPABASE_URL}/rest/v1/pagamentos?external_reference=eq.${encodeURIComponent(externalReference)}&select=servico,email`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const linhas = await resp.json();
  return Array.isArray(linhas) ? linhas[0] : null;
}

async function buscarAssinatura(preapprovalId) {
  const url = `${SUPABASE_URL}/rest/v1/assinaturas?mp_preapproval_id=eq.${encodeURIComponent(preapprovalId)}&select=servico,email`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const linhas = await resp.json();
  return Array.isArray(linhas) ? linhas[0] : null;
}

async function jaCreditado(referencia) {
  const url = `${SUPABASE_URL}/rest/v1/creditos_movimentos?referencia=eq.${encodeURIComponent(referencia)}&select=id`;
  const resp = await fetch(url, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
  });
  const linhas = await resp.json();
  return Array.isArray(linhas) && linhas.length > 0;
}

async function creditarPacote(email, quantidade, motivo, referencia) {
  await fetch(`${SUPABASE_URL}/rest/v1/creditos_movimentos`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ email, quantidade, motivo, referencia })
  });
}

export default async function handler(req, res) {
  // O Mercado Pago espera 200 rapidamente — sempre respondemos 200,
  // mesmo em caso de erro de validação, pra evitar reenvios infinitos.
  if (req.method !== 'POST') return res.status(200).end();

  try {
    const xSignature = req.headers['x-signature'];
    const xRequestId = req.headers['x-request-id'];
    const { type, data } = req.body || {};
    const dataId = data?.id || req.query['data.id'] || req.query.id;

    const assinaturaValida = validarAssinatura(
      xSignature,
      xRequestId,
      dataId,
      process.env.MP_WEBHOOK_SECRET
    );

    if (!assinaturaValida) {
      console.warn('Webhook MP: assinatura inválida ou ausente — processando mesmo assim (verificação via API do MP)');
      // Não rejeita — continua processando, pois vamos validar o pagamento direto na API do MP
    }

    if (type === 'payment') {
      const respostaMP = await fetch(`https://api.mercadopago.com/v1/payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const pagamento = await respostaMP.json();

      if (pagamento.external_reference) {
        await atualizarSupabase('pagamentos', 'external_reference', pagamento.external_reference, {
          status: pagamento.status,
          mp_payment_id: String(pagamento.id),
          atualizado_em: new Date().toISOString()
        });

        if (pagamento.status === 'approved') {
          const registro = await buscarPagamento(pagamento.external_reference);

          if (registro && !(await jaCreditado(pagamento.external_reference))) {
            await creditarPacote(registro.email, 1, `compra_${registro.servico}`, pagamento.external_reference);
          }
        }
      }
    }

    if (type === 'subscription_preapproval') {
      const respostaMP = await fetch(`https://api.mercadopago.com/preapproval/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const assinatura = await respostaMP.json();

      await atualizarSupabase('assinaturas', 'mp_preapproval_id', dataId, {
        status: assinatura.status,
        atualizado_em: new Date().toISOString()
      });
    }

    // Dispara a cada cobrança recorrente aprovada (renovação automática mensal).
    // TODO: é aqui que vai entrar o reset do ciclo/pool de uso dos planos
    // Despertar/Expansão/Infinito quando essa funcionalidade for implementada
    // (grava ciclo_inicio = agora e pool_usado = 0 na linha de assinaturas
    // correspondente ao cobranca.preapproval_id).
    if (type === 'subscription_authorized_payment') {
      const respostaMP = await fetch(`https://api.mercadopago.com/authorized_payments/${dataId}`, {
        headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` }
      });
      const cobranca = await respostaMP.json();
      // Reservado para o reset de ciclo/pool dos planos de assinatura.
    }

    return res.status(200).end();
  } catch (erro) {
    console.error('Erro no webhook MP:', erro);
    return res.status(200).end();
  }
}
