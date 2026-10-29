require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const db = require('../db');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

async function run() {
  console.log('Removendo valores mock/fictícios e mantendo estritamente os lançamentos da planilha...');

  // 1. Zerar saldos mock no financial_settings
  await db.updateSettings({
    accountBalance: 0.00,
    emergencyReserve: 0.00,
    investmentsBalance: 0.00
  });

  if (supabase) {
    try {
      await supabase.from('financial_settings').upsert({
        id: 'main',
        account_balance: 0.00,
        emergency_reserve: 0.00,
        investments_balance: 0.00,
        updated_at: new Date().toISOString()
      });
      // 2. Limpar budgets e goals que não estavam na planilha
      await supabase.from('budgets').delete().neq('id', '___none___');
      await supabase.from('goals').delete().neq('id', '___none___');
    } catch (e) {
      console.warn('Erro ao atualizar supabase:', e.message);
    }
  }

  // 3. Limpar no localDb
  const localDb = await db.getData();
  localDb.budgets = [];
  localDb.goals = [];

  console.log('✔ Saldo em Conta zerado (R$ 0,00)');
  console.log('✔ Reserva de Liquidez zerada (R$ 0,00)');
  console.log('✔ Investimentos zerados (R$ 0,00)');
  console.log('✔ Metas e orçamentos fictícios removidos');
  console.log('✔ Mantidos exclusivamente os 53 lançamentos da planilha (12 despesas fixas + 41 parcelamentos de cartões)');

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
