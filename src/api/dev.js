import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleMessage } from '../services/messageHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

router.get('/simulate', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', '..', 'public', 'index.html'));
});

router.post('/simulate', async (req, res) => {
  const { from, body, profileName } = req.body;

  if (!body) {
    return res.status(400).json({ error: 'body is required' });
  }

  const incoming = {
    from: from || 'whatsapp:+15550000001',
    participantPhone: from || 'whatsapp:+15550000001',
    messageBody: body,
    profileName: profileName || 'Dev User',
  };

  try {
    const response = await handleMessage(incoming);
    return res.json({ ok: true, response });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

export default router;
