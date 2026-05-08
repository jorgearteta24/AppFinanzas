-- ============================================================
-- SCHEMA COMPLETO - AppFinanzas + Proyectos
-- Pegar completo en Supabase SQL Editor y ejecutar
-- ============================================================

-- ── PROFILES ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_own" ON profiles USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── ACCOUNTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS accounts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('checking','savings','credit_card','cash','investment')),
  balance decimal(15,2) DEFAULT 0,
  currency text DEFAULT 'COP',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_own" ON accounts USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── CATEGORIES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income','expense')),
  color text DEFAULT '#6B7280',
  icon text DEFAULT 'tag',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_read" ON categories FOR SELECT USING (auth.uid() = user_id OR is_default = true);
CREATE POLICY "categories_write" ON categories FOR INSERT WITH CHECK (auth.uid() = user_id AND is_default = false);
CREATE POLICY "categories_update" ON categories FOR UPDATE USING (auth.uid() = user_id AND is_default = false) WITH CHECK (auth.uid() = user_id AND is_default = false);
CREATE POLICY "categories_delete" ON categories FOR DELETE USING (auth.uid() = user_id AND is_default = false);

-- Categorías por defecto
INSERT INTO categories (name, type, color, icon, is_default) VALUES
  ('Salario','income','#10B981','briefcase',true),
  ('Freelance','income','#3B82F6','laptop',true),
  ('Inversiones','income','#8B5CF6','trending-up',true),
  ('Otros ingresos','income','#F59E0B','plus-circle',true),
  ('Alimentación','expense','#EF4444','utensils',true),
  ('Transporte','expense','#F97316','car',true),
  ('Vivienda','expense','#06B6D4','home',true),
  ('Salud','expense','#EC4899','heart',true),
  ('Entretenimiento','expense','#8B5CF6','film',true),
  ('Ropa','expense','#14B8A6','shopping-bag',true),
  ('Educación','expense','#6366F1','book',true),
  ('Servicios','expense','#64748B','zap',true),
  ('Otros gastos','expense','#9CA3AF','more-horizontal',true)
ON CONFLICT DO NOTHING;

-- ── TRANSACTIONS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN (
    'income','expense','transfer',
    'savings_deposit','savings_withdrawal',
    'debt_payment','adjustment','refund',
    'credit_card_payment','bank_fee'
  )),
  amount decimal(15,2) NOT NULL CHECK (amount > 0),
  description text NOT NULL,
  notes text,
  reference text,
  transaction_date date NOT NULL DEFAULT CURRENT_DATE,
  origin text DEFAULT 'manual' CHECK (origin IN (
    'manual','imported','manual_message','sms','push_notification','api'
  )),
  status text DEFAULT 'confirmed' CHECK (status IN (
    'pending','confirmed','cancelled','reconciled'
  )),
  is_recurring boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "transactions_own" ON transactions USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── BUDGETS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  amount decimal(15,2) NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  year integer NOT NULL,
  alert_percentage integer DEFAULT 80 CHECK (alert_percentage BETWEEN 1 AND 100),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "budgets_own" ON budgets USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── SAVINGS GOALS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS savings_goals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  target_amount decimal(15,2) NOT NULL,
  current_amount decimal(15,2) DEFAULT 0,
  target_date date,
  destination_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  color text DEFAULT '#10B981',
  icon text DEFAULT 'target',
  is_completed boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "goals_own" ON savings_goals USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── AUTO RULES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auto_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  keyword text NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  suggested_type text CHECK (suggested_type IN (
    'income','expense','transfer','savings_deposit','savings_withdrawal',
    'debt_payment','adjustment','refund','credit_card_payment','bank_fee'
  )),
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE auto_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rules_read" ON auto_rules FOR SELECT USING (auth.uid() = user_id OR is_default = true);
CREATE POLICY "rules_write" ON auto_rules FOR INSERT WITH CHECK (auth.uid() = user_id AND is_default = false);
CREATE POLICY "rules_update" ON auto_rules FOR UPDATE USING (auth.uid() = user_id AND is_default = false);
CREATE POLICY "rules_delete" ON auto_rules FOR DELETE USING (auth.uid() = user_id AND is_default = false);

-- ── IMPORT JOBS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS import_jobs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  file_name text,
  bank_name text,
  status text DEFAULT 'pending' CHECK (status IN (
    'pending','preview','ready','processing','completed','failed','cancelled'
  )),
  total_rows integer DEFAULT 0,
  processed_rows integer DEFAULT 0,
  error_message text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_jobs_own" ON import_jobs USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS import_rows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_data jsonb NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  status text DEFAULT 'pending' CHECK (status IN (
    'pending','ready','duplicate_suspected','ignored','imported','error'
  )),
  error_message text,
  row_number integer,
  is_ignored boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE import_rows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "import_rows_own" ON import_rows USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── DUPLICATE CANDIDATES ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS duplicate_candidates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_a_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  transaction_b_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  similarity_score decimal(3,2) CHECK (similarity_score BETWEEN 0 AND 1),
  status text DEFAULT 'pending' CHECK (status IN ('pending','merged','ignored','resolved')),
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE duplicate_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "duplicates_own" ON duplicate_candidates USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ════════════════════════════════════════════════════════════
-- MÓDULO DE PROYECTOS
-- ════════════════════════════════════════════════════════════

-- ── PROJECTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code text,                          -- e.g. '0344'
  name text NOT NULL,
  client_name text,
  description text,
  status text DEFAULT 'active' CHECK (status IN ('active','completed','cancelled','paused')),

  -- Tipo de venta y márgenes
  sale_type text DEFAULT 'fabricacion' CHECK (sale_type IN (
    'fabricacion','desarrollo','tercerizado','venta'
  )),

  -- Configuración financiera por defecto (heredada por productos/ítems)
  commission_pct decimal(7,4) DEFAULT 0,   -- e.g. 0.1000 = 10%
  discount_pct   decimal(7,4) DEFAULT 0,
  rounding_to    integer DEFAULT 1000,     -- redondear al más cercano X

  -- Impuestos: activar/desactivar
  apply_iva          boolean DEFAULT false,
  apply_rete_iva     boolean DEFAULT false,
  apply_rete_ica     boolean DEFAULT false,
  apply_rete_fuente  boolean DEFAULT false,
  apply_4pct         boolean DEFAULT false,
  apply_5pct_renta   boolean DEFAULT false,

  -- Tasas (ajustables por proyecto)
  iva_rate          decimal(7,4) DEFAULT 0.1900,
  rete_iva_rate     decimal(7,4) DEFAULT 0.1500,   -- % del IVA
  rete_ica_rate     decimal(7,4) DEFAULT 0.012875,
  rete_fuente_rate  decimal(7,4) DEFAULT 0.0400,
  rate_4pct         decimal(7,4) DEFAULT 0.0400,
  rate_5pct_renta   decimal(7,4) DEFAULT 0.0500,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projects_own" ON projects USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── PROJECT PRODUCTS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name text NOT NULL,               -- e.g. 'Silla metálica con cordón náutico'
  description text,
  quantity decimal(10,3) DEFAULT 1,
  unit text DEFAULT 'und',
  sort_order integer DEFAULT 0,

  -- Overrides (null = usar valor del proyecto)
  sale_type      text CHECK (sale_type IN ('fabricacion','desarrollo','tercerizado','venta')),
  commission_pct decimal(7,4),
  discount_pct   decimal(7,4),
  rounding_to    integer,
  apply_iva         boolean,
  apply_rete_iva    boolean,
  apply_rete_ica    boolean,
  apply_rete_fuente boolean,
  apply_4pct        boolean,
  apply_5pct_renta  boolean,

  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE project_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_own" ON project_products
  USING (EXISTS (SELECT 1 FROM projects WHERE id = project_id AND user_id = auth.uid()));

-- ── PRODUCT ITEMS (tipos dentro del producto) ────────────────
CREATE TABLE IF NOT EXISTS product_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES project_products(id) ON DELETE CASCADE,
  name text NOT NULL,               -- e.g. 'Estructura metálica', 'Instalación eléctrica'
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE product_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "product_items_own" ON product_items
  USING (EXISTS (
    SELECT 1 FROM project_products pp
    JOIN projects p ON p.id = pp.project_id
    WHERE pp.id = product_id AND p.user_id = auth.uid()
  ));

-- ── ITEM PROVIDERS (proveedores por ítem) ───────────────────
CREATE TABLE IF NOT EXISTS item_providers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id uuid NOT NULL REFERENCES product_items(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN (
    'mano_obra','materiales','transporte','otros'
  )),
  unit_value  decimal(15,2) NOT NULL DEFAULT 0,
  quantity    decimal(10,3) DEFAULT 1,
  amount_paid decimal(15,2) DEFAULT 0,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE item_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "providers_own" ON item_providers
  USING (EXISTS (
    SELECT 1 FROM product_items pi
    JOIN project_products pp ON pp.id = pi.product_id
    JOIN projects p ON p.id = pp.project_id
    WHERE pi.id = item_id AND p.user_id = auth.uid()
  ));

-- ── ITEM CATALOG (catálogo reutilizable) ─────────────────────
CREATE TABLE IF NOT EXISTS item_catalog (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  category text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE item_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "catalog_own" ON item_catalog USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── TRANSACTION ALLOCATIONS ──────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_allocations (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  product_id  uuid REFERENCES project_products(id) ON DELETE SET NULL,
  item_id     uuid REFERENCES product_items(id) ON DELETE SET NULL,
  provider_id uuid REFERENCES item_providers(id) ON DELETE SET NULL,
  amount decimal(15,2) NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE transaction_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allocations_own" ON transaction_allocations
  USING (EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = transaction_id AND t.user_id = auth.uid()
  ));

-- ── TRIGGER: updated_at automático ───────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'accounts','transactions','budgets','savings_goals',
    'projects','project_products','item_providers'
  ]) LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_updated_at ON %I;
      CREATE TRIGGER trg_updated_at
      BEFORE UPDATE ON %I
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    ', t, t);
  END LOOP;
END $$;
