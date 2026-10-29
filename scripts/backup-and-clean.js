require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const BACKUPS_DIR = path.join(__dirname, '..', 'backups');
const DATA_DIR = path.join(__dirname, '..', 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(BACKUPS_DIR)) {
  fs.mkdirSync(BACKUPS_DIR, { recursive: true });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[ERRO] SUPABASE_URL ou SUPABASE_KEY não configuradas no .env!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Helper function to fetch all rows with pagination (bypasses Supabase 1000 rows limit)
async function fetchAllRows(tableName, orderBy = null) {
  const PAGE_SIZE = 1000;
  let allRows = [];
  let page = 0;

  while (true) {
    let query = supabase.from(tableName).select('*').range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (orderBy) {
      query = query.order(orderBy.column, { ascending: orderBy.ascending ?? true });
    }
    const { data, error } = await query;
    if (error) {
      throw new Error(`Erro ao buscar dados da tabela ${tableName}: ${error.message}`);
    }
    if (!data || data.length === 0) {
      break;
    }
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) {
      break;
    }
    page++;
  }

  return allRows;
}

// Escape SQL values
function sqlVal(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

function generateSqlInserts(tableName, rows) {
  if (!rows || rows.length === 0) return `-- Tabela ${tableName}: 0 registros\n`;
  const cols = Object.keys(rows[0]);
  const lines = [`-- Registros da tabela ${tableName} (${rows.length} itens)`];
  
  for (const row of rows) {
    const colList = cols.join(', ');
    const valList = cols.map(c => sqlVal(row[c])).join(', ');
    lines.push(`INSERT INTO ${tableName} (${colList}) VALUES (${valList}) ON CONFLICT DO NOTHING;`);
  }
  return lines.join('\n') + '\n\n';
}

async function main() {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, '-');
  const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`;

  console.log('====================================================');
  console.log('   INICIANDO BACKUP COMPLETO E LIMPEZA DA BASE');
  console.log('====================================================\n');

  console.log('1. Coletando dados de todas as tabelas no Supabase...');
  const [
    financial_settings,
    cards,
    installments,
    transactions,
    chat_history,
    budgets,
    goals,
    bills
  ] = await Promise.all([
    fetchAllRows('financial_settings'),
    fetchAllRows('cards'),
    fetchAllRows('installments'),
    fetchAllRows('transactions', { column: 'date', ascending: true }),
    fetchAllRows('chat_history', { column: 'timestamp', ascending: true }),
    fetchAllRows('budgets'),
    fetchAllRows('goals'),
    fetchAllRows('bills')
  ]);

  console.log(`- financial_settings: ${financial_settings.length} linha(s)`);
  console.log(`- cards: ${cards.length} cartões`);
  console.log(`- installments: ${installments.length} compras parceladas`);
  console.log(`- transactions: ${transactions.length} transações`);
  console.log(`- chat_history: ${chat_history.length} mensagens`);
  console.log(`- budgets: ${budgets.length} tetos orçamentários`);
  console.log(`- goals: ${goals.length} metas`);
  console.log(`- bills: ${bills.length} contas`);

  // Local database.json backup
  let localDbContent = null;
  if (fs.existsSync(LOCAL_DB_FILE)) {
    try {
      localDbContent = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
      console.log(`- database.json local lido com sucesso.`);
    } catch (e) {
      console.warn(`- Aviso ao ler database.json local: ${e.message}`);
    }
  }

  // Backup object
  const backupData = {
    metadata: {
      createdAt: now.toISOString(),
      label: `Backup completo antes de limpar a base`,
      counts: {
        financial_settings: financial_settings.length,
        cards: cards.length,
        installments: installments.length,
        transactions: transactions.length,
        chat_history: chat_history.length,
        budgets: budgets.length,
        goals: goals.length,
        bills: bills.length
      }
    },
    tables: {
      financial_settings,
      cards,
      installments,
      transactions,
      chat_history,
      budgets,
      goals,
      bills
    },
    localDatabaseJson: localDbContent
  };

  // 2. Salvar arquivos de backup
  console.log('\n2. Salvando arquivos de backup no diretório /backups...');
  const jsonBackupFile = path.join(BACKUPS_DIR, `backup_${dateFormatted}.json`);
  const latestJsonFile = path.join(BACKUPS_DIR, `backup_latest.json`);
  fs.writeFileSync(jsonBackupFile, JSON.stringify(backupData, null, 2), 'utf8');
  fs.writeFileSync(latestJsonFile, JSON.stringify(backupData, null, 2), 'utf8');
  console.log(`✔ Arquivo JSON salvo em: ${jsonBackupFile}`);
  console.log(`✔ Cópia de conveniência salva em: ${latestJsonFile}`);

  // Cópia do database.json se existir
  if (localDbContent) {
    const localDbBackupFile = path.join(BACKUPS_DIR, `database_local_${dateFormatted}.json`);
    fs.writeFileSync(localDbBackupFile, JSON.stringify(localDbContent, null, 2), 'utf8');
    console.log(`✔ Backup local salvo em: ${localDbBackupFile}`);
  }

  // Gerar script SQL de restauração
  let sqlContent = `-- ==========================================================================\n`;
  sqlContent += `-- SCRIPT DE RESTAURAÇÃO SUPABASE - CRIADO EM ${now.toLocaleString('pt-BR')}\n`;
  sqlContent += `-- Execute no SQL Editor do Supabase se desejar restaurar manualmente via SQL\n`;
  sqlContent += `-- ==========================================================================\n\n`;
  sqlContent += generateSqlInserts('cards', cards);
  sqlContent += generateSqlInserts('installments', installments);
  sqlContent += generateSqlInserts('transactions', transactions);
  sqlContent += generateSqlInserts('bills', bills);
  sqlContent += generateSqlInserts('budgets', budgets);
  sqlContent += generateSqlInserts('goals', goals);
  sqlContent += generateSqlInserts('chat_history', chat_history);
  if (financial_settings.length > 0) {
    const s = financial_settings[0];
    sqlContent += `-- Configurações financeiras e saldos\n`;
    sqlContent += `UPDATE financial_settings SET account_balance = ${s.account_balance || 0}, emergency_reserve = ${s.emergency_reserve || 0}, investments_balance = ${s.investments_balance || 0} WHERE id = 'main';\n\n`;
  }

  const sqlBackupFile = path.join(BACKUPS_DIR, `restore_backup_${dateFormatted}.sql`);
  const latestSqlFile = path.join(BACKUPS_DIR, `restore_backup_latest.sql`);
  fs.writeFileSync(sqlBackupFile, sqlContent, 'utf8');
  fs.writeFileSync(latestSqlFile, sqlContent, 'utf8');
  console.log(`✔ Script SQL de restauração salvo em: ${sqlBackupFile}`);

  // 3. Limpar base de dados
  console.log('\n3. Executando limpeza dos dados no Supabase e no arquivo local...');

  // Supabase delete order (respecting foreign keys: transactions -> installments -> cards)
  // Delete transactions
  const { error: errTx } = await supabase.from('transactions').delete().neq('id', '___non_existent___');
  if (errTx) console.error('Erro ao limpar transactions:', errTx.message);
  else console.log('✔ Tabela transactions limpa.');

  // Delete installments
  const { error: errInst } = await supabase.from('installments').delete().neq('id', '___non_existent___');
  if (errInst) console.error('Erro ao limpar installments:', errInst.message);
  else console.log('✔ Tabela installments limpa.');

  // Delete cards
  const { error: errCards } = await supabase.from('cards').delete().neq('id', '___non_existent___');
  if (errCards) console.error('Erro ao limpar cards:', errCards.message);
  else console.log('✔ Tabela cards limpa.');

  // Delete bills
  const { error: errBills } = await supabase.from('bills').delete().neq('id', '___non_existent___');
  if (errBills) console.error('Erro ao limpar bills:', errBills.message);
  else console.log('✔ Tabela bills limpa.');

  // Delete budgets
  const { error: errBudgets } = await supabase.from('budgets').delete().neq('id', '___non_existent___');
  if (errBudgets) console.error('Erro ao limpar budgets:', errBudgets.message);
  else console.log('✔ Tabela budgets limpa.');

  // Delete goals
  const { error: errGoals } = await supabase.from('goals').delete().neq('id', '___non_existent___');
  if (errGoals) console.error('Erro ao limpar goals:', errGoals.message);
  else console.log('✔ Tabela goals limpa.');

  // Delete chat_history
  const { error: errChat } = await supabase.from('chat_history').delete().neq('id', '___non_existent___');
  if (errChat) console.error('Erro ao limpar chat_history:', errChat.message);
  else console.log('✔ Tabela chat_history limpa.');

  // Reset financial_settings balances to 0
  const { error: errSettings } = await supabase.from('financial_settings').update({
    account_balance: 0,
    emergency_reserve: 0,
    investments_balance: 0,
    updated_at: new Date().toISOString()
  }).eq('id', 'main');
  if (errSettings) console.error('Erro ao zerar saldos em financial_settings:', errSettings.message);
  else console.log('✔ Saldos zerados em financial_settings (Saldo Conta: 0, Reserva: 0, Investimentos: 0).');

  // Limpar local database.json (preservando loginPassword, userProfile, loginUsername, alerts)
  if (localDbContent) {
    const cleanLocalDb = {
      accountBalance: 0,
      emergencyReserve: 0,
      investmentsBalance: 0,
      alertDueDates: localDbContent.alertDueDates ?? true,
      alertBudgetLimit: localDbContent.alertBudgetLimit ?? true,
      alertWeeklyReport: localDbContent.alertWeeklyReport ?? true,
      cards: [],
      installments: [],
      transactions: [],
      chatHistory: [],
      budgets: [],
      goals: [],
      bills: [],
      loginPassword: localDbContent.loginPassword,
      userProfile: localDbContent.userProfile,
      loginUsername: localDbContent.loginUsername
    };
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(cleanLocalDb, null, 2), 'utf8');
    console.log('✔ Arquivo local data/database.json limpo (credenciais e configurações de usuário mantidas).');
  }

  // 4. Verificação pós-limpeza
  console.log('\n4. Verificando estado atual pós-limpeza...');
  const [cCards, cInst, cTx, cChat, cBills] = await Promise.all([
    supabase.from('cards').select('*', { count: 'exact', head: true }),
    supabase.from('installments').select('*', { count: 'exact', head: true }),
    supabase.from('transactions').select('*', { count: 'exact', head: true }),
    supabase.from('chat_history').select('*', { count: 'exact', head: true }),
    supabase.from('bills').select('*', { count: 'exact', head: true })
  ]);

  console.log('Contagens atuais no Supabase:');
  console.log(`- Cards: ${cCards.count}`);
  console.log(`- Installments: ${cInst.count}`);
  console.log(`- Transactions: ${cTx.count}`);
  console.log(`- Chat History: ${cChat.count}`);
  console.log(`- Bills: ${cBills.count}`);

  console.log('\n====================================================');
  console.log('  PROCESSO CONCLUÍDO COM SUCESSO!');
  console.log('  Todos os seus dados foram preservados e estão em:');
  console.log(`  📂 ${BACKUPS_DIR}`);
  console.log('====================================================');
}

main().catch(err => {
  console.error('\n[FALHA FATAL]:', err);
  process.exit(1);
});
