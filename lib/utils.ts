export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
};

export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const getTransactionColor = (type: string): string => {
  const colors: Record<string, string> = {
    income: '#00C853',
    expense: '#FF3B30',
    transfer: '#0066FF',
    savings_deposit: '#9C27B0',
    savings_withdrawal: '#9C27B0',
    debt_payment: '#FF9800',
    adjustment: '#6B7280',
    refund: '#00C853',
    credit_card_payment: '#FF9800',
    bank_fee: '#FF3B30',
  };
  return colors[type] || '#6B7280';
};

export const getTransactionLabel = (type: string): string => {
  const labels: Record<string, string> = {
    income: 'Ingreso',
    expense: 'Gasto',
    transfer: 'Transferencia',
    savings_deposit: 'Aporte a ahorro',
    savings_withdrawal: 'Retiro de ahorro',
    debt_payment: 'Pago de deuda',
    adjustment: 'Ajuste',
    refund: 'Reembolso',
    credit_card_payment: 'Pago tarjeta',
    bank_fee: 'Comisión',
  };
  return labels[type] || type;
};

export const getAccountTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    cash: 'Efectivo',
    savings: 'Cuenta de ahorros',
    checking: 'Cuenta corriente',
    credit_card: 'Tarjeta de crédito',
    nequi: 'Nequi',
    daviplata: 'Daviplata',
    bolsillo: 'Bolsillo',
    emergency_fund: 'Fondo de emergencia',
    scheduled_savings: 'Ahorro programado',
    investment: 'Inversión',
    other: 'Otra',
  };
  return labels[type] || type;
};

export const getChannelLabel = (channel: string): string => {
  const labels: Record<string, string> = {
    debit_card: 'Tarjeta débito',
    credit_card: 'Tarjeta crédito',
    transfer: 'Transferencia',
    pse: 'PSE',
    cash: 'Efectivo',
    qr: 'QR',
    automatic_debit: 'Débito automático',
    deposit: 'Consignación',
    other: 'Otro',
  };
  return labels[channel] || channel;
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    confirmed: 'Confirmado',
    pending_review: 'Pendiente de revisar',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
};
