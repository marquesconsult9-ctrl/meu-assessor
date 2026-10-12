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
  emergencyReserve: 1832.20,
  investmentsBalance: 1603.17,
  alertDueDates: true,
  alertBudgetLimit: true,
  alertWeeklyReport: true,
  cards: [],
  installments: [],
  transactions: [],
  chatHistory: [],
  budgets: [
    { id: 'orc-1', category: 'Operacional', monthlyLimit: 3000.00, spentAmount: 1650.00 },
    { id: 'orc-2', category: 'Tecnologia & Software', monthlyLimit: 1200.00, spentAmount: 540.00 },
    { id: 'orc-3', category: 'Logística & Transporte', monthlyLimit: 2000.00, spentAmount: 1200.00 }
  ],
  goals: [
    { id: 'goal-1', title: 'Aporte Imobiliário', targetAmount: 50000.00, currentAmount: 40500.00, deadlineDate: '2027-12-31' },
    { id: 'goal-2', title: 'Renovação de Veículo', targetAmount: 45500.00, currentAmount: 36400.00, deadlineDate: '2027-06-30' }
  ],
  bills: [
    { id: 'bill-p1', description: 'Energia Elétrica (Enel)', amount: 185.40, dueDate: '2026-10-10', type: 'PAY', isPaid: false },
    { id: 'bill-p2', description: 'Internet Fibra', amount: 129.90, dueDate: '2026-10-15', type: 'PAY', isPaid: false },
    { id: 'bill-p3', description: 'Aluguel & Condomínio', amount: 2200.00, dueDate: '2026-10-20', type: 'PAY', isPaid: false },
    { id: 'bill-p4', description: 'Fatura Nubank Ultravioleta', amount: 960.00, dueDate: '2026-10-24', type: 'PAY', isPaid: false },
    { id: 'bill-r1', description: 'Salário Mensal', amount: 8500.00, dueDate: '2026-10-05', type: 'RECEIVE', isPaid: true },
    { id: 'bill-r2', description: 'Consultoria Financeira', amount: 1500.00, dueDate: '2026-10-12', type: 'RECEIVE', isPaid: false },
    { id: 'bill-r3', description: 'Dividendos & Rendimentos', amount: 480.00, dueDate: '2026-10-28', type: 'RECEIVE', isPaid: false }
  ]
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
        supabase.from('financial_settings').select('*').eq('id', 'main').single().catch(() => ({ data: null })),
        supabase.from('cards').select('*').catch(() => ({ data: [] })),
        supabase.from('installments').select('*').catch(() => ({ data: [] })),
        supabase.from('transactions').select('*').order('date', { ascending: false }).catch(() => ({ data: [] })),
        supabase.from('chat_history').select('*').order('timestamp', { ascending: true }).catch(() => ({ data: [] })),
        supabase.from('budgets').select('*').order('created_at', { ascending: true }).catch(() => ({ data: [] })),
        supabase.from('goals').select('*').order('created_at', { ascending: true }).catch(() => ({ data: [] })),
        supabase.from('bills').select('*').order('due_date', { ascending: true }).catch(() => ({ data: [] }))
      ]);

      const balance = settingsRes.data ? Number(settingsRes.data.account_balance) : (localDb.accountBalance || 0);
      const emergencyReserve = settingsRes.data && settingsRes.data.emergency_reserve != null 
        ? Number(settingsRes.data.emergency_reserve) 
        : (localDb.emergencyReserve || 1832.20);
      const investmentsBalance = settingsRes.data && settingsRes.data.investments_balance != null 
        ? Number(settingsRes.data.investments_balance) 
        : (localDb.investmentsBalance || 1603.17);

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
        cards: cards.length > 0 ? cards : localDb.cards,
        installments: installments.length > 0 ? installments : localDb.installments,
        transactions: transactions.length > 0 ? transactions : localDb.transactions,
        chatHistory: chatHistory.length > 0 ? chatHistory : localDb.chatHistory,
        budgets: budgets.length > 0 ? budgets : (localDb.budgets || []),
        goals: goals.length > 0 ? goals : (localDb.goals || []),
        bills: bills.length > 0 ? bills : (localDb.bills || [])
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
