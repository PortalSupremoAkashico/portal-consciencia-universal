// api/email.js — envio de e-mail via SMTP da Hostinger (nodemailer)
// Chamado pelo login.html no fluxo de recuperação de senha

import nodemailer from 'nodemailer';

export const config = { maxDuration: 30 };

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: 'contato@portaldaconscienciauniversal.com',
    pass: process.env.SMTP_PASSWORD
  }
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { to, subject, body } = req.body || {};
  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Campos obrigatórios: to, subject, body' });
  }
  if (!process.env.SMTP_PASSWORD) {
    return res.status(500).json({ error: 'SMTP_PASSWORD não configurada na Vercel.' });
  }

  try {
    await transporter.sendMail({
      from: '"Portal da Consciência Universal" <contato@portaldaconscienciauniversal.com>',
      to,
      subject,
      text: body
    });
    console.log('[email] enviado via SMTP Hostinger para:', to);
    return res.status(200).json({ success: true, message: 'E-mail enviado com sucesso!' });
  } catch (e) {
    console.error('[email] erro SMTP:', e.message);
    return res.status(500).json({ error: e.message });
  }
}
