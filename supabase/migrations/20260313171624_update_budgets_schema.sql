/*
  # Actualizar esquema de presupuestos

  ## Descripción
  Actualiza la tabla de presupuestos para soportar presupuestos mensuales
  con alertas y seguimiento de gastos.

  ## Cambios
  - Agregar campos month y year para identificar el período
  - Agregar alert_percentage para configurar alertas
  - Hacer category_id opcional para presupuestos globales
  - Eliminar campos obsoletos (start_date, end_date, period)
  - Actualizar constraints
*/

-- Agregar nuevos campos si no existen
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'month'
  ) THEN
    ALTER TABLE budgets ADD COLUMN month integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'year'
  ) THEN
    ALTER TABLE budgets ADD COLUMN year integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'alert_percentage'
  ) THEN
    ALTER TABLE budgets ADD COLUMN alert_percentage integer DEFAULT 80;
  END IF;
END $$;

-- Hacer category_id opcional
ALTER TABLE budgets ALTER COLUMN category_id DROP NOT NULL;

-- Agregar constraints para month y year
ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_month_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_month_check 
  CHECK (month >= 1 AND month <= 12);

ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_year_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_year_check 
  CHECK (year >= 2000 AND year <= 2100);

ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_alert_percentage_check;
ALTER TABLE budgets ADD CONSTRAINT budgets_alert_percentage_check 
  CHECK (alert_percentage > 0 AND alert_percentage <= 100);

-- Crear índice compuesto para búsquedas por mes/año
CREATE INDEX IF NOT EXISTS idx_budgets_month_year ON budgets(user_id, year, month);

-- Eliminar columnas obsoletas si existen
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'period'
  ) THEN
    ALTER TABLE budgets DROP COLUMN period;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE budgets DROP COLUMN start_date;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'end_date'
  ) THEN
    ALTER TABLE budgets DROP COLUMN end_date;
  END IF;
END $$;