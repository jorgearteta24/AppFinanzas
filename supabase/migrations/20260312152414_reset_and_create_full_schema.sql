/*
  # Resetear y crear esquema completo para app de finanzas personales

  ## Descripción
  Elimina tablas existentes y crea una estructura completa de datos para gestión 
  de finanzas personales con autenticación de usuarios.

  ## Cambios
  1. Eliminar tablas existentes que no tienen user_id
  2. Crear todas las tablas necesarias con estructura correcta
  3. Configurar RLS y políticas de seguridad
  4. Crear índices para rendimiento

  ## Nuevas Tablas
  - profiles: Perfiles de usuario
  - accounts: Cuentas bancarias y efectivo
  - categories: Categorías de gastos/ingresos
  - subcategories: Subcategorías
  - transactions: Transacciones financieras
  - budgets: Presupuestos
  - savings_goals: Metas de ahorro
  - import_templates: Plantillas de importación
  - import_jobs: Trabajos de importación
  - import_rows: Filas importadas
  - detected_notifications: Notificaciones bancarias
  - parsed_messages: Mensajes parseados
  - auto_rules: Reglas de automatización

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Solo usuarios autenticados pueden acceder a sus datos
*/

-- Eliminar tablas existentes en orden correcto (por dependencias)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;

-- Crear extensión para UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  currency text DEFAULT 'COP',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- 2. ACCOUNTS
CREATE TABLE IF NOT EXISTS accounts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'cash', 'investment')),
  balance decimal(15, 2) DEFAULT 0,
  currency text DEFAULT 'COP',
  color text DEFAULT '#3B82F6',
  icon text DEFAULT 'wallet',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. CATEGORIES
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  color text DEFAULT '#6B7280',
  icon text DEFAULT 'tag',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own and default categories"
  ON categories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_default = true);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND is_default = false)
  WITH CHECK (auth.uid() = user_id AND is_default = false);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id AND is_default = false);

-- 4. SUBCATEGORIES
CREATE TABLE IF NOT EXISTS subcategories (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own subcategories"
  ON subcategories FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subcategories"
  ON subcategories FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subcategories"
  ON subcategories FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own subcategories"
  ON subcategories FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. TRANSACTIONS
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  subcategory_id uuid REFERENCES subcategories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount decimal(15, 2) NOT NULL,
  description text NOT NULL,
  notes text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. BUDGETS
CREATE TABLE IF NOT EXISTS budgets (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  amount decimal(15, 2) NOT NULL,
  period text DEFAULT 'monthly' CHECK (period IN ('monthly', 'yearly')),
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  end_date date,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. SAVINGS_GOALS
CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_amount decimal(15, 2) NOT NULL,
  current_amount decimal(15, 2) DEFAULT 0,
  target_date date,
  color text DEFAULT '#10B981',
  icon text DEFAULT 'piggy-bank',
  is_completed boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own savings goals"
  ON savings_goals FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own savings goals"
  ON savings_goals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own savings goals"
  ON savings_goals FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own savings goals"
  ON savings_goals FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 8. IMPORT_TEMPLATES
CREATE TABLE IF NOT EXISTS import_templates (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  bank_name text NOT NULL,
  format_type text NOT NULL CHECK (format_type IN ('csv', 'excel', 'sms', 'email')),
  column_mappings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE import_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import templates"
  ON import_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import templates"
  ON import_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import templates"
  ON import_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own import templates"
  ON import_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 9. IMPORT_JOBS
CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES import_templates(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import jobs"
  ON import_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import jobs"
  ON import_jobs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import jobs"
  ON import_jobs FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own import jobs"
  ON import_jobs FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 10. IMPORT_ROWS
CREATE TABLE IF NOT EXISTS import_rows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  import_job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_data jsonb NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'imported', 'duplicate', 'error')),
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own import rows"
  ON import_rows FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own import rows"
  ON import_rows FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own import rows"
  ON import_rows FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own import rows"
  ON import_rows FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 11. DETECTED_NOTIFICATIONS
CREATE TABLE IF NOT EXISTS detected_notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('sms', 'push', 'email')),
  sender text NOT NULL,
  raw_content text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  is_processed boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE detected_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own detected notifications"
  ON detected_notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own detected notifications"
  ON detected_notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own detected notifications"
  ON detected_notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own detected notifications"
  ON detected_notifications FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 12. PARSED_MESSAGES
CREATE TABLE IF NOT EXISTS parsed_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id uuid NOT NULL REFERENCES detected_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parsed_data jsonb NOT NULL DEFAULT '{}',
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  confidence_score decimal(3, 2) DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE parsed_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own parsed messages"
  ON parsed_messages FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own parsed messages"
  ON parsed_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own parsed messages"
  ON parsed_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own parsed messages"
  ON parsed_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 13. AUTO_RULES
CREATE TABLE IF NOT EXISTS auto_rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  conditions jsonb NOT NULL DEFAULT '{}',
  actions jsonb NOT NULL DEFAULT '{}',
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE auto_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own auto rules"
  ON auto_rules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own auto rules"
  ON auto_rules FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own auto rules"
  ON auto_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own auto rules"
  ON auto_rules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_savings_goals_user_id ON savings_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_user_id ON subcategories(user_id);
CREATE INDEX IF NOT EXISTS idx_import_jobs_user_id ON import_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_import_rows_user_id ON import_rows(user_id);
CREATE INDEX IF NOT EXISTS idx_detected_notifications_user_id ON detected_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_parsed_messages_user_id ON parsed_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_auto_rules_user_id ON auto_rules(user_id);