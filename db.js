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
  accountBalance: 0,
  emergencyReserve: 0,
  investmentsBalance: 0,
  alertDueDates: true,
  alertBudgetLimit: true,
  alertWeeklyReport: true,
  cards: [],
  installments: [],
  transactions: [],
  chatHistory: [],
  budgets: [],
  goals: [],
  bills: []
};

function readLocalDb() {
  if (fs.existsSync(LOCAL_DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(LOCAL_DB_FILE, 'utf8'));
      localDb = { ...localDb, ...data };
      if (!localDb.budgets) localDb.budgets = [];
      if (!localDb.goals) localDb.goals = [];
      if (!localDb.bills) localDb.bills = [];
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
      const [settingsRes, cardsRes, instRes, txRes, chatRes, budgetsRes, goalsRes, billsRes] = await Promise.all([
        supabase.from('financial_settings').select('*').eq('id', 'main').single(),
        supabase.from('cards').select('*'),
        supabase.from('installments').select('*'),
        supabase.from('transactions').select('*').order('date', { ascending: false }),
        supabase.from('chat_history').select('*').order('timestamp', { ascending: true }),
        supabase.from('budgets').select('*').order('created_at', { ascending: true }),
        supabase.from('goals').select('*').order('created_at', { ascending: true }),
        supabase.from('bills').select('*').order('due_date', { ascending: true })
      ]);

      const balance = settingsRes.data ? Number(settingsRes.data.account_balance || 0) : Number(localDb.accountBalance || 0);
      const emergencyReserve = settingsRes.data && settingsRes.data.emergency_reserve != null 
        ? Number(settingsRes.data.emergency_reserve) 
        : Number(localDb.emergencyReserve || 0);
      const investmentsBalance = settingsRes.data && settingsRes.data.investments_balance != null 
        ? Number(settingsRes.data.investments_balance) 
        : Number(localDb.investmentsBalance || 0);

      const cards = ((cardsRes && cardsRes.data) || []).map(c => ({
        id: c.id,
        name: c.name,
        brand: c.brand,
        last4: c.last4,
        color: c.color,
        limitTotal: Number(c.limit_total),
        closingDay: c.closing_day,
        dueDay: c.due_day
      }));

      const installments = ((instRes && instRes.data) || []).map(i => ({
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

      const transactions = ((txRes && txRes.data) || []).map(t => ({
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

      const chatHistory = ((chatRes && chatRes.data) || []).map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp
      }));

      const budgets = ((budgetsRes && budgetsRes.data) || []).map(b => ({
        id: b.id,
        category: b.category,
        monthlyLimit: Number(b.monthly_limit),
        spentAmount: Number(b.spent_amount || 0)
      }));

      const goals = ((goalsRes && goalsRes.data) || []).map(g => ({
        id: g.id,
        title: g.title,
        targetAmount: Number(g.target_amount),
        currentAmount: Number(g.current_amount || 0),
        deadlineDate: g.deadline_date
      }));

      const bills = ((billsRes && billsRes.data) || []).map(b => ({
        id: b.id,
        description: b.description,
        amount: Number(b.amount),
        dueDate: b.due_date,
        type: b.type,
        isPaid: Boolean(b.is_paid)
      }));

      return {
        accountBalance: balance,
        emergencyReserve,
        investmentsBalance,
        settings: {
          accountBalance: balance,
          emergencyReserve,
          investmentsBalance,
          alertDueDates: settingsRes.data ? settingsRes.data.alert_due_dates !== false : true,
          alertBudgetLimit: settingsRes.data ? settingsRes.data.alert_budget_limit !== false : true,
          alertWeeklyReport: settingsRes.data ? settingsRes.data.alert_weekly_report !== false : true
        },
        cards: Array.isArray(cardsRes?.data) ? cards : localDb.cards,
        installments: Array.isArray(instRes?.data) ? installments : localDb.installments,
        transactions: Array.isArray(txRes?.data) ? transactions : localDb.transactions,
        chatHistory: Array.isArray(chatRes?.data) ? chatHistory : localDb.chatHistory,
        budgets: Array.isArray(budgetsRes?.data) ? budgets : (localDb.budgets || []),
        goals: Array.isArray(goalsRes?.data) ? goals : (localDb.goals || []),
        bills: Array.isArray(billsRes?.data) ? bills : (localDb.bills || [])
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

async function updateSettings(updates) {
  if (supabase) {
    try {
      const payload = { id: 'main', updated_at: new Date().toISOString() };
      if (updates.accountBalance !== undefined) payload.account_balance = updates.accountBalance;
      if (updates.emergencyReserve !== undefined) payload.emergency_reserve = updates.emergencyReserve;
      if (updates.investmentsBalance !== undefined) payload.investments_balance = updates.investmentsBalance;
      if (updates.alertDueDates !== undefined) payload.alert_due_dates = updates.alertDueDates;
      if (updates.alertBudgetLimit !== undefined) payload.alert_budget_limit = updates.alertBudgetLimit;
      if (updates.alertWeeklyReport !== undefined) payload.alert_weekly_report = updates.alertWeeklyReport;

      await supabase.from('financial_settings').upsert(payload);
    } catch (e) {
      console.error('Supabase update settings error:', e);
    }
  }
  localDb = { ...localDb, ...updates };
  writeLocalDb();
  return localDb;
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

// ============================================================================
// BUDGETS (TETOS ORÇAMENTÁRIOS)
// ============================================================================
async function addBudget(budget) {
  if (supabase) {
    try {
      await supabase.from('budgets').insert({
        id: budget.id,
        category: budget.category,
        monthly_limit: budget.monthlyLimit,
        spent_amount: budget.spentAmount || 0
      });
    } catch (e) {
      console.error('Supabase insert budget error:', e);
    }
  }
  if (!localDb.budgets) localDb.budgets = [];
  localDb.budgets.push(budget);
  writeLocalDb();
  return budget;
}

async function deleteBudget(id) {
  if (supabase) {
    try {
      await supabase.from('budgets').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase delete budget error:', e);
    }
  }
  if (localDb.budgets) {
    localDb.budgets = localDb.budgets.filter(b => b.id !== id);
    writeLocalDb();
  }
}

// ============================================================================
// GOALS (METAS ESTRATÉGICAS)
// ============================================================================
async function addGoal(goal) {
  if (supabase) {
    try {
      await supabase.from('goals').insert({
        id: goal.id,
        title: goal.title,
        target_amount: goal.targetAmount,
        current_amount: goal.currentAmount || 0,
        deadline_date: goal.deadlineDate || null
      });
    } catch (e) {
      console.error('Supabase insert goal error:', e);
    }
  }
  if (!localDb.goals) localDb.goals = [];
  localDb.goals.push(goal);
  writeLocalDb();
  return goal;
}

async function updateGoal(id, updates) {
  if (supabase) {
    try {
      const payload = {};
      if (updates.title) payload.title = updates.title;
      if (updates.targetAmount) payload.target_amount = updates.targetAmount;
      if (updates.currentAmount !== undefined) payload.current_amount = updates.currentAmount;
      if (updates.deadlineDate) payload.deadline_date = updates.deadlineDate;
      await supabase.from('goals').update(payload).eq('id', id);
    } catch (e) {
      console.error('Supabase update goal error:', e);
    }
  }
  if (localDb.goals) {
    const g = localDb.goals.find(item => item.id === id);
    if (g) Object.assign(g, updates);
    writeLocalDb();
  }
}

async function deleteGoal(id) {
  if (supabase) {
    try {
      await supabase.from('goals').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase delete goal error:', e);
    }
  }
  if (localDb.goals) {
    localDb.goals = localDb.goals.filter(g => g.id !== id);
    writeLocalDb();
  }
}

// ============================================================================
// BILLS (CONTAS A PAGAR E RECEBER)
// ============================================================================
async function addBill(bill) {
  if (supabase) {
    try {
      await supabase.from('bills').insert({
        id: bill.id,
        description: bill.description,
        amount: bill.amount,
        due_date: bill.dueDate,
        type: bill.type,
        is_paid: Boolean(bill.isPaid)
      });
    } catch (e) {
      console.error('Supabase insert bill error:', e);
    }
  }
  if (!localDb.bills) localDb.bills = [];
  localDb.bills.push(bill);
  writeLocalDb();
  return bill;
}

async function toggleBill(id, isPaid) {
  if (supabase) {
    try {
      await supabase.from('bills').update({ is_paid: isPaid }).eq('id', id);
    } catch (e) {
      console.error('Supabase toggle bill error:', e);
    }
  }
  if (localDb.bills) {
    const b = localDb.bills.find(item => item.id === id);
    if (b) b.isPaid = isPaid;
    writeLocalDb();
  }
}

async function payAllBills() {
  if (supabase) {
    try {
      await supabase.from('bills').update({ is_paid: true }).eq('type', 'PAY');
    } catch (e) {
      console.error('Supabase pay all error:', e);
    }
  }
  if (localDb.bills) {
    localDb.bills.filter(b => b.type === 'PAY').forEach(b => b.isPaid = true);
    writeLocalDb();
  }
}

async function receiveAllBills() {
  if (supabase) {
    try {
      await supabase.from('bills').update({ is_paid: true }).eq('type', 'RECEIVE');
    } catch (e) {
      console.error('Supabase receive all error:', e);
    }
  }
  if (localDb.bills) {
    localDb.bills.filter(b => b.type === 'RECEIVE').forEach(b => b.isPaid = true);
    writeLocalDb();
  }
}

async function deleteBill(id) {
  if (supabase) {
    try {
      await supabase.from('bills').delete().eq('id', id);
    } catch (e) {
      console.error('Supabase delete bill error:', e);
    }
  }
  if (localDb.bills) {
    localDb.bills = localDb.bills.filter(b => b.id !== id);
    writeLocalDb();
  }
}

module.exports = {
  isSupabaseConfigured: () => Boolean(supabase),
  getData,
  updateBalance,
  updateSettings,
  addTransaction,
  deleteTransaction,
  addInstallment,
  deleteInstallment,
  addCard,
  addChatMessage,
  addBudget,
  deleteBudget,
  addGoal,
  updateGoal,
  deleteGoal,
  addBill,
  toggleBill,
  payAllBills,
  receiveAllBills,
  deleteBill
};
