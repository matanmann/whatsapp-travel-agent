import twilio from 'twilio';
import config from '../config/index.js';

let client = null;

function getClient() {
  if (!client && config.twilio.accountSid && config.twilio.authToken) {
    client = twilio(config.twilio.accountSid, config.twilio.authToken);
  }
  return client;
}

function splitMessage(text, maxLen = 1500) {
  if (text.length <= maxLen) return [text];

  const chunks = [];
  let remaining = text;

  while (remaining.length > maxLen) {
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = remaining.lastIndexOf('. ', maxLen);
    if (splitAt < maxLen * 0.5) splitAt = maxLen;

    chunks.push(remaining.slice(0, splitAt + 1).trim());
    remaining = remaining.slice(splitAt + 1).trim();
  }

  if (remaining) chunks.push(remaining);
  return chunks;
}

export async function sendWhatsAppMessage(to, body) {
  const twilioClient = getClient();

  if (!twilioClient) {
    console.log(`[DEV MODE] Would send to ${to}:\n${body}`);
    return [{ sid: 'dev-mode', status: 'dev' }];
  }

  const chunks = splitMessage(body, 1500);
  const results = [];

  for (const chunk of chunks) {
    const message = await twilioClient.messages.create({
      from: config.twilio.whatsappNumber,
      to,
      body: chunk,
    });
    results.push(message);
  }

  return results;
}

export async function sendWithButtons(to, body, buttons) {
  const buttonText = buttons.map((b, i) => `${i + 1}. ${b}`).join('\n');
  const fullMessage = `${body}\n\n${buttonText}\n\nReply with a number to choose.`;
  return sendWhatsAppMessage(to, fullMessage);
}

export async function sendReminder(to, taskTitle, tripName, dueDate) {
  const message = [
    '*Reminder*',
    '',
    `Task: *${taskTitle}*`,
    tripName ? `Trip: ${tripName}` : '',
    dueDate ? `Due: ${dueDate}` : '',
    '',
    `Reply \"done ${taskTitle}\" to mark it complete.`,
  ].filter(Boolean).join('\n');

  return sendWhatsAppMessage(to, message);
}

export function validateTwilioSignature(req) {
  if (config.nodeEnv === 'development') return true;

  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature) return false;

  const url = `${config.baseUrl}${req.originalUrl}`;
  return twilio.validateRequest(config.twilio.authToken, twilioSignature, url, req.body);
}

export function parseIncomingMessage(body) {
  return {
    from: body.From,
    to: body.To,
    messageBody: body.Body || '',
    messageSid: body.MessageSid,
    numMedia: Number.parseInt(body.NumMedia || '0', 10),
    profileName: body.ProfileName || null,
    isGroup: body.From?.includes('@g.us') || false,
    participantPhone: body.Author || body.From,
  };
}
