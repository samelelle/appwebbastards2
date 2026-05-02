// /api/register-admin.js
// Minimal Express handler to send registration info to admin email (mmonthz@gmail.com)
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
// Configura Supabase client (usa variabili ambiente Vercel)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }
  console.log('Ricevuta richiesta di registrazione:', req.body);
  const { email, password, ruolo, cognome, nome, telefono, documento } = req.body || {};
  if (!email || !password || !ruolo || !cognome || !nome || !telefono || !documento) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
  }

  // Salva la richiesta in pending_registrations
  let pendingId = null;
  try {
    const { data, error } = await supabase
      .from('pending_registrations')
      .insert([
        { email, password, ruolo, cognome, nome, telefono, documento }
      ])
      .select('id')
      .single();
    if (error) {
      console.error('Errore salvataggio pending_registrations:', error);
      return res.status(500).json({ error: 'Errore salvataggio richiesta', details: error.message });
    }
    pendingId = data.id;
  } catch (err) {
    console.error('Errore salvataggio pending_registrations:', err);
    return res.status(500).json({ error: 'Errore salvataggio richiesta', details: err.message });
  }

  // Configure nodemailer (use your SMTP or a service like Gmail, Mailgun, etc.)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Link di approvazione (sostituisci con il tuo dominio reale)
  const approvalLink = `https://appwebbastards2-3g9t.vercel.app/admin/approva?id=${pendingId}`;
  const mailOptions = {
    from: 'noreply@webbastards.app',
    to: 'mmonthz@gmail.com',
    subject: 'Nuova richiesta di registrazione',
    text: `Nuova richiesta di registrazione:\n\nEmail: ${email}\nPassword: ${password}\nRuolo: ${ruolo}\nCognome: ${cognome}\nNome: ${nome}\nTelefono: ${telefono}\nNumero carta d'identità o patente: ${documento}\n\nApprova la registrazione:\n${approvalLink}\n`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Email inviata con successo a', mailOptions.to);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('Errore invio email:', err);
    return res.status(500).json({ error: 'Errore invio email', details: err.message });
  }
}
