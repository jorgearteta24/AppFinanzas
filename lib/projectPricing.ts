// Márgenes por tipo de venta (% del precio de venta)
export const SALE_TYPE_MARGINS: Record<string, number> = {
  fabricacion: 0.25,
  desarrollo:  0.25,
  tercerizado: 0.00,
  venta:       0.40,
};

export const SALE_TYPE_LABELS: Record<string, string> = {
  fabricacion: 'Fabricación (25%)',
  desarrollo:  'Desarrollo (25%)',
  tercerizado: 'Tercerizado (0%)',
  venta:       'Venta (40%)',
};

export interface ProjectTaxConfig {
  apply_iva:         boolean;
  apply_rete_iva:    boolean;
  apply_rete_ica:    boolean;
  apply_rete_fuente: boolean;
  apply_4pct:        boolean;
  apply_5pct_renta:  boolean;
  iva_rate:          number;
  rete_iva_rate:     number;  // % del IVA (no del subtotal)
  rete_ica_rate:     number;
  rete_fuente_rate:  number;
  rate_4pct:         number;
  rate_5pct_renta:   number;
}

export interface PricingInput {
  costo_total:   number;
  sale_type:     string;
  commission_pct: number;
  discount_pct:  number;
  rounding_to:   number;
  quantity:      number;
  taxes:         ProjectTaxConfig;
}

export interface PricingResult {
  // Costos
  costo_total:         number;
  costo_unitario:      number;

  // Precio de venta
  precio_base:         number;   // costo / (1 - margen)
  precio_con_retenciones: number; // ajustado para cubrir retenciones
  precio_con_comision: number;   // ajustado para cubrir comisión
  precio_redondeado:   number;   // redondeado
  precio_con_descuento: number;  // precio final unitario

  // Descuento
  descuento_maximo_pct: number;  // máximo sin perder dinero
  descuento_aplicado:   number;  // monto del descuento

  // Comisión
  comision_unitaria:   number;
  comision_total:      number;

  // Subtotal (sin IVA)
  subtotal:            number;   // precio_con_descuento × cantidad

  // Impuestos sobre subtotal
  iva_amount:          number;
  rete_iva_amount:     number;
  rete_ica_amount:     number;
  rete_fuente_amount:  number;
  amount_4pct:         number;
  amount_5pct_renta:   number;

  total_retenciones:   number;   // suma de lo que deduce el cliente
  total_factura:       number;   // subtotal + IVA
  neto_recibido:       number;   // total_factura - retenciones

  // Utilidad real
  utilidad_bruta:      number;
  utilidad_pct:        number;

  margen_tipo_venta:   number;
}

function roundTo(value: number, nearest: number): number {
  if (nearest <= 0) return value;
  return Math.ceil(value / nearest) * nearest;
}

export function calcularPrecio(input: PricingInput): PricingResult {
  const {
    costo_total, sale_type, commission_pct,
    discount_pct, rounding_to, quantity, taxes,
  } = input;

  const margen = SALE_TYPE_MARGINS[sale_type] ?? 0;

  // Retenciones que afectan el ingreso neto (sobre subtotal)
  const rete_iva_sobre_subtotal = taxes.apply_rete_iva
    ? taxes.iva_rate * taxes.rete_iva_rate   // 19% × 15% = 2.85%
    : 0;
  const total_retenciones_pct =
    (taxes.apply_rete_ica     ? taxes.rete_ica_rate    : 0) +
    (taxes.apply_rete_fuente  ? taxes.rete_fuente_rate : 0) +
    (taxes.apply_4pct         ? taxes.rate_4pct        : 0) +
    (taxes.apply_5pct_renta   ? taxes.rate_5pct_renta  : 0) +
    rete_iva_sobre_subtotal;

  // 1. Precio que cubre el margen (sin ajustes)
  const precio_base = margen < 1
    ? costo_total / (1 - margen)
    : costo_total;

  // 2. Compensar retenciones para mantener margen
  const precio_con_retenciones = total_retenciones_pct < 1
    ? precio_base / (1 - total_retenciones_pct)
    : precio_base;

  // 3. Compensar comisión
  const precio_con_comision = commission_pct < 1
    ? precio_con_retenciones / (1 - commission_pct)
    : precio_con_retenciones;

  // 4. Redondear
  const precio_redondeado = roundTo(precio_con_comision, rounding_to);

  // 5. Descuento (nunca supera la utilidad)
  const descuento_maximo_pct = precio_redondeado > 0
    ? Math.max(0, 1 - (costo_total / precio_redondeado))
    : 0;
  const descuento_real = Math.min(discount_pct, descuento_maximo_pct);
  const precio_con_descuento = precio_redondeado * (1 - descuento_real);
  const descuento_aplicado = precio_redondeado - precio_con_descuento;

  // 6. Comisión
  const comision_unitaria = precio_con_descuento * commission_pct;
  const comision_total    = comision_unitaria * quantity;

  // 7. Subtotal
  const subtotal = precio_con_descuento * quantity;

  // 8. Impuestos
  const iva_amount        = taxes.apply_iva         ? subtotal * taxes.iva_rate          : 0;
  const rete_iva_amount   = taxes.apply_rete_iva    ? iva_amount * taxes.rete_iva_rate   : 0;
  const rete_ica_amount   = taxes.apply_rete_ica    ? subtotal * taxes.rete_ica_rate     : 0;
  const rete_fuente_amount= taxes.apply_rete_fuente ? subtotal * taxes.rete_fuente_rate  : 0;
  const amount_4pct       = taxes.apply_4pct        ? subtotal * taxes.rate_4pct         : 0;
  const amount_5pct_renta = taxes.apply_5pct_renta  ? subtotal * taxes.rate_5pct_renta   : 0;

  const total_retenciones = rete_iva_amount + rete_ica_amount +
    rete_fuente_amount + amount_4pct + amount_5pct_renta;

  const total_factura  = subtotal + iva_amount;
  const neto_recibido  = total_factura - total_retenciones;

  // 9. Utilidad
  const utilidad_bruta = neto_recibido - costo_total - comision_total;
  const utilidad_pct   = neto_recibido > 0 ? utilidad_bruta / neto_recibido : 0;

  return {
    costo_total,
    costo_unitario: costo_total / (quantity || 1),
    precio_base,
    precio_con_retenciones,
    precio_con_comision,
    precio_redondeado,
    precio_con_descuento,
    descuento_maximo_pct,
    descuento_aplicado,
    comision_unitaria,
    comision_total,
    subtotal,
    iva_amount,
    rete_iva_amount,
    rete_ica_amount,
    rete_fuente_amount,
    amount_4pct,
    amount_5pct_renta,
    total_retenciones,
    total_factura,
    neto_recibido,
    utilidad_bruta,
    utilidad_pct,
    margen_tipo_venta: margen,
  };
}

/** Fusiona config del proyecto con overrides del producto (null = usar proyecto) */
export function resolveConfig<T extends object>(
  projectConfig: T,
  productOverride: Partial<T> | null
): T {
  if (!productOverride) return projectConfig;
  const result = { ...projectConfig };
  for (const key of Object.keys(productOverride) as (keyof T)[]) {
    if (productOverride[key] !== null && productOverride[key] !== undefined) {
      result[key] = productOverride[key] as T[keyof T];
    }
  }
  return result;
}
