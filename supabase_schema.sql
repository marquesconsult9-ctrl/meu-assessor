-- ==========================================================================
-- MEU ASSESSOR FINANCEIRO - SCHEMA SQL PARA O SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase (supabase.com)
-- ==========================================================================

-- 1. Tabela de Configurações e Saldo Geral
CREATE TABLE IF NOT EXISTS financial_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  account_balance NUMERIC(12, 2) NOT NULL DEFAULT 4580.50,
  emergency_reserve NUMERIC(12, 2) NOT NULL DEFAULT 1832.20,
  investments_balance NUMERIC(12, 2) NOT NULL DEFAULT 1603.17,
  alert_due_dates BOOLEAN DEFAULT TRUE,
  alert_budget_limit BOOLEAN DEFAULT TRUE,
  alert_weekly_report BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Adicionar colunas caso a tabela financial_settings já exista
ALTER TABLE financial_settings ADD COLUMN IF NOT EXISTS emergency_reserve NUMERIC(12, 2) DEFAULT 1832.20;
ALTER TABLE financial_settings ADD COLUMN IF NOT EXISTS investments_balance NUMERIC(12, 2) DEFAULT 1603.17;
ALTER TABLE financial_settings ADD COLUMN IF NOT EXISTS alert_due_dates BOOLEAN DEFAULT TRUE;
ALTER TABLE financial_settings ADD COLUMN IF NOT EXISTS alert_budget_limit BOOLEAN DEFAULT TRUE;
ALTER TABLE financial_settings ADD COLUMN IF NOT EXISTS alert_weekly_report BOOLEAN DEFAULT TRUE;

-- Inserir saldo inicial se não existir
INSERT INTO financial_settings (id, account_balance, emergency_reserve, investments_balance)
VALUES ('main', 4580.50, 1832.20, 1603.17)
ON CONFLICT (id) DO NOTHING;

-- 2. Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL DEFAULT 'Mastercard',
  last4 TEXT NOT NULL DEFAULT '0000',
  color TEXT DEFAULT 'linear-gradient(135deg, #820ad1 0%, #4c0677 100%)',
  limit_total NUMERIC(12, 2) NOT NULL DEFAULT 5000.00,
  closing_day INT NOT NULL DEFAULT 20,
  due_day INT NOT NULL DEFAULT 28,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de Compras Parceladas (Para projeção de término de faturas)
CREATE TABLE IF NOT EXISTS installments (
  id TEXT PRIMARY KEY,
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'Compras & Parcelamentos',
  total_amount NUMERIC(12, 2) NOT NULL,
  installment_amount NUMERIC(12, 2) NOT NULL,
  total_installments INT NOT NULL,
  current_installment INT NOT NULL DEFAULT 1,
  start_month TEXT NOT NULL, -- Formato: 'YYYY-MM' (Ex: '2026-10')
  end_month TEXT NOT NULL,   -- Formato: 'YYYY-MM' (Ex: '2027-07')
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de Transações e Movimentações Financeiras
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  amount NUMERIC(12, 2) NOT NULL,
  category TEXT DEFAULT 'Geral',
  payment_method TEXT DEFAULT 'PIX',
  card_id TEXT REFERENCES cards(id) ON DELETE SET NULL,
  is_installment BOOLEAN DEFAULT FALSE,
  installment_id TEXT REFERENCES installments(id) ON DELETE CASCADE,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'WHATSAPP', -- 'WHATSAPP' ou 'WEB'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de Histórico de Mensagens do Chat WhatsApp
CREATE TABLE IF NOT EXISTS chat_history (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
  text TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Tabela de Tetos Orçamentários (Budgets)
CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  monthly_limit NUMERIC(12, 2) NOT NULL,
  spent_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Tabela de Metas Estratégicas (Goals)
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  target_amount NUMERIC(12, 2) NOT NULL,
  current_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  deadline_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Tabela de Contas a Pagar e Receber (Bills)
CREATE TABLE IF NOT EXISTS bills (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  due_date DATE,
  type TEXT NOT NULL CHECK (type IN ('PAY', 'RECEIVE')),
  is_paid BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir dados padrão se as tabelas estiverem vazias
INSERT INTO cards (id, name, brand, last4, color, limit_total, closing_day, due_day)
VALUES 
  ('card-nubank', 'Nubank Ultravioleta', 'Mastercard', '8842', 'linear-gradient(135deg, #820ad1 0%, #4c0677 100%)', 8500.00, 24, 3),
  ('card-inter', 'Inter Black', 'Mastercard', '3190', 'linear-gradient(135deg, #ff7a00 0%, #b84f00 100%)', 12000.00, 15, 22)
ON CONFLICT (id) DO NOTHING;

INSERT INTO installments (id, card_id, description, category, total_amount, installment_amount, total_installments, current_installment, start_month, end_month)
VALUES 
  ('inst-1', 'card-nubank', 'MacBook Air M2', 'Eletrônicos & Trabalho', 7200.00, 600.00, 12, 5, '2026-06', '2027-05'),
  ('inst-2', 'card-nubank', 'Smartphone Galaxy S24', 'Eletrônicos & Trabalho', 3600.00, 360.00, 10, 7, '2026-04', '2027-01'),
  ('inst-3', 'card-inter', 'Geladeira Frost Free', 'Casa & Eletrodomésticos', 2880.00, 240.00, 12, 3, '2026-08', '2027-07')
ON CONFLICT (id) DO NOTHING;

INSERT INTO budgets (id, category, monthly_limit, spent_amount)
VALUES
  ('orc-1', 'Operacional', 3000.00, 1650.00),
  ('orc-2', 'Tecnologia & Software', 1200.00, 540.00),
  ('orc-3', 'Logística & Transporte', 2000.00, 1200.00)
ON CONFLICT (id) DO NOTHING;

INSERT INTO goals (id, title, target_amount, current_amount, deadline_date)
VALUES
  ('goal-1', 'Aporte Imobiliário', 50000.00, 40500.00, '2027-12-31'),
  ('goal-2', 'Renovação de Veículo', 45500.00, 36400.00, '2027-06-30')
ON CONFLICT (id) DO NOTHING;

INSERT INTO bills (id, description, amount, due_date, type, is_paid)
VALUES
  ('bill-p1', 'Energia Elétrica (Enel)', 185.40, '2026-10-10', 'PAY', false),
  ('bill-p2', 'Internet Fibra', 129.90, '2026-10-15', 'PAY', false),
  ('bill-p3', 'Aluguel & Condomínio', 2200.00, '2026-10-20', 'PAY', false),
  ('bill-p4', 'Fatura Nubank Ultravioleta', 960.00, '2026-10-24', 'PAY', false),
  ('bill-r1', 'Salário Mensal', 8500.00, '2026-10-05', 'RECEIVE', true),
  ('bill-r2', 'Consultoria Financeira', 1500.00, '2026-10-12', 'RECEIVE', false),
  ('bill-r3', 'Dividendos & Rendimentos', 480.00, '2026-10-28', 'RECEIVE', false)
ON CONFLICT (id) DO NOTHING;

-- Habilitar Row Level Security (RLS) permissivo para leitura e escrita pela aplicação
ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso (com DROP IF EXISTS para permitir executar várias vezes sem erro)
DROP POLICY IF EXISTS "Acesso público completo settings" ON financial_settings;
CREATE POLICY "Acesso público completo settings" ON financial_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público completo cards" ON cards;
CREATE POLICY "Acesso público completo cards" ON cards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público completo installments" ON installments;
CREATE POLICY "Acesso público completo installments" ON installments FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público completo transactions" ON transactions;
CREATE POLICY "Acesso público completo transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público completo chat" ON chat_history;
CREATE POLICY "Acesso público completo chat" ON chat_history FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público completo budgets" ON budgets;
CREATE POLICY "Acesso público completo budgets" ON budgets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público completo goals" ON goals;
CREATE POLICY "Acesso público completo goals" ON goals FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Acesso público completo bills" ON bills;
CREATE POLICY "Acesso público completo bills" ON bills FOR ALL USING (true) WITH CHECK (true);

