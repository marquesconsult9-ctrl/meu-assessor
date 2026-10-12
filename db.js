// ==========================================================================
// UNIVERSAL DATABASE ADAPTER (SUPABASE POSTGRESQL + LOCAL JSON FALLBACK)
// ==========================================================================

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const LOCAL_DB_FILE = path.join(DATA_DIR, 'database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);

let supabase = null;
if (isSupabaseConfigured) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('[Database] Conectado com sucesso ao Supabase PostgreSQL na nuvem!');
  } catch (err) {
    console.error('[Database] Erro ao inicializar Supabase:', err);
    supabase = null;
  }
} else {
  console.log('[Database] Supabase não configurado no .env. Utilizando banco local (data/database.json).');
}

// Local In-Memory Store
let localDb = {
  accountBalance: 4580.50,
  cards: [],
  installments: [],
  transactions: [],
  chatHistory: []
};

function readLocalDb() {
  if (fs.existsSync(LOCAL_DB_FILE)) {
    try {
      localDb = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
    } catch (e) {
      console.error('Error reading local database:', e);
    }
  }
}

function writeLocalDb() {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(localDb, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing local database:', e);
  }
}

readLocalDb();

// Unified Interface
async function getData() {
  if (supabase) {
    try {
      const [settingsRes, cardsRes, instRes, txRes, chatRes] = await Promise.all([
        supabase.from('financial_settings').select('account_balance').eq('id', 'main').single(),
        supabase.from('cards').select('*'),
        supabase.from('installments').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('chat_history').select('*').order('timestamp', { ascending: true })
      ]);

      const balance = settingsRes.data ? Number(settingsRes.data.account_balance) : 0;

      const cards = (cardsRes.data || []).map(c => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        last4: c.last4,
        color: c.color,
        limitTotal: Number(c.limit_total),
        closingDay: c.closing_day,
        dueDay: c.due_day
      }));

      const installments = (instRes.data || []).map(i => ({
        id: i.id,
        cardId: i.card_id,
        description: i.description,
        category: i.category,
        totalAmount: Number(i.total_amount),
        installmentAmount: Number(i.installment_amount),
        totalInstallments: i.total_installments,
        currentInstallment: i.current_installment,
        startMonth: i.start_month,
        endMonth: i.end_month
      }));

      const transactions = (txRes.data || []).map(t => ({
        id: t.id,
        description: t.description,
        type: t.type,
        amount: Number(t.amount),
        category: t.category,
        paymentMethod: t.payment_method,
        cardId: t.card_id,
        isInstallment: t.is_installment,
        installmentId: t.installment_id,
        date: t.date,
        source: t.source
      }));

      const chatHistory = (chatRes.data || []).map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp
      }));

      return {
        accountBalance: balance,
        cards,
        installments,
        transactions,
        chatHistory
      };
    } catch (err) {
      console.error('Supabase query error, falling back to local store:', err);
    }
  }

  return localDb;
}

async function updateBalance(newBalance) {
  if (supabase) {
    try {
      await supabase
        .from('financial_settings')
        .upsert({ id: 'main', account_balance: newBalance, updated_at: new Date().toISOString() });
    } catch (e) {
      console.error('Supabase update balance error:', e);
    }
  }
  localDb.accountBalance = newBalance;
  writeLocalDb();
}

async function addTransaction(tx) {
  if (supabase) {
    try {
      await supabase.from('transactions').insert({
        id: tx.id,
        description: tx.description,
        type: tx.type,
        amount: tx.amount,
        category: tx.category,
        payment_method: tx.paymentMethod,
        card_id: tx.cardId || null,
        is_installment: tx.isInstallment || false,
        installment_id: tx.installmentId || null,
        date: tx.date || new Date().toISOString(),
        source: tx.source || 'WHATSAPP'
      });
    } catch (e) {
      console.error('Supabase insert transaction error:', e);
    }
  }
  localDb.transactions.unshift(tx);
  writeLocalDb();
}

async function deleteTransaction(id) {
  if (supabase) {
    try {
      await supabase.from('transactions').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase delete transaction error:', e);
    }
  }
  localDb.transactions = localDb.transactions.filter(t => t.id !== id);
  writeLocalDb();
}

async function addInstallment(inst) {
  if (supabase) {
    try {
      await supabase.from('installments').insert({
        id: inst.id,
        card_id: inst.cardId,
        description: inst.description,
        category: inst.category,
        total_amount: inst.totalAmount,
        installment_amount: inst.installmentAmount,
        total_installments: inst.totalInstallments,
        current_installment: inst.currentInstallment || 1,
        start_month: inst.startMonth,
        end_month: inst.endMonth
      });
    } catch (e) {
      console.error('Supabase insert installment error:', e);
    }
  }
  localDb.installments.push(inst);
  writeLocalDb();
}

async function deleteInstallment(id) {
  if (supabase) {
    try {
      await supabase.from('installments').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase delete installment error:', e);
    }
  }
  localDb.installments = localDb.installments.filter(i => i.id !== id);
  writeLocalDb();
}

async function addCard(card) {
  if (supabase) {
    try {
      await supabase.from('cards').insert({
        id: card.id,
        name: card.name,
        brand: card.brand,
        last4: card.last4,
        color: card.color,
        limit_total: card.limitTotal,
        closing_day: card.closingDay,
        due_day: card.dueDay
      });
    } catch (e) {
      console.error('Supabase insert card error:', e);
    }
  }
  localDb.cards.push(card);
  writeLocalDb();
}

async function addChatMessage(msg) {
  if (supabase) {
    try {
      await supabase.from('chat_history').insert({
        id: msg.id,
        sender: msg.sender,
        text: msg.text,
        timestamp: msg.timestamp || new Date().toISOString()
      });
    } catch (e) {
      console.error('Supabase insert chat error:', e);
    }
  }
  localDb.chatHistory.push(msg);
  writeLocalDb();
}

module.exports = {
  isSupabaseConfigured: () => Boolean(supabase),
  getData,
  updateBalance,
  addTransaction,
  deleteTransaction,
  addInstallment,
  deleteInstallment,
  addCard,
  addChatMessage
};
