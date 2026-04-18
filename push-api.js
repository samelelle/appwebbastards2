import express from 'express';
import 'dotenv/config';
import { exec } from 'child_process';

const app = express();
app.use(express.json());

app.post('/send-push', (req, res) => {
  const { title, body, url } = req.body;
  if (!title || !body) {
    return res.status(400).json({ error: 'title e body sono obbligatori' });
  }
  // Costruisci il comando per lanciare lo script
  const cmd = `node send-push.cjs "${title.replace(/"/g, '')}" "${body.replace(/"/g, '')}" "${url ? url.replace(/"/g, '') : ''}"`;
  exec(cmd, (error, stdout, stderr) => {
    if (error) {
      console.error('Errore exec:', error);
      return res.status(500).json({ error: 'Errore invio push', details: stderr });
    }
    res.json({ success: true, output: stdout });
  });
});

const PORT = process.env.PUSH_API_PORT || 3001;
app.listen(PORT, () => {
  console.log(`Push API server in ascolto su http://localhost:${PORT}`);
});
