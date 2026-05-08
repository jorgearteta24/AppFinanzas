-- Ampliar el constraint de tipo en transactions para incluir todos los tipos usados por la app
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN (
    'income',
    'expense',
    'transfer',
    'savings_deposit',
    'savings_withdrawal',
    'debt_payment',
    'adjustment',
    'refund',
    'credit_card_payment',
    'bank_fee'
  ));

-- Agregar columna origin si no existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'origin'
  ) THEN
    ALTER TABLE transactions ADD COLUMN origin text DEFAULT 'manual';
  END IF;
END $$;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_origin_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_origin_check
  CHECK (origin IN ('manual', 'imported', 'manual_message', 'sms', 'push_notification', 'api'));

-- Agregar columna status si no existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'status'
  ) THEN
    ALTER TABLE transactions ADD COLUMN status text DEFAULT 'confirmed';
  END IF;
END $$;

ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'reconciled'));

-- Agregar columna reference si no existe
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'reference'
  ) THEN
    ALTER TABLE transactions ADD COLUMN reference text;
  END IF;
END $$;

-- Hacer category_id nullable (la app lo usa como opcional)
ALTER TABLE transactions ALTER COLUMN category_id DROP NOT NULL;
