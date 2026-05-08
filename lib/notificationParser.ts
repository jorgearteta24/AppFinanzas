import type { TransactionType } from './types';

export interface ParsedNotification {
  amount?: number;
  description?: string;
  reference?: string;
  accountLastDigits?: string;
  suggestedType?: TransactionType;
  confidenceScore: number;
}

// Captura secuencias de dígitos con puntos y/o comas como separadores
const AMOUNT_PATTERNS = [
  /\$\s?([\d.,]+)/g,
  /por\s+\$?([\d.,]+)/gi,
  /de\s+\$?([\d.,]+)/gi,
  /([\d.,]+)\s*COP/gi,
  /valor[:\s]+\$?\s*([\d.,]+)/gi,
  /monto[:\s]+\$?\s*([\d.,]+)/gi,
];

const CARD_PATTERNS = [
  /terminad[ao]\s+en\s+(\d{4})/i,
  /tarjeta\s+\*+(\d{4})/i,
  /\*+(\d{4})/,
];

// Sin flag 'g': .exec() con 'g' mantiene lastIndex entre llamadas (bug)
const REFERENCE_PATTERNS = [
  /ref[.:]?\s*(\w+)/i,
  /referencia[:]?\s*(\w+)/i,
  /código[:]?\s*(\w+)/i,
  /No[.]?\s*(\d+)/,
];

const TRANSACTION_KEYWORDS: { [key: string]: { type: TransactionType; keywords: string[] } } = {
  expense: {
    type: 'expense',
    keywords: [
      'compra', 'pago', 'débito', 'retiro', 'cajero', 'atm',
      'débito automático', 'cargo', 'comprado', 'pagado',
    ],
  },
  income: {
    type: 'income',
    keywords: [
      'recibido', 'depósito', 'abono', 'consignación', 'transferencia recibida',
      'ingreso', 'acreditado', 'crédito',
    ],
  },
  transfer: {
    type: 'transfer',
    keywords: [
      'transferencia enviada', 'enviado', 'transferido', 'envío',
    ],
  },
  bank_fee: {
    type: 'bank_fee',
    keywords: [
      'cuota de manejo', 'comisión', 'gmf', 'gravamen', 'tarifa',
    ],
  },
};

const MERCHANT_PATTERNS: { [key: string]: string } = {
  'exito': 'EXITO',
  'olimpica': 'OLIMPICA',
  'carulla': 'CARULLA',
  'netflix': 'NETFLIX',
  'spotify': 'SPOTIFY',
  'uber': 'UBER',
  'rappi': 'RAPPI',
  'didi': 'DIDI',
};

export function parseNotification(title: string, body: string): ParsedNotification {
  const fullText = `${title} ${body}`.toLowerCase();
  let confidenceScore = 0.3;

  const amount = extractAmount(fullText);
  if (amount) confidenceScore += 0.3;

  const description = extractDescription(title, body);
  if (description) confidenceScore += 0.1;

  const reference = extractReference(fullText);
  if (reference) confidenceScore += 0.1;

  const accountLastDigits = extractCardDigits(fullText);
  if (accountLastDigits) confidenceScore += 0.1;

  const suggestedType = detectTransactionType(fullText);
  if (suggestedType) confidenceScore += 0.1;

  return {
    amount,
    description,
    reference,
    accountLastDigits,
    suggestedType,
    confidenceScore: Math.min(1.0, confidenceScore),
  };
}

export function parseAmountString(raw: string): number | undefined {
  const s = raw.trim();
  if (!s || !/\d/.test(s)) return undefined;

  const dots   = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;

  let normalized: string;

  if (dots > 0 && commas > 0) {
    // Ambos separadores presentes → el último es el decimal
    const lastDot   = s.lastIndexOf('.');
    const lastComma = s.lastIndexOf(',');
    if (lastComma > lastDot) {
      // Formato europeo: 9.999,00 → punto=miles, coma=decimal
      normalized = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano: 9,999.00 → coma=miles, punto=decimal
      normalized = s.replace(/,/g, '');
    }
  } else if (dots > 1) {
    // Múltiples puntos → todos son miles: 9.999.999
    normalized = s.replace(/\./g, '');
  } else if (commas > 1) {
    // Múltiples comas → todas son miles: 9,999,999
    normalized = s.replace(/,/g, '');
  } else if (dots === 1 && commas === 0) {
    const afterDot = s.split('.')[1] ?? '';
    if (afterDot.length === 3) {
      // Punto como miles: 9.999 → 9999
      normalized = s.replace('.', '');
    } else {
      // Punto como decimal: 9999.50
      normalized = s;
    }
  } else if (commas === 1 && dots === 0) {
    const afterComma = s.split(',')[1] ?? '';
    if (afterComma.length === 3) {
      // Coma como miles: 9,999 → 9999
      normalized = s.replace(',', '');
    } else {
      // Coma como decimal: 9999,50
      normalized = s.replace(',', '.');
    }
  } else {
    // Sin separadores: 9999
    normalized = s;
  }

  const amount = parseFloat(normalized);
  return isNaN(amount) || amount <= 0 ? undefined : amount;
}

function extractAmount(text: string): number | undefined {
  for (const pattern of AMOUNT_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      const amount = parseAmountString(matches[0][1]);
      if (amount !== undefined) return amount;
    }
  }
  return undefined;
}

function extractDescription(title: string, body: string): string | undefined {
  const fullText = `${title} ${body}`;

  for (const [pattern, merchantName] of Object.entries(MERCHANT_PATTERNS)) {
    if (fullText.toLowerCase().includes(pattern)) {
      const context = extractContextAround(fullText, pattern);
      return context || merchantName;
    }
  }

  const words = fullText.split(/\s+/);
  const meaningfulWords = words.filter(
    word =>
      word.length > 3 &&
      !word.match(/^\d+$/) &&
      !word.match(/^[$,.]/)
  );

  if (meaningfulWords.length > 0) {
    return meaningfulWords.slice(0, 5).join(' ').substring(0, 100);
  }

  return title.substring(0, 100);
}

function extractContextAround(text: string, keyword: string, wordsAround: number = 3): string {
  const lowerText = text.toLowerCase();
  const index = lowerText.indexOf(keyword.toLowerCase());

  if (index === -1) return '';

  const words = text.split(/\s+/);
  const keywordIndex = text.substring(0, index).split(/\s+/).length - 1;

  const start = Math.max(0, keywordIndex - wordsAround);
  const end = Math.min(words.length, keywordIndex + wordsAround + 1);

  return words.slice(start, end).join(' ');
}

function extractReference(text: string): string | undefined {
  for (const pattern of REFERENCE_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1].toUpperCase();
    }
  }
  return undefined;
}

function extractCardDigits(text: string): string | undefined {
  for (const pattern of CARD_PATTERNS) {
    const match = pattern.exec(text);
    if (match && match[1]) {
      return match[1];
    }
  }
  return undefined;
}

function detectTransactionType(text: string): TransactionType | undefined {
  const lowerText = text.toLowerCase();

  for (const [, config] of Object.entries(TRANSACTION_KEYWORDS)) {
    for (const keyword of config.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        return config.type;
      }
    }
  }

  if (lowerText.includes('aprobad') || lowerText.includes('exitoso')) {
    return 'expense';
  }

  return undefined;
}

export function isLikelyBankNotification(appPackage: string, title: string, body: string): boolean {
  const knownBankPackages = [
    'com.bancolombia',
    'com.nequi',
    'com.movii',
    'co.com.bancolombia',
    'com.bbva',
    'com.davivienda',
    'com.scotiabank',
    'com.colpatria',
    'com.occidente',
    'com.popular',
    'com.av.villas',
    'com.caja.social',
    'com.bancoomeva',
    'com.banco.bogota',
  ];

  if (knownBankPackages.some(pkg => appPackage.toLowerCase().includes(pkg))) {
    return true;
  }

  const fullText = `${title} ${body}`.toLowerCase();

  const bankKeywords = [
    'compra', 'pago', 'transferencia', 'depósito', 'retiro',
    'débito', 'crédito', 'abono', 'consignación', 'tarjeta',
    'cuenta', 'saldo', 'transacción', 'cajero', 'atm',
  ];

  const hasAmount = AMOUNT_PATTERNS.some(pattern => pattern.test(fullText));
  const hasBankKeyword = bankKeywords.some(keyword => fullText.includes(keyword));

  return hasAmount && hasBankKeyword;
}

export function getBankName(appPackage: string): string {
  const bankNames: { [key: string]: string } = {
    'bancolombia': 'Bancolombia',
    'nequi': 'Nequi',
    'movii': 'Movii',
    'bbva': 'BBVA',
    'davivienda': 'Davivienda',
    'scotiabank': 'Scotiabank Colpatria',
    'colpatria': 'Scotiabank Colpatria',
    'occidente': 'Banco de Occidente',
    'popular': 'Banco Popular',
    'av.villas': 'AV Villas',
    'caja.social': 'Caja Social',
    'bancoomeva': 'Bancoomeva',
    'banco.bogota': 'Banco de Bogotá',
  };

  const lowerPackage = appPackage.toLowerCase();

  for (const [key, name] of Object.entries(bankNames)) {
    if (lowerPackage.includes(key)) {
      return name;
    }
  }

  return 'Banco';
}
