/*
  # Agregar sistema de reglas automáticas y conciliación de duplicados

  ## Descripción
  Implementa el sistema completo de reglas automáticas de clasificación y
  conciliación de transacciones duplicadas.

  ## Cambios Realizados

  ### 1. Actualización de tabla auto_rules
  - Se agrega `rule_type` para diferenciar entre 'classification' y 'automation'
  - Se agrega `category_id` para sugerencia directa de categoría
  - Se agrega `subcategory_id` para sugerencia de subcategoría
  - Se agrega `suggested_type` para sugerencia de tipo de transacción
  - Se mejora estructura de `conditions` para incluir keywords
  - Se agrega `match_count` para estadísticas de uso
  - Se agrega `last_matched_at` para tracking

  ### 2. Nueva tabla duplicate_matches
  - Almacena posibles duplicados detectados entre transacciones
  - Estados: 'pending', 'merged', 'ignored', 'resolved'
  - Incluye score de similitud y razón de la coincidencia
  - Permite tracking de resolución manual

  ### 3. Nueva tabla duplicate_resolutions
  - Registra histórico de resoluciones de duplicados
  - Vincula transacciones originales y duplicadas
  - Almacena acción tomada y usuario que la realizó

  ### 4. Reglas predefinidas de clasificación
  - Mercado (supermercados)
  - Transporte (taxis, Uber, etc.)
  - Suscripciones (streaming)
  - Transferencias digitales
  - Salud
  - Restaurantes
  - Rendimientos financieros
  - Comisiones bancarias

  ## Seguridad
  - RLS habilitado en todas las tablas nuevas
  - Políticas restrictivas por usuario autenticado
*/

-- Actualizar tabla auto_rules
DO $$
BEGIN
  -- Agregar rule_type si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_rules' AND column_name = 'rule_type'
  ) THEN
    ALTER TABLE auto_rules ADD COLUMN rule_type text DEFAULT 'classification' CHECK (rule_type IN ('classification', 'automation'));
  END IF;

  -- Agregar category_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_rules' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE auto_rules ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;

  -- Agregar subcategory_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_rules' AND column_name = 'subcategory_id'
  ) THEN
    ALTER TABLE auto_rules ADD COLUMN subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL;
  END IF;

  -- Agregar suggested_type si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_rules' AND column_name = 'suggested_type'
  ) THEN
    ALTER TABLE auto_rules ADD COLUMN suggested_type text CHECK (suggested_type IN ('income', 'expense', 'transfer', 'savings_deposit', 'savings_withdrawal', 'debt_payment', 'adjustment', 'refund', 'credit_card_payment', 'bank_fee'));
  END IF;

  -- Agregar match_count si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_rules' AND column_name = 'match_count'
  ) THEN
    ALTER TABLE auto_rules ADD COLUMN match_count integer DEFAULT 0;
  END IF;

  -- Agregar last_matched_at si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_rules' AND column_name = 'last_matched_at'
  ) THEN
    ALTER TABLE auto_rules ADD COLUMN last_matched_at timestamptz;
  END IF;

  -- Hacer user_id nullable para reglas por defecto
  ALTER TABLE auto_rules ALTER COLUMN user_id DROP NOT NULL;
  
  -- Agregar is_default si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auto_rules' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE auto_rules ADD COLUMN is_default boolean DEFAULT false;
  END IF;
END $$;

-- Actualizar políticas RLS para auto_rules
DROP POLICY IF EXISTS "Users can view own auto rules" ON auto_rules;
CREATE POLICY "Users can view own and default auto rules"
  ON auto_rules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_default = true);

-- Crear tabla duplicate_matches
CREATE TABLE IF NOT EXISTS duplicate_matches (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction1_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  transaction2_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  similarity_score decimal(3, 2) NOT NULL CHECK (similarity_score >= 0 AND similarity_score <= 1),
  match_reason jsonb DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'merged', 'ignored', 'resolved')),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT different_transactions CHECK (transaction1_id != transaction2_id)
);

ALTER TABLE duplicate_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own duplicate matches"
  ON duplicate_matches FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own duplicate matches"
  ON duplicate_matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own duplicate matches"
  ON duplicate_matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own duplicate matches"
  ON duplicate_matches FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Crear tabla duplicate_resolutions
CREATE TABLE IF NOT EXISTS duplicate_resolutions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES duplicate_matches(id) ON DELETE CASCADE,
  kept_transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  removed_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('merge', 'keep_both', 'delete_duplicate')),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE duplicate_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own duplicate resolutions"
  ON duplicate_resolutions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own duplicate resolutions"
  ON duplicate_resolutions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_auto_rules_category_id ON auto_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_auto_rules_is_active ON auto_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_auto_rules_is_default ON auto_rules(is_default);
CREATE INDEX IF NOT EXISTS idx_duplicate_matches_user_id ON duplicate_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_matches_status ON duplicate_matches(status);
CREATE INDEX IF NOT EXISTS idx_duplicate_matches_transaction1_id ON duplicate_matches(transaction1_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_matches_transaction2_id ON duplicate_matches(transaction2_id);
CREATE INDEX IF NOT EXISTS idx_duplicate_resolutions_match_id ON duplicate_resolutions(match_id);

-- Insertar reglas predefinidas de clasificación
-- Primero obtenemos IDs de categorías por defecto si existen, si no, las creamos

-- Insertar categorías por defecto si no existen
INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Mercado', 'expense', '#10B981', 'shopping-cart', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Mercado' AND is_default = true);

INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Transporte', 'expense', '#3B82F6', 'car', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Transporte' AND is_default = true);

INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Suscripciones', 'expense', '#8B5CF6', 'tv', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Suscripciones' AND is_default = true);

INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Transferencia', 'transfer', '#6B7280', 'arrow-right-left', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Transferencia' AND is_default = true);

INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Salud', 'expense', '#EF4444', 'heart', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Salud' AND is_default = true);

INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Restaurantes', 'expense', '#F59E0B', 'utensils', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Restaurantes' AND is_default = true);

INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Rendimientos', 'income', '#10B981', 'trending-up', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Rendimientos' AND is_default = true);

INSERT INTO categories (name, type, color, icon, is_default)
SELECT 'Comisiones', 'expense', '#DC2626', 'credit-card', true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Comisiones' AND is_default = true);

-- Insertar reglas predefinidas
INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Supermercados y tiendas',
  'classification',
  (SELECT id FROM categories WHERE name = 'Mercado' AND is_default = true LIMIT 1),
  'expense',
  jsonb_build_object(
    'keywords', jsonb_build_array('exito', 'olimpica', 'ara', 'd1', 'carulla', 'supermercado', 'mercado', 'jumbo', 'la 14')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Supermercados y tiendas' AND is_default = true
);

INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Transporte',
  'classification',
  (SELECT id FROM categories WHERE name = 'Transporte' AND is_default = true LIMIT 1),
  'expense',
  jsonb_build_object(
    'keywords', jsonb_build_array('uber', 'didi', 'indrive', 'taxi', 'cabify', 'beat', 'transporte', 'gasolina', 'combustible')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Transporte' AND is_default = true
);

INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Suscripciones digitales',
  'classification',
  (SELECT id FROM categories WHERE name = 'Suscripciones' AND is_default = true LIMIT 1),
  'expense',
  jsonb_build_object(
    'keywords', jsonb_build_array('netflix', 'spotify', 'youtube', 'amazon prime', 'disney', 'hbo', 'apple music')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Suscripciones digitales' AND is_default = true
);

INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Billeteras digitales',
  'classification',
  (SELECT id FROM categories WHERE name = 'Transferencia' AND is_default = true LIMIT 1),
  'transfer',
  jsonb_build_object(
    'keywords', jsonb_build_array('nequi', 'daviplata', 'transferencia', 'transf', 'envio', 'recarga')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Billeteras digitales' AND is_default = true
);

INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Salud y medicina',
  'classification',
  (SELECT id FROM categories WHERE name = 'Salud' AND is_default = true LIMIT 1),
  'expense',
  jsonb_build_object(
    'keywords', jsonb_build_array('eps', 'drogueria', 'farmacia', 'medico', 'hospital', 'clinica', 'laboratorio', 'medicina')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Salud y medicina' AND is_default = true
);

INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Restaurantes y comida',
  'classification',
  (SELECT id FROM categories WHERE name = 'Restaurantes' AND is_default = true LIMIT 1),
  'expense',
  jsonb_build_object(
    'keywords', jsonb_build_array('burger', 'pizza', 'cafe', 'restaurante', 'comida', 'rappi', 'domicilio', 'ifood', 'mcdonald')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Restaurantes y comida' AND is_default = true
);

INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Rendimientos financieros',
  'classification',
  (SELECT id FROM categories WHERE name = 'Rendimientos' AND is_default = true LIMIT 1),
  'income',
  jsonb_build_object(
    'keywords', jsonb_build_array('intereses ahorros', 'abono intereses', 'rendimiento', 'interes', 'gmf favor')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Rendimientos financieros' AND is_default = true
);

INSERT INTO auto_rules (
  user_id, name, rule_type, category_id, suggested_type,
  conditions, priority, is_active, is_default
)
SELECT
  NULL,
  'Comisiones bancarias',
  'classification',
  (SELECT id FROM categories WHERE name = 'Comisiones' AND is_default = true LIMIT 1),
  'bank_fee',
  jsonb_build_object(
    'keywords', jsonb_build_array('comision', 'cuota manejo', 'gmf', 'gravamen', 'retencion', 'iva')
  ),
  10,
  true,
  true
WHERE NOT EXISTS (
  SELECT 1 FROM auto_rules WHERE name = 'Comisiones bancarias' AND is_default = true
);