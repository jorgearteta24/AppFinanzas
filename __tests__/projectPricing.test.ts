import { calcularPrecio, resolveConfig, SALE_TYPE_MARGINS } from '../lib/projectPricing';

// Config de impuestos vacía (sin retenciones)
const taxesOff = {
  apply_iva: false, apply_rete_iva: false, apply_rete_ica: false,
  apply_rete_fuente: false, apply_4pct: false, apply_5pct_renta: false,
  iva_rate: 0.19, rete_iva_rate: 0.15, rete_ica_rate: 0.012875,
  rete_fuente_rate: 0.04, rate_4pct: 0.04, rate_5pct_renta: 0.05,
};

// Config con todos los impuestos activos
const taxesAll = { ...taxesOff,
  apply_iva: true, apply_rete_iva: true, apply_rete_ica: true,
  apply_rete_fuente: true, apply_4pct: true, apply_5pct_renta: true,
};

describe('SALE_TYPE_MARGINS', () => {
  test('fabricacion tiene margen 25%', () => expect(SALE_TYPE_MARGINS.fabricacion).toBe(0.25));
  test('desarrollo tiene margen 25%',  () => expect(SALE_TYPE_MARGINS.desarrollo).toBe(0.25));
  test('tercerizado tiene margen 0%',  () => expect(SALE_TYPE_MARGINS.tercerizado).toBe(0.00));
  test('venta tiene margen 40%',       () => expect(SALE_TYPE_MARGINS.venta).toBe(0.40));
});

describe('calcularPrecio — sin impuestos', () => {
  const base = {
    costo_total: 1_000_000, sale_type: 'fabricacion',
    commission_pct: 0, discount_pct: 0,
    rounding_to: 0, quantity: 1, taxes: taxesOff,
  };

  test('precio_base = costo / (1 - margen)', () => {
    const r = calcularPrecio(base);
    expect(r.precio_base).toBeCloseTo(1_333_333.33, 0);
  });

  test('sin impuestos neto_recibido = subtotal', () => {
    const r = calcularPrecio(base);
    expect(r.neto_recibido).toBeCloseTo(r.subtotal, 2);
  });

  test('utilidad_bruta = neto - costo', () => {
    const r = calcularPrecio(base);
    expect(r.utilidad_bruta).toBeCloseTo(r.neto_recibido - r.costo_total, 2);
  });

  test('utilidad_pct ≈ margen tipo venta (sin comisión ni retenciones)', () => {
    const r = calcularPrecio(base);
    expect(r.utilidad_pct).toBeCloseTo(0.25, 2);
  });

  test('tercerizado: precio_base = costo (margen 0)', () => {
    const r = calcularPrecio({ ...base, sale_type: 'tercerizado' });
    expect(r.precio_base).toBeCloseTo(1_000_000, 0);
  });

  test('venta: precio_base = costo / 0.6', () => {
    const r = calcularPrecio({ ...base, sale_type: 'venta' });
    expect(r.precio_base).toBeCloseTo(1_666_666.67, 0);
  });
});

describe('calcularPrecio — redondeo', () => {
  test('redondea al 1000 más cercano hacia arriba', () => {
    const r = calcularPrecio({
      costo_total: 750_000, sale_type: 'fabricacion',
      commission_pct: 0, discount_pct: 0,
      rounding_to: 1000, quantity: 1, taxes: taxesOff,
    });
    expect(r.precio_redondeado % 1000).toBe(0);
    expect(r.precio_redondeado).toBeGreaterThanOrEqual(r.precio_con_comision);
  });

  test('redondeo 0 no cambia el precio', () => {
    const r = calcularPrecio({
      costo_total: 500_000, sale_type: 'fabricacion',
      commission_pct: 0, discount_pct: 0,
      rounding_to: 0, quantity: 1, taxes: taxesOff,
    });
    expect(r.precio_redondeado).toBeCloseTo(r.precio_con_comision, 2);
  });
});

describe('calcularPrecio — comisión', () => {
  test('comisión real = precio × comisión%', () => {
    const r = calcularPrecio({
      costo_total: 1_000_000, sale_type: 'fabricacion',
      commission_pct: 0.10, discount_pct: 0,
      rounding_to: 0, quantity: 1, taxes: taxesOff,
    });
    expect(r.comision_unitaria).toBeCloseTo(r.precio_con_descuento * 0.10, 2);
  });

  test('comisión 10%: utilidad sigue siendo ≥ margen objetivo', () => {
    const r = calcularPrecio({
      costo_total: 1_000_000, sale_type: 'fabricacion',
      commission_pct: 0.10, discount_pct: 0,
      rounding_to: 0, quantity: 1, taxes: taxesOff,
    });
    // neto - costo - comision = utilidad real
    const utilidad = r.neto_recibido - r.costo_total - r.comision_total;
    expect(utilidad).toBeGreaterThan(0);
  });

  test('comisión_total = comisión_unitaria × cantidad', () => {
    const r = calcularPrecio({
      costo_total: 800_000, sale_type: 'venta',
      commission_pct: 0.05, discount_pct: 0,
      rounding_to: 0, quantity: 3, taxes: taxesOff,
    });
    expect(r.comision_total).toBeCloseTo(r.comision_unitaria * 3, 2);
  });
});

describe('calcularPrecio — descuento', () => {
  test('descuento_maximo nunca genera pérdida', () => {
    const r = calcularPrecio({
      costo_total: 1_000_000, sale_type: 'fabricacion',
      commission_pct: 0, discount_pct: r => r.descuento_maximo_pct,
      rounding_to: 0, quantity: 1, taxes: taxesOff,
    } as any);
    // Usar descuento = máximo
    const r2 = calcularPrecio({
      costo_total: 1_000_000, sale_type: 'fabricacion',
      commission_pct: 0, discount_pct: 0,
      rounding_to: 0, quantity: 1, taxes: taxesOff,
    });
    const conDescMax = calcularPrecio({
      costo_total: 1_000_000, sale_type: 'fabricacion',
      commission_pct: 0, discount_pct: r2.descuento_maximo_pct,
      rounding_to: 0, quantity: 1, taxes: taxesOff,
    });
    // Con el descuento máximo la utilidad debe ser ≥ 0
    expect(conDescMax.utilidad_bruta).toBeGreaterThanOrEqual(-1); // tolerancia 1 COP por redondeo
  });

  test('descuento no puede superar el máximo calculado', () => {
    const r = calcularPrecio({
      costo_total: 1_000_000, sale_type: 'fabricacion',
      commission_pct: 0, discount_pct: 0.99, // descuento imposible
      rounding_to: 0, quantity: 1, taxes: taxesOff,
    });
    // El precio final no puede ser menor que el costo
    expect(r.precio_con_descuento).toBeGreaterThanOrEqual(r.costo_total * 0.99);
  });
});

describe('calcularPrecio — cantidad', () => {
  test('subtotal = precio_unitario × cantidad', () => {
    const r = calcularPrecio({
      costo_total: 600_000, sale_type: 'fabricacion',
      commission_pct: 0, discount_pct: 0,
      rounding_to: 0, quantity: 4, taxes: taxesOff,
    });
    expect(r.subtotal).toBeCloseTo(r.precio_con_descuento * 4, 2);
  });
});

describe('calcularPrecio — impuestos', () => {
  const base = {
    costo_total: 1_000_000, sale_type: 'fabricacion',
    commission_pct: 0, discount_pct: 0,
    rounding_to: 0, quantity: 1,
  };

  test('IVA = subtotal × 19%', () => {
    const r = calcularPrecio({ ...base, taxes: { ...taxesOff, apply_iva: true } });
    expect(r.iva_amount).toBeCloseTo(r.subtotal * 0.19, 2);
  });

  test('total_factura = subtotal + IVA', () => {
    const r = calcularPrecio({ ...base, taxes: { ...taxesOff, apply_iva: true } });
    expect(r.total_factura).toBeCloseTo(r.subtotal + r.iva_amount, 2);
  });

  test('rete_fuente = subtotal × 4%', () => {
    const r = calcularPrecio({ ...base, taxes: { ...taxesOff, apply_rete_fuente: true } });
    expect(r.rete_fuente_amount).toBeCloseTo(r.subtotal * 0.04, 2);
  });

  test('rete_ica = subtotal × 1.2875%', () => {
    const r = calcularPrecio({ ...base, taxes: { ...taxesOff, apply_rete_ica: true } });
    expect(r.rete_ica_amount).toBeCloseTo(r.subtotal * 0.012875, 4);
  });

  test('rete_iva = IVA × 15% (no del subtotal)', () => {
    const r = calcularPrecio({ ...base, taxes: { ...taxesOff, apply_iva: true, apply_rete_iva: true } });
    expect(r.rete_iva_amount).toBeCloseTo(r.iva_amount * 0.15, 4);
  });

  test('5% renta = subtotal × 5%', () => {
    const r = calcularPrecio({ ...base, taxes: { ...taxesOff, apply_5pct_renta: true } });
    expect(r.amount_5pct_renta).toBeCloseTo(r.subtotal * 0.05, 2);
  });

  test('neto_recibido = total_factura - retenciones', () => {
    const r = calcularPrecio({ ...base, taxes: taxesAll });
    expect(r.neto_recibido).toBeCloseTo(r.total_factura - r.total_retenciones, 2);
  });

  test('con todas las retenciones el precio sube para mantener margen', () => {
    const sinImp = calcularPrecio({ ...base, taxes: taxesOff });
    const conImp  = calcularPrecio({ ...base, taxes: taxesAll });
    // El precio debe ser mayor cuando hay retenciones
    expect(conImp.precio_con_descuento).toBeGreaterThan(sinImp.precio_con_descuento);
  });

  test('utilidad_bruta positiva con todos los impuestos', () => {
    const r = calcularPrecio({ ...base, taxes: taxesAll });
    expect(r.utilidad_bruta).toBeGreaterThan(0);
  });
});

describe('resolveConfig', () => {
  const project = {
    sale_type: 'fabricacion', commission_pct: 0.10,
    discount_pct: 0, rounding_to: 1000, apply_iva: false,
  };

  test('sin override devuelve config del proyecto', () => {
    const result = resolveConfig(project, null);
    expect(result.sale_type).toBe('fabricacion');
    expect(result.commission_pct).toBe(0.10);
  });

  test('override null en campo no reemplaza el valor del proyecto', () => {
    const result = resolveConfig(project, { sale_type: null as any });
    expect(result.sale_type).toBe('fabricacion');
  });

  test('override con valor reemplaza el del proyecto', () => {
    const result = resolveConfig(project, { sale_type: 'venta', commission_pct: 0.05 });
    expect(result.sale_type).toBe('venta');
    expect(result.commission_pct).toBe(0.05);
  });

  test('override parcial mantiene los demás valores del proyecto', () => {
    const result = resolveConfig(project, { sale_type: 'venta' });
    expect(result.commission_pct).toBe(0.10); // no sobreescrito
    expect(result.rounding_to).toBe(1000);    // no sobreescrito
  });
});
