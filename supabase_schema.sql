-- ==========================================================================
-- MEU ASSESSOR FINANCEIRO - SCHEMA SQL PARA O SUPABASE
-- Execute este script no SQL Editor do seu projeto Supabase (supabase.com)
-- ==========================================================================

-- 1. Tabela de Configurações e Saldo Geral
CREATE TABLE IF NOT EXISTS financial_settings (
  id TEXT PRIMARY KEY DEFAULT 'main',
  account_balance NUMERIC(12, 2) NOT NULL DEFAULT 4580.50,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir saldo inicial se não existir
INSERT INTO financial_settings (id, account_balance)
VALUES ('main', 4580.50)
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

-- Inserir cartões de exemplo se a tabela estiver vazia
INSERT INTO cards (id, name, brand, last4, color, limit_total, closing_day, due_day)
VALUES 
  ('card-nubank', 'Nubank Ultravioleta', 'Mastercard', '8842', 'linear-gradient(135deg, #820ad1 0%, #4c0677 100%)', 8500.00, 24, 3),
  ('card-inter', 'Inter Black', 'Mastercard', '3190', 'linear-gradient(135deg, #ff7a00 0%, #b84f00 100%)', 12000.00, 15, 22)
ON CONFLICT (id) DO NOTHING;

-- Inserir parcelamentos de exemplo se a tabela estiver vazia
INSERT INTO installments (id, card_id, description, category, total_amount, installment_amount, total_installments, current_installment, start_month, end_month)
VALUES 
  ('inst-1', 'card-nubank', 'MacBook Air M2', 'Eletrônicos & Trabalho', 7200.00, 600.00, 12, 5, '2026-06', '2027-05'),
  ('inst-2', 'card-nubank', 'Smartphone Galaxy S24', 'Eletrônicos & Trabalho', 3600.00, 360.00, 10, 7, '2026-04', '2027-01'),
  ('inst-3', 'card-inter', 'Geladeira Frost Free', 'Casa & Eletrodomésticos', 2880.00, 240.00, 12, 3, '2026-08', '2027-07')
ON CONFLICT (id) DO NOTHING;

-- Habilitar Row Level Security (RLS) permissivo para leitura e escrita pela aplicação
ALTER TABLE financial_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público completo settings" ON financial_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público completo cards" ON cards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público completo installments" ON installments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público completo transactions" ON transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público completo chat" ON chat_history FOR ALL USING (true) WITH CHECK (true);
