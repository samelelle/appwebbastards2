// /api/register-admin.js
// Minimal Express handler to send registration info to admin email (mmonthz@gmail.com)
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Solo POST' });
  }
  const { email, password, ruolo, cognome, nome, telefono, documento } = req.body || {};
  if (!email || !password || !ruolo || !cognome || !nome || !telefono || !documento) {
    return res.status(400).json({ error: 'Tutti i campi sono obbligatori.' });
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

  const mailOptions = {
    from: 'noreply@webbastards.app',
    to: 'mmonthz@gmail.com',
    subject: 'Nuova richiesta di registrazione',
    text: `Nuova richiesta di registrazione:\n\nEmail: ${email}\nPassword: ${password}\nRuolo: ${ruolo}\nCognome: ${cognome}\nNome: ${nome}\nTelefono: ${telefono}\nNumero carta d'identità o patente: ${documento}\n`,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Errore invio email', details: err.message });
  }
}
