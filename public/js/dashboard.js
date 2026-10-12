// ==========================================================================
// LANÇEI • DASHBOARD, CALCULATOR, CHARTS & WHATSAPP ENGINE
// ==========================================================================

let currentFinancialData = null;
let currentProjectionData = null;
let currentTransactions = [];
let currentChatMessages = [];
let currentWhatsAppStatus = { status: 'DISCONNECTED' };

let isPrivacyMode = false;
let currentFilter = 'todos';
let calcExpression = '10+4';

// Sample Bills for Pagar / A Receber (Matches Images 3 & 4)
let billsToPay = [
  { id: 'p1', date: '10/10', desc: 'Energia Elétrica (Enel)', amount: 185.40, paid: false },
  { id: 'p2', date: '15/10', desc: 'Internet Fibra', amount: 129.90, paid: false },
  { id: 'p3', date: '20/10', desc: 'Aluguel & Condomínio', amount: 2200.00, paid: false },
  { id: 'p4', date: '24/10', desc: 'Fatura Nubank Ultravioleta', amount: 960.00, paid: false }
];

let billsToReceive = [
  { id: 'r1', date: '05/10', desc: 'Salário Mensal', amount: 8500.00, received: true },
  { id: 'r2', date: '12/10', desc: 'Consultoria Financeira', amount: 1500.00, received: false },
  { id: 'r3', date: '28/10', desc: 'Dividendos & Rendimentos', amount: 480.00, received: false }
];

// Helper: Currency Formatter with Privacy toggle
function formatCurrency(val) {
  if (isPrivacyMode) return '••••••';
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// Toast helper
window.showToast = function(msg, icon = '⚡') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.style.cssText = 'background: #111928; border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 12px 18px; color: #fff; font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 10px; box-shadow: 0 10px 25px rgba(0,0,0,0.5); animation: fadeIn 0.2s ease;';
  t.innerHTML = `<span style="font-size: 16px;">${icon}</span> <span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, 3500);
};

// Document Init
document.addEventListener('DOMContentLoaded', async () => {
  initTabsNavigation();
  initHeaderTools();
  initCalculator();
  initCalendar();
  initModals();
  initChatInput();
  initWhatsAppQRControls();
  initRealtimeSSE();

  // Load initial theme from localStorage
  const savedTheme = localStorage.getItem('mi-theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = '☀️';
  }

  // Load financial data from API
  await refreshAllData();
  await checkWhatsAppStatus();

  renderBillsLists();
  renderBarsChart();
  renderDonutChart();
  renderMetaTimelineChart();
});

// ==========================================================================
// TABS NAVIGATION & HEADER
// ==========================================================================
function initTabsNavigation() {
  const navLinks = document.querySelectorAll('.app-sidebar .nav-link[data-tab]');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = link.getAttribute('data-tab');
      navigateToTab(tabId);
    });
  });
}

window.navigateToTab = function(tabId) {
  // Update sidebar active state
  document.querySelectorAll('.app-sidebar .nav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('data-tab') === tabId);
  });

  // Switch content panes
  document.querySelectorAll('.tab-content-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const activePane = document.getElementById(tabId);
  if (activePane) activePane.classList.add('active');

  // Update topbar title
  const titles = {
    'tab-dashboard': 'Dashboard',
    'tab-lancamentos': 'Lançamentos',
    'tab-planejamento': 'Planejamento',
    'tab-open-finance': 'Open Finance & Cartões',
    'tab-whatsapp': 'WhatsApp 24/7 & Assistente',
    'tab-settings': 'Meu Perfil & Configurações'
  };
  const titleEl = document.getElementById('topbar-title');
  if (titleEl && titles[tabId]) titleEl.textContent = titles[tabId];
};

function initHeaderTools() {
  // Privacy Toggle
  const btnPrivacy = document.getElementById('btn-toggle-privacy');
  if (btnPrivacy) {
    btnPrivacy.addEventListener('click', () => {
      isPrivacyMode = !isPrivacyMode;
      btnPrivacy.classList.toggle('active', isPrivacyMode);
      renderAllViews();
      renderBillsLists();
      window.showToast(isPrivacyMode ? 'Valores ocultados por privacidade' : 'Valores visíveis', isPrivacyMode ? '👁️' : '🔓');
    });
  }

  // Theme Switcher (Light / Dark)
  const btnTheme = document.getElementById('btn-toggle-theme');
  const themeIcon = document.getElementById('theme-icon');
  if (btnTheme) {
    btnTheme.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      if (themeIcon) themeIcon.textContent = isLight ? '☀️' : '🌙';
      localStorage.setItem('mi-theme', isLight ? 'light' : 'dark');
      renderBarsChart();
      renderDonutChart();
      renderMetaTimelineChart();
    });
  }

  // Notification button
  const btnNotifs = document.getElementById('btn-toggle-notifs');
  if (btnNotifs) {
    btnNotifs.addEventListener('click', () => {
      window.showToast('Você tem 2 faturas com vencimento nos próximos 10 dias!', '🔔');
    });
  }

  // Saldo tabs in hero card
  const balanceTabs = document.querySelectorAll('.balance-tab-btn');
  balanceTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      balanceTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const btype = tab.getAttribute('data-btype');
      updateHeroBalanceView(btype);
    });
  });
}

function updateHeroBalanceView(btype) {
  const valEl = document.getElementById('dash-metric-balance');
  if (!valEl) return;
  const balance = currentFinancialData ? currentFinancialData.accountBalance : 4580.50;

  if (btype === 'emergencia') {
    valEl.textContent = formatCurrency(balance * 0.4);
  } else if (btype === 'investimento') {
    valEl.textContent = formatCurrency(balance * 0.35);
  } else {
    valEl.textContent = formatCurrency(balance);
  }
}

// ==========================================================================
// DATA REFRESH & REALTIME
// ==========================================================================
async function refreshAllData() {
  try {
    const [finRes, projRes, txRes, chatRes] = await Promise.all([
      fetch('/api/financial/summary').then(r => r.json()),
      fetch('/api/invoices/projection').then(r => r.json()),
      fetch('/api/transactions').then(r => r.json()),
      fetch('/api/chat/messages').then(r => r.json())
    ]);

    if (finRes.success) currentFinancialData = finRes.data;
    if (projRes.success) currentProjectionData = projRes;
    if (txRes.success) currentTransactions = txRes.transactions;
    if (chatRes.success) {
      currentChatMessages = chatRes.messages;
      renderChatMessages();
    }

    renderAllViews();
  } catch (err) {
    console.error('Error fetching data:', err);
  }
}

function initRealtimeSSE() {
  if (window.EventSource) {
    const sse = new EventSource('/api/events');
    sse.addEventListener('financial-updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        currentFinancialData = data;
        renderAllViews();
        window.showToast('Dados atualizados em tempo real!', '🔄');
      } catch (err) { console.error(err); }
    });

    sse.addEventListener('chat-message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.user) appendChatMessage(data.user);
        if (data.assistant) appendChatMessage(data.assistant);
      } catch (err) { console.error(err); }
    });

    sse.addEventListener('whatsapp-status-changed', (e) => {
      try {
        const statusObj = JSON.parse(e.data);
        currentWhatsAppStatus = statusObj;
        renderWhatsAppStatusUI();
      } catch (err) { console.error(err); }
    });
  }
}

// ==========================================================================
// RENDER ALL VIEWS
// ==========================================================================
function renderAllViews() {
  if (!currentFinancialData) return;

  // Top Metrics
  const incomeEl = document.getElementById('dash-metric-income');
  const expenseEl = document.getElementById('dash-metric-expense');
  const balanceEl = document.getElementById('dash-metric-balance');

  if (incomeEl) incomeEl.textContent = formatCurrency(currentFinancialData.currentMonthIncome || 8500);
  if (expenseEl) expenseEl.textContent = formatCurrency((currentFinancialData.currentMonthExpenses || 0) + (currentFinancialData.totalInvoicesCurrent || 1200));
  if (balanceEl) balanceEl.textContent = formatCurrency(currentFinancialData.accountBalance);

  // Render recent mini table
  renderRecentTxTable();
  // Render full table in Lançamentos
  renderFullTransactionsTable();
  // Render sidebar mini cards in Lançamentos
  renderSidebarMiniCards();
  // Render open finance cards
  renderOpenFinanceCards();
}

function renderRecentTxTable() {
  const tbody = document.getElementById('dash-recent-tx-body');
  if (!tbody) return;

  const list = (currentTransactions || []).slice(0, 5);
  if (list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 16px;">Nenhuma transação registrada ainda.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(tx => `
    <tr>
      <td style="color: var(--text-muted);">${formatDate(tx.created_at)}</td>
      <td style="font-weight: 500;">${tx.description || 'Sem descrição'}</td>
      <td class="tx-amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}">
        ${tx.type === 'INCOME' ? '+' : '-'} ${formatCurrency(tx.amount)}
      </td>
    </tr>
  `).join('');
}

function renderFullTransactionsTable() {
  const tbody = document.getElementById('full-transactions-table-body');
  if (!tbody) return;

  const searchVal = (document.getElementById('tx-search-input')?.value || '').toLowerCase();
  let filtered = (currentTransactions || []).filter(tx => {
    if (searchVal && !tx.description.toLowerCase().includes(searchVal)) return false;
    if (currentFilter === 'pagos') return tx.is_paid !== false;
    if (currentFilter === 'agendados') return tx.is_paid === false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">Nenhum lançamento encontrado.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(tx => `
    <tr class="tx-table-row">
      <td style="color: var(--text-muted);">${formatDate(tx.created_at)}</td>
      <td>
        <div class="tx-desc-title">${tx.description}</div>
        <div class="tx-desc-sub">${tx.category || 'Geral'}</div>
      </td>
      <td>${tx.account || 'Conta Principal'}</td>
      <td class="tx-amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}">
        ${tx.type === 'INCOME' ? '+' : '-'} ${formatCurrency(tx.amount)}
      </td>
      <td>
        <div class="tx-actions-group">
          <button class="icon-action-btn" title="Editar" onclick="window.showToast('Edição do lançamento', '✏️')">✏️</button>
          <button class="icon-action-btn" title="Excluir" onclick="deleteTx('${tx.id}')">🗑️</button>
          <span title="Sincronizado Supabase" style="font-size: 13px; color: var(--color-cyan);">☁️</span>
          <button class="icon-action-btn" title="Marcar como pago" style="color: var(--color-success);" onclick="window.showToast('Lançamento confirmado!', '✓')">✓</button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function deleteTx(id) {
  if (!confirm('Deseja realmente remover esta movimentação?')) return;
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.success) {
      window.showToast('Movimentação removida!', '🗑️');
      await refreshAllData();
    }
  } catch (err) {
    console.error(err);
  }
}

// Mini Cards in Lançamentos sidebar (Image 6)
function renderSidebarMiniCards() {
  const container = document.getElementById('sidebar-mini-cards-list');
  if (!container || !currentFinancialData) return;

  const cards = currentFinancialData.cards || [];
  container.innerHTML = cards.map(c => `
    <div class="mini-card-item">
      <div class="mini-card-header">
        <span class="mini-card-name">${c.name}</span>
        <button class="btn-pay-invoice-pill" onclick="window.showToast('Fatura do ${c.name} agendada para pagamento!', '💳')">Pagar fatura</button>
      </div>
      <div class="mini-card-meta">
        <span>Fechamento: Dia ${c.closingDay}</span>
        <span>Vence: Dia ${c.dueDay}</span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
        <span style="font-size: 11px; color: var(--text-muted);">Fatura Atual</span>
        <span class="mini-card-invoice-val">${formatCurrency(c.currentInvoice)}</span>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${c.usedPercentage}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--text-subtle); margin-top: 4px;">
        <span>Usado: ${formatCurrency(c.limitUsed)}</span>
        <span>Disp: ${formatCurrency(c.limitAvailable)}</span>
      </div>
    </div>
  `).join('');
}

function renderOpenFinanceCards() {
  const container = document.getElementById('open-finance-cards-grid');
  if (!container || !currentFinancialData) return;

  const cards = currentFinancialData.cards || [];
  container.innerHTML = cards.map(c => `
    <div class="mi-card" style="border-left: 4px solid var(--color-primary);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span style="font-size: 15px; font-weight: 700;">${c.name}</span>
        <span style="font-size: 11px; color: var(--text-muted);">${c.brand} •••• ${c.last4}</span>
      </div>
      <div style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">${formatCurrency(c.currentInvoice)}</div>
      <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">Fatura aberta • Vencimento dia ${c.dueDay}</div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill" style="width: ${c.usedPercentage}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 8px;">
        <span>Limite Total: ${formatCurrency(c.limitTotal)}</span>
        <span>Disponível: ${formatCurrency(c.limitAvailable)}</span>
      </div>
    </div>
  `).join('');

  // Update Projection Finish Badge
  const finishBadge = document.getElementById('open-finance-finish-badge');
  if (finishBadge && currentProjectionData) {
    finishBadge.textContent = `🏁 Faturas quitadas em: ${currentProjectionData.finishMonthFormatted || 'Julho de 2027'}`;
  }

  // Render projection bars in Open Finance
  const barsContainer = document.getElementById('open-finance-bars-container');
  if (barsContainer && currentProjectionData && currentProjectionData.projection) {
    const months = currentProjectionData.projection.months || [];
    const maxVal = Math.max(...months.map(m => m.total), 1);
    barsContainer.innerHTML = months.map(m => {
      const hPct = Math.round((m.total / maxVal) * 100);
      return `
        <div style="flex: 1; min-width: 44px; display: flex; flex-direction: column; align-items: center; gap: 6px;">
          <span style="font-size: 10px; font-weight: 700; color: var(--text-muted);">${formatCurrency(m.total)}</span>
          <div style="width: 100%; height: 120px; display: flex; align-items: flex-end; justify-content: center;">
            <div style="width: 24px; height: ${Math.max(hPct, 6)}%; background: var(--color-primary-gradient); border-radius: 4px 4px 0 0; transition: height 0.4s ease;" title="${m.monthLabel}: ${formatCurrency(m.total)}"></div>
          </div>
          <span style="font-size: 10px; color: var(--text-subtle);">${m.shortLabel}</span>
        </div>
      `;
    }).join('');
  }
}

// ==========================================================================
// BILLS WIDGETS (PAGAR & A RECEBER - Images 3 & 4)
// ==========================================================================
function renderBillsLists() {
  const pagarBox = document.getElementById('dash-pagar-container');
  const receberBox = document.getElementById('dash-receber-container');

  if (pagarBox) {
    pagarBox.innerHTML = billsToPay.map(b => `
      <div class="action-bill-row">
        <span class="bill-date">${b.date}</span>
        <span class="bill-desc">${b.desc}</span>
        <span class="bill-val pay">${formatCurrency(b.amount)}</span>
        <div class="check-action-circle ${b.paid ? 'checked' : ''}" onclick="toggleBillPay('${b.id}')">✓</div>
      </div>
    `).join('');
  }

  if (receberBox) {
    receberBox.innerHTML = billsToReceive.map(b => `
      <div class="action-bill-row">
        <span class="bill-date">${b.date}</span>
        <span class="bill-desc">${b.desc}</span>
        <span class="bill-val receive">${formatCurrency(b.amount)}</span>
        <div class="check-action-circle ${b.received ? 'checked' : ''}" onclick="toggleBillReceive('${b.id}')">✓</div>
      </div>
    `).join('');
  }

  // Pagar tudo button
  const btnPayAll = document.getElementById('btn-pay-all');
  if (btnPayAll) {
    btnPayAll.onclick = () => {
      billsToPay.forEach(b => b.paid = true);
      renderBillsLists();
      window.showToast('Todas as contas foram marcadas como pagas!', '💳');
    };
  }

  // Receber tudo button
  const btnReceiveAll = document.getElementById('btn-receive-all');
  if (btnReceiveAll) {
    btnReceiveAll.onclick = () => {
      billsToReceive.forEach(b => b.received = true);
      renderBillsLists();
      window.showToast('Todas as receitas foram confirmadas na conta!', '💵');
    };
  }
}

window.toggleBillPay = function(id) {
  const b = billsToPay.find(item => item.id === id);
  if (b) {
    b.paid = !b.paid;
    renderBillsLists();
    window.showToast(b.paid ? 'Conta marcada como paga!' : 'Conta desmarcada', '✓');
  }
};

window.toggleBillReceive = function(id) {
  const b = billsToReceive.find(item => item.id === id);
  if (b) {
    b.received = !b.received;
    renderBillsLists();
    window.showToast(b.received ? 'Receita confirmada na conta!' : 'Receita desmarcada', '✓');
  }
};

// ==========================================================================
// CALENDÁRIO DE VENCIMENTO (Images 3 & 4)
// ==========================================================================
function initCalendar() {
  const grid = document.getElementById('dash-calendar-grid');
  if (!grid) return;

  const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const dueDays = [10, 15, 20, 24]; // Due dates from bills
  const today = new Date().getDate();

  let html = daysOfWeek.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  // 1 to 31 days
  for (let i = 1; i <= 31; i++) {
    const isDue = dueDays.includes(i);
    const isToday = i === today;
    html += `
      <div class="cal-day-num ${isToday ? 'today' : ''} ${isDue ? 'has-due' : ''}" onclick="window.showToast('Dia ${i}: ${isDue ? 'Vencimento programado!' : 'Sem pendências'}', '📅')">
        ${i}
      </div>
    `;
  }

  grid.innerHTML = html;
}

// ==========================================================================
// CALCULADORA INTEGRADA (Image 6)
// ==========================================================================
function initCalculator() {
  const screen = document.getElementById('calc-screen');
  const buttons = document.querySelectorAll('.calc-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-calc');
      handleCalcInput(action);
    });
  });

  function handleCalcInput(act) {
    if (!screen) return;

    if (act === 'C') {
      calcExpression = '0';
    } else if (act === 'DEL') {
      calcExpression = calcExpression.length > 1 ? calcExpression.slice(0, -1) : '0';
    } else if (act === '=') {
      try {
        // Clean expression for safe evaluation
        const sanitized = calcExpression.replace(/,/g, '.').replace(/÷/g, '/').replace(/×/g, '*');
        const res = Function(`'use strict'; return (${sanitized})`)();
        calcExpression = String(Math.round(res * 100) / 100).replace(/\./g, ',');
      } catch (e) {
        calcExpression = 'Erro';
      }
    } else {
      if (calcExpression === '0' || calcExpression === 'Erro') calcExpression = '';
      calcExpression += act;
    }

    screen.textContent = calcExpression || '0';
  }
}

// ==========================================================================
// SVG CHARTS RENDERING (Projeção de Saldo, Donut, Timeline)
// ==========================================================================
function renderBarsChart() {
  const box = document.getElementById('dashboard-bars-svg-box');
  if (!box) return;

  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  const incomes = [4000, 3200, 2200, 3500, 3800, 4200, 3900, 4100, 4500, 4300, 4800, 5200];
  const expenses = [2500, 1700, 1200, 2100, 2400, 2300, 2200, 2500, 2600, 2400, 2900, 3100];
  const maxVal = 6000;

  const svgH = 180;
  const svgW = 500;
  const barW = 12;

  let barsSvg = '';
  months.forEach((m, idx) => {
    const x = 30 + idx * 39;
    const incH = (incomes[idx] / maxVal) * (svgH - 40);
    const expH = (expenses[idx] / maxVal) * (svgH - 40);

    const incY = svgH - 25 - incH;
    const expY = svgH - 25 - expH;

    barsSvg += `
      <!-- Income Bar (Blue) -->
      <rect x="${x}" y="${incY}" width="${barW}" height="${incH}" rx="3" fill="#2563eb">
        <title>${m} • Entradas: R$ ${incomes[idx]}</title>
      </rect>
      <!-- Expense Bar (Light Blue) -->
      <rect x="${x + barW + 2}" y="${expY}" width="${barW}" height="${expH}" rx="3" fill="#38bdf8">
        <title>${m} • Saídas: R$ ${expenses[idx]}</title>
      </rect>
      <!-- Month Label -->
      <text x="${x + barW}" y="${svgH - 8}" text-anchor="middle" font-size="10" fill="var(--text-subtle)">${m}</text>
    `;
  });

  box.innerHTML = `
    <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%" style="overflow: visible;">
      <!-- Grid lines -->
      <line x1="20" y1="30" x2="${svgW}" y2="30" stroke="var(--border-subtle)" stroke-dasharray="3 3" />
      <line x1="20" y1="80" x2="${svgW}" y2="80" stroke="var(--border-subtle)" stroke-dasharray="3 3" />
      <line x1="20" y1="130" x2="${svgW}" y2="130" stroke="var(--border-subtle)" stroke-dasharray="3 3" />
      <line x1="20" y1="${svgH - 25}" x2="${svgW}" y2="${svgH - 25}" stroke="var(--border-subtle)" />
      ${barsSvg}
    </svg>
  `;
}

function renderDonutChart() {
  const box = document.getElementById('dashboard-donut-svg-box');
  if (!box) return;

  // Donut circumference for r=60 is 2*PI*60 ≈ 377
  // Segments: 55% (Vendas), 25% (Finanças), 15% (Marketing), 5% (RH)
  const c = 377;
  const s1 = c * 0.55; // 207.35
  const s2 = c * 0.25; // 94.25
  const s3 = c * 0.15; // 56.55
  const s4 = c * 0.05; // 18.85

  box.innerHTML = `
    <svg viewBox="0 0 160 160" width="100%" height="100%" style="transform: rotate(-90deg);">
      <circle cx="80" cy="80" r="60" fill="transparent" stroke="#2563eb" stroke-width="26" stroke-dasharray="${s1} ${c - s1}" stroke-dashoffset="0" />
      <circle cx="80" cy="80" r="60" fill="transparent" stroke="#38bdf8" stroke-width="26" stroke-dasharray="${s2} ${c - s2}" stroke-dashoffset="-${s1}" />
      <circle cx="80" cy="80" r="60" fill="transparent" stroke="#7dd3fc" stroke-width="26" stroke-dasharray="${s3} ${c - s3}" stroke-dashoffset="-${s1 + s2}" />
      <circle cx="80" cy="80" r="60" fill="transparent" stroke="#0f172a" stroke-width="26" stroke-dasharray="${s4} ${c - s4}" stroke-dashoffset="-${s1 + s2 + s3}" />
    </svg>
  `;
}

function renderMetaTimelineChart() {
  const box = document.getElementById('meta-evolution-svg-box');
  if (!box) return;

  box.innerHTML = `
    <svg viewBox="0 0 450 160" width="100%" height="100%">
      <!-- Gridlines -->
      <line x1="30" y1="20" x2="430" y2="20" stroke="var(--border-subtle)" stroke-dasharray="2 2" />
      <line x1="30" y1="60" x2="430" y2="60" stroke="var(--border-subtle)" stroke-dasharray="2 2" />
      <line x1="30" y1="100" x2="430" y2="100" stroke="var(--border-subtle)" stroke-dasharray="2 2" />
      <line x1="30" y1="140" x2="430" y2="140" stroke="var(--border-subtle)" />

      <!-- Curve 1: Entrada da Casa (Blue) -->
      <path d="M 50 140 Q 150 70, 230 85 T 330 35 T 410 35" fill="none" stroke="#2563eb" stroke-width="3" />
      <circle cx="50" cy="140" r="4" fill="#2563eb" />
      <circle cx="150" cy="90" r="4" fill="#2563eb" />
      <circle cx="230" cy="85" r="4" fill="#2563eb" />
      <circle cx="330" cy="35" r="4" fill="#2563eb" />
      <circle cx="410" cy="35" r="4" fill="#2563eb" />

      <!-- Curve 2: Carro (Cyan) -->
      <path d="M 50 140 Q 140 50, 230 65 T 330 70 T 410 50" fill="none" stroke="#38bdf8" stroke-width="3" />
      <circle cx="140" cy="55" r="4" fill="#38bdf8" />
      <circle cx="230" cy="65" r="4" fill="#38bdf8" />
      <circle cx="330" cy="70" r="4" fill="#38bdf8" />
      <circle cx="410" cy="50" r="4" fill="#38bdf8" />

      <!-- Year Labels -->
      <text x="50" y="155" font-size="10" fill="var(--text-subtle)" text-anchor="middle">2021</text>
      <text x="140" y="155" font-size="10" fill="var(--text-subtle)" text-anchor="middle">2022</text>
      <text x="230" y="155" font-size="10" fill="var(--text-subtle)" text-anchor="middle">2023</text>
      <text x="330" y="155" font-size="10" fill="var(--text-subtle)" text-anchor="middle">2024</text>
      <text x="410" y="155" font-size="10" fill="var(--text-subtle)" text-anchor="middle">2025</text>
    </svg>
  `;
}

// ==========================================================================
// MODALS MANAGEMENT (Images 7 & 9)
// ==========================================================================
function initModals() {
  // New transaction modal trigger
  const btnOpenTx = document.getElementById('btn-open-tx-modal');
  if (btnOpenTx) btnOpenTx.addEventListener('click', openNewTxModal);

  // Type tabs in new tx modal
  let selectedTxType = 'EXPENSE';
  const typePills = document.querySelectorAll('.modal-tab-pill');
  typePills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTxType = pill.getAttribute('data-txtype');
    });
  });

  // Submit new transaction
  const formTx = document.getElementById('form-novo-lancamento');
  if (formTx) {
    formTx.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = parseFloat(document.getElementById('tx-modal-val').value);
      const desc = document.getElementById('tx-modal-desc').value;
      const category = document.getElementById('tx-modal-category').value;
      const method = document.getElementById('tx-modal-method').value;

      try {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: desc,
            amount: val,
            type: selectedTxType,
            category: category,
            paymentMethod: method
          })
        }).then(r => r.json());

        if (res.success) {
          window.showToast('Lançamento salvo e sincronizado no Supabase!', '✅');
          closeModal('modal-novo-lancamento');
          formTx.reset();
          await refreshAllData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Filter pills in Lançamentos
  const filterPills = document.querySelectorAll('#tx-filter-pills-group .filter-pill');
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.getAttribute('data-filter');
      renderFullTransactionsTable();
    });
  });

  const searchIn = document.getElementById('tx-search-input');
  if (searchIn) {
    searchIn.addEventListener('input', renderFullTransactionsTable);
  }
}

window.openNewTxModal = function() {
  const m = document.getElementById('modal-novo-lancamento');
  if (m) m.classList.add('open');
};

window.openBudgetModal = function() {
  const m = document.getElementById('modal-novo-orcamento');
  if (m) m.classList.add('open');
};

window.openMetaModal = function() {
  const m = document.getElementById('modal-nova-meta');
  if (m) m.classList.add('open');
};

window.closeModal = function(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
};

// ==========================================================================
// WHATSAPP CONTROLS & CHAT SIMULATOR
// ==========================================================================
function initWhatsAppQRControls() {
  const btnConnect = document.getElementById('btn-whatsapp-connect');
  const btnLogout = document.getElementById('btn-whatsapp-logout');

  if (btnConnect) {
    btnConnect.addEventListener('click', async () => {
      btnConnect.disabled = true;
      btnConnect.textContent = 'Gerando QR Code...';
      try {
        const res = await fetch('/api/whatsapp/connect', { method: 'POST' }).then(r => r.json());
        if (res.success) {
          window.showToast('Escaneie o QR Code no seu WhatsApp!', '📲');
          startQRPolling();
        }
      } catch (err) {
        console.error(err);
      } finally {
        btnConnect.disabled = false;
        btnConnect.textContent = '📲 Gerar QR Code';
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      await fetch('/api/whatsapp/logout', { method: 'POST' });
      window.showToast('WhatsApp desconectado.', '🔌');
      await checkWhatsAppStatus();
    });
  }
}

let qrPollInterval = null;
function startQRPolling() {
  if (qrPollInterval) clearInterval(qrPollInterval);
  qrPollInterval = setInterval(async () => {
    await checkWhatsAppStatus();
    if (currentWhatsAppStatus.status === 'CONNECTED') {
      clearInterval(qrPollInterval);
    }
  }, 2000);
}

async function checkWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status').then(r => r.json());
    if (res.success) {
      currentWhatsAppStatus = res;
      renderWhatsAppStatusUI();
    }
  } catch (err) {
    console.error(err);
  }
}

function renderWhatsAppStatusUI() {
  const badge = document.getElementById('wa-connection-badge');
  const qrBox = document.getElementById('wa-qrcode-box');
  const connBox = document.getElementById('wa-connected-box');
  const phoneDisplay = document.getElementById('wa-connected-phone-display');
  const btnConnect = document.getElementById('btn-whatsapp-connect');
  const btnLogout = document.getElementById('btn-whatsapp-logout');

  if (currentWhatsAppStatus.status === 'CONNECTED') {
    if (badge) {
      badge.textContent = '● Conectado 24/7';
      badge.style.background = 'var(--color-success-bg)';
      badge.style.color = 'var(--color-success-text)';
    }
    if (qrBox) qrBox.style.display = 'none';
    if (connBox) connBox.style.display = 'flex';
    if (phoneDisplay) phoneDisplay.textContent = currentWhatsAppStatus.connectedPhone || 'WhatsApp Ativo';
    if (btnConnect) btnConnect.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'block';
  } else if (currentWhatsAppStatus.qrCodeDataUrl) {
    if (badge) {
      badge.textContent = 'Aguardando Leitura...';
      badge.style.background = 'var(--color-warning-bg)';
      badge.style.color = 'var(--color-warning-text)';
    }
    if (qrBox) {
      qrBox.style.display = 'block';
      qrBox.innerHTML = `
        <img src="${currentWhatsAppStatus.qrCodeDataUrl}" alt="QR Code WhatsApp" style="width: 220px; height: 220px; border-radius: 12px; background: #fff; padding: 10px; box-shadow: 0 4px 20px rgba(0,0,0,0.4);" />
        <p style="font-size: 11px; color: var(--text-muted); margin-top: 8px;">Aponte o WhatsApp > Aparelhos Conectados</p>
      `;
    }
    if (connBox) connBox.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'none';
  } else {
    if (badge) {
      badge.textContent = '○ Desconectado';
      badge.style.background = 'transparent';
      badge.style.color = 'var(--text-muted)';
    }
    if (connBox) connBox.style.display = 'none';
    if (btnConnect) btnConnect.style.display = 'block';
    if (btnLogout) btnLogout.style.display = 'none';
  }
}

// Chat Simulator Input
function initChatInput() {
  const input = document.getElementById('chat-input');
  const btnSend = document.getElementById('chat-send-btn');

  async function sendMsg() {
    if (!input || !input.value.trim()) return;
    const text = input.value.trim();
    input.value = '';

    appendChatMessage({ sender: 'user', text, timestamp: new Date().toISOString() });

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      }).then(r => r.json());

      if (res.success && res.reply) {
        appendChatMessage({ sender: 'assistant', text: res.reply, timestamp: new Date().toISOString() });
        await refreshAllData();
      }
    } catch (err) {
      console.error(err);
    }
  }

  if (btnSend) btnSend.addEventListener('click', sendMsg);
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMsg();
    });
  }
}

function appendChatMessage(msg) {
  const box = document.getElementById('chat-messages-area');
  if (!box) return;

  const isUser = msg.sender === 'user';
  const el = document.createElement('div');
  el.style.cssText = `
    display: flex;
    justify-content: ${isUser ? 'flex-end' : 'flex-start'};
    margin-bottom: 8px;
  `;
  el.innerHTML = `
    <div style="
      max-width: 80%;
      background: ${isUser ? 'var(--color-primary-gradient)' : 'var(--bg-card-secondary)'};
      border: 1px solid ${isUser ? 'transparent' : 'var(--border-subtle)'};
      color: #fff;
      padding: 10px 14px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.4;
      white-space: pre-wrap;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    ">${escapeHtml(msg.text)}</div>
  `;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function renderChatMessages() {
  const box = document.getElementById('chat-messages-area');
  if (!box) return;
  box.innerHTML = '';
  (currentChatMessages || []).forEach(appendChatMessage);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
