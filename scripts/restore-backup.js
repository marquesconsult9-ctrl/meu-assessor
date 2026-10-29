require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'database.json');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERRO] SUPABASE_URL ou SUPABASE_KEY não configuradas no .env!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper for inserting in chunks to avoid payload limits
async function insertInBatches(tableName, rows, batchSize = 100) {
  if (!rows || rows.length === 0) return;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(tableName).upsert(chunk);
    if (error) {
      console.error(`Erro ao restaurar lote na tabela ${tableName} (offset ${i}):`, error.message);
    }
  }
}

async function main() {
  const targetBackupFile = process.argv[2] 
    ? path.resolve(process.argv[2]) 
    : path.join(BACKUPS_DIR, 'backup_latest.json');

  if (!fs.existsSync(targetBackupFile)) {
    console.error(`[ERRO] Arquivo de backup não encontrado em: ${targetBackupFile}`);
    process.exit(1);
  }

  console.log('====================================================');
  console.log('       INICIANDO RESTAURAÇÃO DE BACKUP');
  console.log('====================================================');
  console.log(`Carregando backup de: ${targetBackupFile}\n`);

  const backup = JSON.parse(fs.readFileSync(targetBackupFile, 'utf8'));
  const { tables, localDatabaseJson, metadata } = backup;

  console.log(`Backup criado em: ${metadata?.createdAt || 'Desconhecido'}`);
  console.log(`Contagens do backup:`, metadata?.counts);

  // 1. Restaurar configurações financeiras
  if (tables.financial_settings && tables.financial_settings.length > 0) {
    console.log('\nRestaurando financial_settings...');
    const s = tables.financial_settings[0];
    await supabase.from('financial_settings').upsert({
      id: 'main',
      account_balance: s.account_balance,
      emergency_reserve: s.emergency_reserve,
      investments_balance: s.investments_balance,
      alert_due_dates: s.alert_due_dates,
      alert_budget_limit: s.alert_budget_limit,
      alert_weekly_report: s.alert_weekly_report,
      updated_at: new Date().toISOString()
    });
    console.log('✔ financial_settings restaurado.');
  }

  // 2. Restaurar cards (necessário antes de installments e transactions)
  if (tables.cards && tables.cards.length > 0) {
    console.log(`Restaurando ${tables.cards.length} cartões...`);
    await insertInBatches('cards', tables.cards);
    console.log('✔ cards restaurados.');
  }

  // 3. Restaurar installments (necessário antes de transactions vinculadas)
  if (tables.installments && tables.installments.length > 0) {
    console.log(`Restaurando ${tables.installments.length} compras parceladas...`);
    await insertInBatches('installments', tables.installments);
    console.log('✔ installments restaurados.');
  }

  // 4. Restaurar transactions
  if (tables.transactions && tables.transactions.length > 0) {
    console.log(`Restaurando ${tables.transactions.length} transações...`);
    await insertInBatches('transactions', tables.transactions);
    console.log('✔ transactions restauradas.');
  }

  // 5. Restaurar bills
  if (tables.bills && tables.bills.length > 0) {
    console.log(`Restaurando ${tables.bills.length} contas...`);
    await insertInBatches('bills', tables.bills);
    console.log('✔ bills restaurados.');
  }

  // 6. Restaurar budgets
  if (tables.budgets && tables.budgets.length > 0) {
    console.log(`Restaurando ${tables.budgets.length} orçamentos...`);
    await insertInBatches('budgets', tables.budgets);
    console.log('✔ budgets restaurados.');
  }

  // 7. Restaurar goals
  if (tables.goals && tables.goals.length > 0) {
    console.log(`Restaurando ${tables.goals.length} metas...`);
    await insertInBatches('goals', tables.goals);
    console.log('✔ goals restauradas.');
  }

  // 8. Restaurar chat_history
  if (tables.chat_history && tables.chat_history.length > 0) {
    console.log(`Restaurando ${tables.chat_history.length} mensagens do chat...`);
    await insertInBatches('chat_history', tables.chat_history, 200);
    console.log('✔ chat_history restaurado.');
  }

  // 9. Restaurar database.json local
  if (localDatabaseJson) {
    console.log('\nRestaurando data/database.json local...');
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDatabaseJson, null, 2), 'utf8');
    console.log('✔ database.json local restaurado.');
  }

  console.log('\n====================================================');
  console.log('  RESTAURAÇÃO CONCLUÍDA COM SUCESSO!');
  console.log('====================================================');
}

main().catch(err => {
  console.error('\n[FALHA NA RESTAURAÇÃO]:', err);
  process.exit(1);
});
