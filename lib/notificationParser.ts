import type { TransactionType } from './types';

export interface ParsedNotification {
  amount?: number;
  description?: string;
  reference?: string;
  accountLastDigits?: string;
  suggestedType?: TransactionType;
  confidenceScore: number;
}

const AMOUNT_PATTERNS = [
  /\$\s?([\d,]+\.?\d*)/g,
  /por\s+\$?([\d,]+\.?\d*)/gi,
  /de\s+\$?([\d,]+\.?\d*)/gi,
  /([\d,]+\.?\d*)\s*COP/gi,
];

const CARD_PATTERNS = [
  /terminad[ao]\s+en\s+(\d{4})/gi,
  /tarjeta\s+\*+(\d{4})/gi,
  /\*+(\d{4})/g,
];

const REFERENCE_PATTERNS = [
  /ref[.:]?\s*(\w+)/gi,
  /referencia[:]?\s*(\w+)/gi,
  /código[:]?\s*(\w+)/gi,
  /No[.]?\s*(\d+)/g,
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

function extractAmount(text: string): number | undefined {
  for (const pattern of AMOUNT_PATTERNS) {
    const matches = Array.from(text.matchAll(pattern));
    if (matches.length > 0) {
      const amountStr = matches[0][1].replace(/,/g, '');
      const amount = parseFloat(amountStr);
      if (!isNaN(amount) && amount > 0) {
        return amount;
      }
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
