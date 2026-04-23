const SENSITIVE_PATTERNS = [
  {
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    label: 'credit_card',
    replacement: '[CARD REMOVED]',
  },
  {
    regex: /\b\d{4}[\s-]\d{4}[\s-]\d{4}[\s-]\d{4}\b/g,
    label: 'credit_card_formatted',
    replacement: '[CARD REMOVED]',
  },
  {
    regex: /\b(?:cvv|cvc|security\s*code|csv)\s*[:=]?\s*\d{3,4}\b/gi,
    label: 'cvv',
    replacement: '[CVV REMOVED]',
  },
  {
    regex: /\b\d{3}-?\d{2}-?\d{4}\b/g,
    label: 'ssn',
    replacement: '[SSN REMOVED]',
    validate: (match) => {
      const digits = match.replace(/\D/g, '');
      if (digits.startsWith('9') || digits.startsWith('000')) return false;
      if (digits.slice(3, 5) === '00') return false;
      if (Number.parseInt(digits.slice(0, 3), 10) > 899) return false;
      return true;
    },
  },
  {
    regex: /\b(?:passport\s*(?:no|number|#|num)?)\s*[:=]?\s*[A-Z0-9]{6,12}\b/gi,
    label: 'passport',
    replacement: '[PASSPORT REMOVED]',
  },
  {
    regex: /\b(?:account|routing|iban|swift|bic)\s*(?:no|number|#|num)?\s*[:=]?\s*[A-Z0-9]{8,34}\b/gi,
    label: 'bank_account',
    replacement: '[BANK INFO REMOVED]',
  },
  {
    regex: /\b[A-Z]{2}\d{2}\s?[A-Z0-9]{4}\s?(?:\d{4}\s?){2,7}\d{1,4}\b/g,
    label: 'iban',
    replacement: '[IBAN REMOVED]',
  },
  {
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z|a-z]{2,}\b/g,
    label: 'email',
    replacement: '[EMAIL REMOVED]',
  },
  {
    regex: /\b(?:password|passwd|pwd|pin)\s*[:=]\s*\S+/gi,
    label: 'password',
    replacement: '[PASSWORD REMOVED]',
  },
  {
    regex: /\b(?:sk|pk|api[_-]?key|token|bearer)\s*[:=]?\s*[A-Za-z0-9_\-]{20,}\b/gi,
    label: 'api_key',
    replacement: '[API KEY REMOVED]',
  },
];

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(all\s+)?your\s+(rules|instructions|guidelines)/i,
  /you\s+are\s+now\s+(a|an)\s+(?!travel)/i,
  /\bsystem\s*:\s*/i,
  /\bassistant\s*:\s*/i,
  /pretend\s+(you|to)\s+(are|be)\s+(?!excited|happy)/i,
  /reveal\s+(your|the)\s+(system|secret|internal|prompt)/i,
  /output\s+(your|the)\s+(system|original|full)\s+(prompt|instructions)/i,
  /what\s+(are|is)\s+your\s+(system\s+)?prompt/i,
  /bypass\s+(your|the|all)\s+(safety|security|filter|restriction)/i,
  /\bDAN\b/,
  /jailbreak/i,
  /act\s+as\s+(?!a\s*travel|my\s*travel|our\s*travel)/i,
];

const AUDIT_BUFFER = [];
const MAX_BUFFER = 500;

export function sanitizeInput(message, { maxLength = 2000 } = {}) {
  const warnings = [];

  if (!message || typeof message !== 'string') {
    return { safe: false, sanitized: '', warnings: ['Empty or non-string input'] };
  }

  let text = message.trim();

  if (text.length > maxLength) {
    text = text.slice(0, maxLength);
    warnings.push(`Message truncated from ${message.length} to ${maxLength} characters`);
  }

  if (text.length < 1) {
    return { safe: false, sanitized: '', warnings: ['Message too short'] };
  }

  text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  if (INJECTION_PATTERNS.some((p) => p.test(text))) {
    warnings.push('PROMPT_INJECTION_ATTEMPT');
  }

  return { safe: true, sanitized: text, warnings };
}

export function redactPII(text) {
  if (!text || typeof text !== 'string') return { redacted: text, detections: [] };

  const detections = [];
  let redacted = text;

  for (const pattern of SENSITIVE_PATTERNS) {
    const matches = [...redacted.matchAll(pattern.regex)];

    for (const match of matches) {
      if (pattern.validate && !pattern.validate(match[0])) continue;

      detections.push({
        label: pattern.label,
        position: match.index,
        hint: match[0].length > 4 ? `${match[0].slice(0, 2)}...${match[0].slice(-2)}` : '****',
      });
    }

    if (pattern.validate) {
      redacted = redacted.replace(pattern.regex, (value) => (pattern.validate(value) ? pattern.replacement : value));
    } else {
      redacted = redacted.replace(pattern.regex, pattern.replacement);
    }
  }

  return { redacted, detections };
}

export function sanitizeOutput(response) {
  if (!response || typeof response !== 'string') return response;

  const { redacted, detections } = redactPII(response);

  const cleaned = redacted
    .replace(/---\s*CURRENT CONTEXT\s*---[\s\S]*/gi, '')
    .replace(/---\s*ACTIVE TRIP\s*---/gi, '')
    .replace(/---\s*RECENT CONVERSATION\s*---/gi, '')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g, '[ID]')
    .replace(/(?:whatsapp:)?\+\d{10,15}/g, '[PHONE]')
    .replace(/\s{3,}/g, '  ')
    .trim();

  if (detections.length > 0) {
    auditLog('PII_IN_OUTPUT', { labels: detections.map((d) => d.label), count: detections.length });
  }

  return cleaned;
}

export function sanitizeName(name) {
  if (!name || typeof name !== 'string') return null;
  return name
    .slice(0, 100)
    .replace(/[\x00-\x1F\x7F]/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/[{}[\]]/g, '')
    .trim() || null;
}

export function detectPromptInjection(text) {
  if (!text) return { isInjection: false, patterns: [] };
  const patterns = INJECTION_PATTERNS.filter((p) => p.test(text)).map((p) => p.source.slice(0, 40));
  return { isInjection: patterns.length > 0, patterns };
}

export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.removeHeader('X-Powered-By');
  next();
}

export function auditLog(event, details = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    ...details,
  };

  AUDIT_BUFFER.push(entry);
  if (AUDIT_BUFFER.length > MAX_BUFFER) {
    AUDIT_BUFFER.splice(0, AUDIT_BUFFER.length - MAX_BUFFER);
  }

  const critical = ['PROMPT_INJECTION', 'PII_IN_INPUT', 'PII_IN_OUTPUT', 'AUTH_FAILURE', 'RATE_LIMIT'];
  if (critical.includes(event)) {
    console.warn(`[AUDIT] ${event}`, JSON.stringify(details));
  }
}

export function getAuditLog(limit = 50) {
  return AUDIT_BUFFER.slice(-limit);
}
