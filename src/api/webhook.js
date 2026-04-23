import express from 'express';
import twilio from 'twilio';
import { validateTwilioSignature, parseIncomingMessage, sendWhatsAppMessage } from '../services/whatsapp.js';
import { handleMessage } from '../services/messageHandler.js';

const { twiml } = twilio;

const router = express.Router();

router.get('/whatsapp', (_req, res) => {
  res.json({ ok: true, service: 'whatsapp-webhook' });
});

router.post('/whatsapp', async (req, res) => {
  if (!validateTwilioSignature(req)) {
    return res.status(403).json({ error: 'Invalid Twilio signature' });
  }

  const incoming = parseIncomingMessage(req.body);

  try {
    const responseText = await handleMessage(incoming);
    await sendWhatsAppMessage(incoming.participantPhone || incoming.from, responseText);

    const response = new twiml.MessagingResponse();
    return res.type('text/xml').send(response.toString());
  } catch (error) {
    console.error('Webhook error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
