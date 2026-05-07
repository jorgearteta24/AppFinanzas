export type AccountType =
  | 'cash'
  | 'savings'
  | 'checking'
  | 'credit_card'
  | 'nequi'
  | 'daviplata'
  | 'bolsillo'
  | 'emergency_fund'
  | 'scheduled_savings'
  | 'investment'
  | 'other';

export type CategoryType = 'income' | 'expense' | 'transfer' | 'savings' | 'debt';

export type TransactionType =
  | 'income'
  | 'expense'
  | 'transfer'
  | 'savings_deposit'
  | 'savings_withdrawal'
  | 'debt_payment'
  | 'adjustment'
  | 'refund'
  | 'credit_card_payment'
  | 'bank_fee';

export type TransactionOrigin = 'manual' | 'system_adjustment' | 'imported' | 'detected';

export type TransactionStatus = 'confirmed' | 'pending_review' | 'cancelled';

export type TransactionChannel =
  | 'debit_card'
  | 'credit_card'
  | 'transfer'
  | 'pse'
  | 'cash'
  | 'qr'
  | 'automatic_debit'
  | 'deposit'
  | 'other';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  initial_balance: number;
  currency: string;
  color: string;
  icon: string;
  institution?: string;
  masked_number?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id?: string;
  name: string;
  type: CategoryType;
  parent_type?: string;
  color: string;
  icon: string;
  is_default: boolean;
  created_at: string;
}

export interface Subcategory {
  id: string;
  category_id: string;
  user_id: string;
  name: string;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  destination_account_id?: string;
  category_id?: string;
  subcategory_id?: string;
  type: TransactionType;
  amount: number;
  description: string;
  notes?: string;
  transaction_date: string;
  third_party?: string;
  reference?: string;
  channel?: TransactionChannel;
  city?: string;
  is_recurring: boolean;
  origin: TransactionOrigin;
  status: TransactionStatus;
  observations?: string;
  created_at: string;
  updated_at: string;
}

export interface TransactionWithDetails extends Transaction {
  account?: Account;
  destination_account?: Account;
  category?: Category;
  subcategory?: Subcategory;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id?: string;
  amount: number;
  month: number;
  year: number;
  alert_percentage: number;
  is_active: boolean;
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  target_date?: string;
  destination_account_id?: string;
  color: string;
  icon: string;
  is_active: boolean;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
}

export type ImportJobStatus = 'pending' | 'preview' | 'ready' | 'processing' | 'completed' | 'failed' | 'cancelled';

export type ImportRowStatus = 'pending' | 'ready' | 'duplicate_suspected' | 'ignored' | 'imported' | 'error';

export interface ImportTemplate {
  id: string;
  user_id?: string;
  name: string;
  bank_name: string;
  format_type: 'csv' | 'excel' | 'sms' | 'email';
  description?: string;
  column_mappings: {
    date_column: string;
    description_column: string;
    reference_column?: string;
    amount_column: string;
    date_format?: string;
  };
  is_default: boolean;
  created_at: string;
}

export interface ImportJob {
  id: string;
  user_id: string;
  account_id?: string;
  template_id?: string;
  file_name?: string;
  bank_name?: string;
  status: ImportJobStatus;
  total_rows: number;
  processed_rows: number;
  valid_rows: number;
  duplicate_rows: number;
  ignored_rows: number;
  imported_rows: number;
  error_message?: string;
  created_at: string;
  completed_at?: string;
}

export interface ImportRow {
  id: string;
  import_job_id: string;
  user_id: string;
  account_id?: string;
  category_id?: string;
  transaction_id?: string;
  raw_data: any;
  parsed_date?: string;
  parsed_amount?: number;
  parsed_description?: string;
  parsed_reference?: string;
  parsed_type?: TransactionType;
  is_duplicate: boolean;
  duplicate_transaction_id?: string;
  is_ignored: boolean;
  status: ImportRowStatus;
  error_message?: string;
  row_number?: number;
  created_at: string;
}

export type AutoRuleType = 'classification' | 'automation';

export interface AutoRule {
  id: string;
  user_id?: string;
  name: string;
  rule_type: AutoRuleType;
  category_id?: string;
  subcategory_id?: string;
  suggested_type?: TransactionType;
  conditions: {
    keywords?: string[];
    amount_min?: number;
    amount_max?: number;
    account_ids?: string[];
  };
  actions?: any;
  priority: number;
  is_active: boolean;
  is_default: boolean;
  match_count: number;
  last_matched_at?: string;
  created_at: string;
}

export type DuplicateMatchStatus = 'pending' | 'merged' | 'ignored' | 'resolved';

export interface DuplicateMatch {
  id: string;
  user_id: string;
  transaction1_id: string;
  transaction2_id: string;
  similarity_score: number;
  match_reason: {
    date_match?: boolean;
    amount_match?: boolean;
    description_similarity?: number;
    reference_match?: boolean;
    same_account?: boolean;
  };
  status: DuplicateMatchStatus;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
}

export interface DuplicateResolution {
  id: string;
  user_id: string;
  match_id: string;
  kept_transaction_id: string;
  removed_transaction_id?: string;
  action: 'merge' | 'keep_both' | 'delete_duplicate';
  notes?: string;
  created_at: string;
}
