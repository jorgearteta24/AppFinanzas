/*
  # Actualizar esquema de metas de ahorro

  ## Descripción
  Actualiza la tabla de metas de ahorro para soportar gestión completa
  de objetivos financieros con aportes y retiros.

  ## Cambios
  - Agregar campo description para descripción de la meta
  - Agregar campo destination_account_id para vincular con cuenta
  - Asegurar que todos los campos necesarios existan
  - Actualizar constraints y valores por defecto

  ## Campos finales
  - id, user_id, name, description
  - target_amount, current_amount
  - target_date, destination_account_id
  - color, icon, is_completed, is_active
  - created_at, updated_at
*/

-- Agregar campos faltantes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'savings_goals' AND column_name = 'description'
  ) THEN
    ALTER TABLE savings_goals ADD COLUMN description text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'savings_goals' AND column_name = 'destination_account_id'
  ) THEN
    ALTER TABLE savings_goals ADD COLUMN destination_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'savings_goals' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE savings_goals ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;

-- Asegurar que current_amount tenga valor por defecto
ALTER TABLE savings_goals ALTER COLUMN current_amount SET DEFAULT 0;

-- Asegurar que is_completed tenga valor por defecto
ALTER TABLE savings_goals ALTER COLUMN is_completed SET DEFAULT false;

-- Crear índice para destination_account_id
CREATE INDEX IF NOT EXISTS idx_savings_goals_destination_account ON savings_goals(destination_account_id);

-- Agregar constraint para validar que current_amount no sea negativo
ALTER TABLE savings_goals DROP CONSTRAINT IF EXISTS savings_goals_current_amount_check;
ALTER TABLE savings_goals ADD CONSTRAINT savings_goals_current_amount_check 
  CHECK (current_amount >= 0);

-- Agregar constraint para validar que target_amount sea positivo
ALTER TABLE savings_goals DROP CONSTRAINT IF EXISTS savings_goals_target_amount_check;
ALTER TABLE savings_goals ADD CONSTRAINT savings_goals_target_amount_check 
  CHECK (target_amount > 0);