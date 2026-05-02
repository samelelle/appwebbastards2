// API Vercel: invia email a mmonthz@gmail.com con i dati della registrazione
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { nome, cognome, telefono, email, documento, ruolo, categorie } = req.body || {};
  if (!nome || !telefono || !documento) return res.status(400).json({ error: 'Missing required fields' });

  // Configura qui la tua SMTP oppure usa un provider (es. Gmail App Password, SendGrid, ecc)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const html = `
    <h2>Nuova richiesta di registrazione</h2>
    <ul>
      <li><b>Nome:</b> ${nome}</li>
      <li><b>Cognome:</b> ${cognome}</li>
      <li><b>Telefono:</b> ${telefono}</li>
      <li><b>Email:</b> ${email}</li>
      <li><b>Ruolo:</b> ${ruolo}</li>
      <li><b>Categorie:</b> ${Array.isArray(categorie) ? categorie.join(', ') : categorie}</li>
      <li><b>Documento:</b> ${documento}</li>
    </ul>
    <p>Per accettare o rifiutare, accedi al pannello Supabase oppure rispondi a questa email.</p>
  `;

  try {
    await transporter.sendMail({
      from: 'noreply@webbastards.it',
      to: 'mmonthz@gmail.com',
      subject: 'Nuova richiesta di registrazione',
      html,
    });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: 'Errore invio email', details: e.message });
  }
}