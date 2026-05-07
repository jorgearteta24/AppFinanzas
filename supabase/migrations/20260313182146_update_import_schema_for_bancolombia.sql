/*
  # Actualizar esquema de importación para soportar Bancolombia

  ## Descripción
  Actualiza las tablas de importación para soportar el flujo completo de importación
  de extractos bancarios, comenzando con Bancolombia.

  ## Cambios Realizados

  ### 1. Actualización de import_jobs
  - Se agrega `account_id` para vincular el extracto a una cuenta específica
  - Se agrega `file_name` para guardar el nombre del archivo original
  - Se agrega `bank_name` para identificar el banco del extracto
  - Se actualizan los estados disponibles para incluir 'preview', 'ready', 'completed', 'failed', 'cancelled'

  ### 2. Actualización de import_rows
  - Se agrega `account_id` para vincular cada fila a la cuenta del extracto
  - Se agrega `category_id` para sugerencia de categoría automática
  - Se agrega `parsed_date` para la fecha parseada de la transacción
  - Se agrega `parsed_amount` para el monto parseado
  - Se agrega `parsed_description` para la descripción parseada
  - Se agrega `parsed_reference` para la referencia parseada
  - Se agrega `parsed_type` para el tipo sugerido (income, expense, transfer, etc.)
  - Se agrega `is_duplicate` para marcar duplicados detectados
  - Se agrega `duplicate_transaction_id` para vincular con transacción duplicada
  - Se agrega `is_ignored` para marcar filas que no se importarán
  - Se actualizan los estados a: 'pending', 'ready', 'duplicate_suspected', 'ignored', 'imported', 'error'
  - Se agrega `row_number` para mantener el orden original

  ### 3. Actualización de import_templates
  - Se agrega `is_default` para marcar plantillas predefinidas (como Bancolombia)
  - Se agrega `description` para describir la plantilla

  ### 4. Creación de plantilla Bancolombia
  - Se crea la plantilla por defecto de Bancolombia con mapeo de columnas

  ## Seguridad
  - Se mantienen todas las políticas RLS existentes
  - Se agregan restricciones de foreign key apropiadas
*/

-- Actualizar tabla import_jobs
DO $$
BEGIN
  -- Agregar account_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;

  -- Agregar file_name si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'file_name'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN file_name text;
  END IF;

  -- Agregar bank_name si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'bank_name'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN bank_name text;
  END IF;

  -- Agregar campos de conteo
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'valid_rows'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN valid_rows integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'duplicate_rows'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN duplicate_rows integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'ignored_rows'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN ignored_rows integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_jobs' AND column_name = 'imported_rows'
  ) THEN
    ALTER TABLE import_jobs ADD COLUMN imported_rows integer DEFAULT 0;
  END IF;
END $$;

-- Actualizar constraint de status en import_jobs
ALTER TABLE import_jobs DROP CONSTRAINT IF EXISTS import_jobs_status_check;
ALTER TABLE import_jobs ADD CONSTRAINT import_jobs_status_check 
  CHECK (status IN ('pending', 'preview', 'ready', 'processing', 'completed', 'failed', 'cancelled'));

-- Actualizar tabla import_rows
DO $$
BEGIN
  -- Agregar account_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE CASCADE;
  END IF;

  -- Agregar category_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'category_id'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN category_id uuid REFERENCES categories(id) ON DELETE SET NULL;
  END IF;

  -- Agregar parsed_date si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'parsed_date'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN parsed_date date;
  END IF;

  -- Agregar parsed_amount si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'parsed_amount'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN parsed_amount decimal(15, 2);
  END IF;

  -- Agregar parsed_description si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'parsed_description'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN parsed_description text;
  END IF;

  -- Agregar parsed_reference si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'parsed_reference'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN parsed_reference text;
  END IF;

  -- Agregar parsed_type si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'parsed_type'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN parsed_type text;
  END IF;

  -- Agregar is_duplicate si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'is_duplicate'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN is_duplicate boolean DEFAULT false;
  END IF;

  -- Agregar duplicate_transaction_id si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'duplicate_transaction_id'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN duplicate_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;
  END IF;

  -- Agregar is_ignored si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'is_ignored'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN is_ignored boolean DEFAULT false;
  END IF;

  -- Agregar row_number si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_rows' AND column_name = 'row_number'
  ) THEN
    ALTER TABLE import_rows ADD COLUMN row_number integer;
  END IF;
END $$;

-- Actualizar constraint de status en import_rows
ALTER TABLE import_rows DROP CONSTRAINT IF EXISTS import_rows_status_check;
ALTER TABLE import_rows ADD CONSTRAINT import_rows_status_check 
  CHECK (status IN ('pending', 'ready', 'duplicate_suspected', 'ignored', 'imported', 'error'));

-- Actualizar tabla import_templates
DO $$
BEGIN
  -- Agregar is_default si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_templates' AND column_name = 'is_default'
  ) THEN
    ALTER TABLE import_templates ADD COLUMN is_default boolean DEFAULT false;
  END IF;

  -- Agregar description si no existe
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'import_templates' AND column_name = 'description'
  ) THEN
    ALTER TABLE import_templates ADD COLUMN description text;
  END IF;

  -- Hacer user_id nullable para plantillas por defecto
  ALTER TABLE import_templates ALTER COLUMN user_id DROP NOT NULL;
END $$;

-- Actualizar políticas RLS para import_templates para permitir ver plantillas por defecto
DROP POLICY IF EXISTS "Users can view own import templates" ON import_templates;
CREATE POLICY "Users can view own and default import templates"
  ON import_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_default = true);

-- Crear plantilla por defecto de Bancolombia si no existe
INSERT INTO import_templates (
  user_id,
  name,
  bank_name,
  format_type,
  is_default,
  description,
  column_mappings
)
SELECT
  NULL,
  'Bancolombia Extracto Estándar',
  'Bancolombia',
  'excel',
  true,
  'Plantilla estándar para extractos de Bancolombia con columnas: Fecha, Descripción, Referencia, Valor',
  jsonb_build_object(
    'date_column', 'Fecha',
    'description_column', 'Descripción',
    'reference_column', 'Referencia',
    'amount_column', 'Valor',
    'date_format', 'DD/MM/YYYY'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM import_templates 
  WHERE bank_name = 'Bancolombia' AND is_default = true
);

-- Crear índices adicionales
CREATE INDEX IF NOT EXISTS idx_import_jobs_account_id ON import_jobs(account_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_import_job_id ON import_rows(import_job_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_account_id ON import_rows(account_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_status ON import_rows(status);
CREATE INDEX IF NOT EXISTS idx_import_rows_is_duplicate ON import_rows(is_duplicate);
CREATE INDEX IF NOT EXISTS idx_import_rows_is_ignored ON import_rows(is_ignored);