import config from '../config/index.js';
import { UserModel, TripModel, ConversationModel } from '../models/index.js';
import { detectIntent, buildContext, getAIResponse, executeTools } from './ai.js';
import {
  sanitizeInput,
  redactPII,
  sanitizeOutput,
  sanitizeName,
  detectPromptInjection,
  auditLog,
} from '../middleware/security.js';

export async function handleMessage({ from, messageBody, profileName, participantPhone }) {
  const phone = (participantPhone || from).replace('whatsapp:', '');
  const chatId = from;

  if (config.security.allowedPhones.length > 0 && !config.security.allowedPhones.includes(phone)) {
    auditLog('UNAUTHORIZED_PHONE', { phone: phone.slice(-4) });
    return "Sorry, this number is not authorized to use this service.";
  }

  const safeName = sanitizeName(profileName);

  const { safe, sanitized, warnings: inputWarnings } = sanitizeInput(messageBody, {
    maxLength: config.security.maxMessageLength,
  });

  if (!safe) {
    auditLog('INVALID_INPUT', { phone: phone.slice(-4), reason: inputWarnings });
    return "I could not process that message. Please try rephrasing.";
  }

  if (inputWarnings.length > 0) {
    auditLog('INPUT_WARNING', { phone: phone.slice(-4), warnings: inputWarnings });
  }

  const { redacted: cleanMessage, detections: piiDetections } = redactPII(sanitized);

  if (piiDetections.length > 0) {
    auditLog('PII_IN_INPUT', {
      phone: phone.slice(-4),
      types: piiDetections.map((d) => d.label),
      count: piiDetections.length,
    });
  }

  const { isInjection, patterns } = detectPromptInjection(sanitized);

  if (isInjection) {
    auditLog('PROMPT_INJECTION', {
      phone: phone.slice(-4),
      patterns,
    });

    if (config.security.blockPromptInjection) {
      return 'I am your travel planning assistant. I can help with trip planning, itineraries, tasks, and recommendations.';
    }
  }

  const user = await UserModel.findOrCreate(phone, safeName);
  if (safeName && !user.displayName) {
    await UserModel.updateName(user.id, safeName);
    user.displayName = safeName;
  }

  const conversation = await ConversationModel.findOrCreateByChatId(chatId);

  let trip = await TripModel.findActiveForUser(user.id);
  if (trip && !conversation.tripId) {
    await ConversationModel.linkTrip(conversation.id, trip.id);
  }

  const intent = detectIntent(sanitized);
  const messageToStore = piiDetections.length > 0 ? cleanMessage : sanitized;

  await ConversationModel.addMessage(conversation.id, user.id, 'user', messageToStore, intent);

  const contextString = await buildContext(user, trip, conversation);

  let aiResponse;
  try {
    aiResponse = await getAIResponse(cleanMessage, contextString);
  } catch (error) {
    auditLog('AI_ERROR', { message: error.message.slice(0, 100) });
    aiResponse = 'Sorry, I am having trouble right now. Please try again in a moment.';
  }

  const { cleanResponse, results } = await executeTools(aiResponse, user, trip);

  if (!trip) {
    const tripResult = results.find((r) => r.success && r.action === 'create_trip');
    if (tripResult) {
      trip = tripResult.trip;
      await ConversationModel.linkTrip(conversation.id, trip.id);
    }
  }

  const safeResponse = sanitizeOutput(cleanResponse);

  const finalResponse = piiDetections.length > 0
    ? `Safety note: I noticed sensitive information in your message. I will not store or repeat it.\n\n${safeResponse}`
    : safeResponse;

  await ConversationModel.addMessage(conversation.id, null, 'assistant', safeResponse);

  const failedTools = results.filter((r) => !r.success);
  if (failedTools.length > 0) {
    console.warn('Some tool calls failed:', failedTools.map((f) => f.error));
  }

  auditLog('MESSAGE_PROCESSED', {
    phone: phone.slice(-4),
    intent,
    toolsExecuted: results.length,
    piiRedacted: piiDetections.length,
    injectionDetected: isInjection,
  });

  return finalResponse;
}
