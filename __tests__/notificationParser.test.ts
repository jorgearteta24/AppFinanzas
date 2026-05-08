import {
  parseNotification,
  parseAmountString,
  isLikelyBankNotification,
  getBankName,
} from '../lib/notificationParser';

// ── parseAmountString ─────────────────────────────────────────────────────────

describe('parseAmountString — formatos colombianos', () => {
  const cases: [string, number][] = [
    // Formato europeo (punto=miles, coma=decimal)
    ['9.999,00',        9999],
    ['9.999,01',        9999.01],
    ['1.500,75',        1500.75],
    ['250.000,00',      250000],
    ['9.999.999,00',    9999999],
    ['250.000,01',      250000.01],

    // Formato americano (coma=miles, punto=decimal)
    ['9,999.00',        9999],
    ['9,999.09',        9999.09],
    ['1,500.75',        1500.75],
    ['9,999,999.00',    9999999],
    ['250,000.99',      250000.99],

    // Solo miles sin decimal
    ['9.999',           9999],
    ['19.000',          19000],
    ['250.000',         250000],
    ['9,999',           9999],

    // Decimal sin miles
    ['9999,00',         9999],
    ['9999.00',         9999],
    ['9999,01',         9999.01],
    ['9999.09',         9999.09],
    ['9,01',            9.01],
    ['9.09',            9.09],

    // Sin separadores
    ['9999',            9999],
    ['45000',           45000],

    // Millones
    ['4.000.000',       4000000],
    ['4.000.000,00',    4000000],
  ];

  test.each(cases)('parseAmountString("%s") → %d', (input, expected) => {
    const result = parseAmountString(input);
    expect(result).toBeCloseTo(expected, 1);
  });

  test('retorna undefined para string vacío', () => {
    expect(parseAmountString('')).toBeUndefined();
  });

  test('retorna undefined para texto sin dígitos', () => {
    expect(parseAmountString('abc')).toBeUndefined();
  });

  test('retorna undefined para valor 0', () => {
    expect(parseAmountString('0')).toBeUndefined();
  });
});

// ── parseNotification ─────────────────────────────────────────────────────────

describe('parseNotification — extracción de monto', () => {
  test('detecta monto con $ y formato europeo', () => {
    const r = parseNotification('Bancolombia', 'Compra aprobada por $45.000 en EXITO');
    expect(r.amount).toBe(45000);
  });

  test('detecta monto con formato americano', () => {
    const r = parseNotification('Nequi', 'Pago exitoso por $9,999.00');
    expect(r.amount).toBe(9999);
  });

  test('detecta monto con palabra "por"', () => {
    const r = parseNotification('BBVA', 'Transferencia por $1.200.000 realizada');
    expect(r.amount).toBe(1200000);
  });

  test('detecta monto con COP', () => {
    const r = parseNotification('Davivienda', 'Débito de 250.000 COP');
    expect(r.amount).toBe(250000);
  });

  test('monto undefined si no hay cifra', () => {
    const r = parseNotification('Banco', 'Su sesión ha sido iniciada exitosamente');
    expect(r.amount).toBeUndefined();
  });

  test('detecta monto con coma decimal real ($9.999,01)', () => {
    const r = parseNotification('Bancolombia', 'Compra $9.999,01 en RAPPI');
    expect(r.amount).toBeCloseTo(9999.01, 1);
  });
});

describe('parseNotification — tipo de transacción', () => {
  test('detecta "compra" como gasto', () => {
    const r = parseNotification('Banco', 'Compra aprobada por $50.000');
    expect(r.suggestedType).toBe('expense');
  });

  test('detecta "depósito" como ingreso', () => {
    const r = parseNotification('Banco', 'Depósito recibido por $1.000.000');
    expect(r.suggestedType).toBe('income');
  });

  test('detecta "transferencia recibida" como ingreso', () => {
    const r = parseNotification('Nequi', 'Transferencia recibida por $200.000');
    expect(r.suggestedType).toBe('income');
  });

  test('detecta "retiro" como gasto', () => {
    const r = parseNotification('Banco', 'Retiro por $100.000 en cajero ATM');
    expect(r.suggestedType).toBe('expense');
  });

  test('detecta "cuota de manejo" como bank_fee', () => {
    const r = parseNotification('Banco', 'Cuota de manejo $15.900 debitada');
    expect(r.suggestedType).toBe('bank_fee');
  });

  test('detecta "transferencia enviada" como transfer', () => {
    const r = parseNotification('Bancolombia', 'Transferencia enviada por $500.000');
    expect(r.suggestedType).toBe('transfer');
  });
});

describe('parseNotification — score de confianza', () => {
  test('mensaje con monto+tipo tiene confianza > 0.5', () => {
    const r = parseNotification('Bancolombia', 'Compra aprobada por $45.000 en EXITO');
    expect(r.confidenceScore).toBeGreaterThan(0.5);
  });

  test('mensaje sin monto tiene confianza baja', () => {
    const r = parseNotification('Banco', 'Hola, su clave fue cambiada exitosamente');
    expect(r.confidenceScore).toBeLessThan(0.5);
  });

  test('confidenceScore entre 0 y 1', () => {
    const r = parseNotification('Bancolombia', 'Compra aprobada por $9.999,99 en NETFLIX. Tarjeta *4321 Ref: ABC123');
    expect(r.confidenceScore).toBeGreaterThanOrEqual(0);
    expect(r.confidenceScore).toBeLessThanOrEqual(1);
  });
});

describe('parseNotification — referencia y tarjeta', () => {
  test('extrae referencia con "Ref:"', () => {
    const r = parseNotification('BBVA', 'Pago $80.000. Ref: TXN20240501');
    expect(r.reference).toBeTruthy();
  });

  test('extrae últimos 4 dígitos de tarjeta con *', () => {
    const r = parseNotification('Bancolombia', 'Compra $30.000 tarjeta *5678');
    expect(r.accountLastDigits).toBe('5678');
  });

  test('extrae dígitos con "terminada en"', () => {
    const r = parseNotification('Davivienda', 'Pago $200.000 tarjeta terminada en 1234');
    expect(r.accountLastDigits).toBe('1234');
  });
});

// ── isLikelyBankNotification ──────────────────────────────────────────────────

describe('isLikelyBankNotification', () => {
  test('true para mensaje con monto + keyword bancario', () => {
    expect(isLikelyBankNotification(
      'desconocido',
      'Banco',
      'Compra aprobada por $45.000 en tienda'
    )).toBe(true);
  });

  test('true para paquete conocido de Bancolombia', () => {
    expect(isLikelyBankNotification(
      'co.com.bancolombia.movil',
      'Bancolombia',
      'Cualquier mensaje'
    )).toBe(true);
  });

  test('true para paquete Nequi', () => {
    expect(isLikelyBankNotification(
      'com.nequi.app',
      'Nequi',
      'Mensaje sin monto'
    )).toBe(true);
  });

  test('false para mensaje sin monto ni keywords', () => {
    expect(isLikelyBankNotification(
      'com.whatsapp',
      'WhatsApp',
      'Hola, ¿cómo estás?'
    )).toBe(false);
  });

  test('false para mensaje de marketing sin transacción', () => {
    expect(isLikelyBankNotification(
      'com.instagram',
      'Instagram',
      'Tu publicación fue vista por 100 personas'
    )).toBe(false);
  });
});

// ── getBankName ───────────────────────────────────────────────────────────────

describe('getBankName', () => {
  test('reconoce Bancolombia', () => {
    expect(getBankName('co.com.bancolombia')).toBe('Bancolombia');
  });

  test('reconoce Nequi', () => {
    expect(getBankName('com.nequi.app')).toBe('Nequi');
  });

  test('reconoce Davivienda', () => {
    expect(getBankName('com.davivienda.clientes')).toBe('Davivienda');
  });

  test('retorna "Banco" para paquete desconocido', () => {
    expect(getBankName('com.desconocido.app')).toBe('Banco');
  });
});
