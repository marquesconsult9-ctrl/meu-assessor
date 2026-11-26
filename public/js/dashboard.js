// ==========================================================================
// LANÇEI • DASHBOARD, CALCULATOR, CHARTS & WHATSAPP ENGINE
// ==========================================================================

let currentFinancialData = null;
let currentProjectionData = null;
let currentTransactions = [];
let currentChatMessages = [];
let currentWhatsAppStatus = { status: 'DISCONNECTED' };

let isPrivacyMode = false;
let currentFilter = 'todos'; // 'todos', 'entradas', 'saidas', 'pagos', 'agendados', 'atrasados', 'faturas', 'contas_fixas', 'mes'
let currentCardFilter = 'all'; // 'all', 'no_card', or cardId
let currentCategoryFilter = 'all'; // 'all' or category name
const DEFAULT_COMPETENCY = '2026-11';
let currentCompetency = DEFAULT_COMPETENCY;
let currentPeriodPreset = 'all'; // 'all', 'current_month', 'last7', 'last30', 'last90', 'year', 'custom'
let currentStartDate = '';
let currentEndDate = '';
let currentResponsibleFilters = []; // Array of lowercase responsible names. Empty array [] = Todos
let currentFlowPeriod = 'anual'; // 'anual', 'mes', 'periodo'
let currentDistributionType = 'saidas'; // 'saidas', 'entradas'
let calcExpression = '10+4';

const COMP_MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const COMP_MONTH_SHORT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

function getCompetencyParts(ym) {
  const [yStr, mStr] = String(ym || DEFAULT_COMPETENCY).split('-');
  const year = parseInt(yStr, 10) || 2026;
  const month = parseInt(mStr, 10) || 11;
  return {
    year,
    month,
    yearStr: String(year),
    monthStr: String(month).padStart(2, '0'),
    monthName: COMP_MONTH_NAMES[month - 1] || '',
    monthShort: COMP_MONTH_SHORT[month - 1] || ''
  };
}

function getCompetencyLabel(ym) {
  const p = getCompetencyParts(ym);
  return `${p.monthName}/${p.yearStr}`;
}

function addMonthsYM(ym, delta) {
  const p = getCompetencyParts(ym);
  const total = p.year * 12 + (p.month - 1) + delta;
  const newY = Math.floor(total / 12);
  const newM = ((total % 12) + 12) % 12 + 1;
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

function syncCompetencyUI() {
  const p = getCompetencyParts(currentCompetency);
  const monthSel = document.getElementById('comp-select-month');
  const yearSel = document.getElementById('comp-select-year');
  const todayBtn = document.getElementById('btn-comp-today');

  if (yearSel) {
    // Ensure year option exists
    if (!Array.from(yearSel.options).some(o => o.value === p.yearStr)) {
      const opt = document.createElement('option');
      opt.value = p.yearStr;
      opt.textContent = p.yearStr;
      yearSel.appendChild(opt);
      const sorted = Array.from(yearSel.options).sort((a, b) => Number(a.value) - Number(b.value));
      yearSel.innerHTML = '';
      sorted.forEach(o => yearSel.appendChild(o));
    }
    yearSel.value = p.yearStr;
  }
  if (monthSel) monthSel.value = p.monthStr;
  if (todayBtn) {
    todayBtn.style.display = currentCompetency !== DEFAULT_COMPETENCY ? 'inline-block' : 'none';
  }
}

window.setCompetency = async function(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return;
  if (ym === currentCompetency) return;
  currentCompetency = ym;
  syncCompetencyUI();
  await refreshAllData();
  window.showToast(`Competência alterada para ${getCompetencyLabel(ym)}`, '📅');
};

window.stepCompetency = function(delta) {
  const nextYM = addMonthsYM(currentCompetency, delta);
  window.setCompetency(nextYM);
};

window.onCompetencySelectChange = function() {
  const m = document.getElementById('comp-select-month')?.value || '11';
  const y = document.getElementById('comp-select-year')?.value || '2026';
  window.setCompetency(`${y}-${m}`);
};

window.resetCompetencyToDefault = function() {
  window.setCompetency(DEFAULT_COMPETENCY);
};

// ==========================================================================
// FLOATING CHART TOOLTIP CONTROLLER
// ==========================================================================
window.showChartTooltip = function(e, title, rows = []) {
  const tip = document.getElementById('chart-floating-tooltip');
  if (!tip) return;
  let html = `<div class="tooltip-header"><span>${title}</span></div>`;
  rows.forEach(r => {
    html += `
      <div class="tooltip-row ${r.cls || 'neutral'}">
        <span><span class="tooltip-dot" style="background: ${r.color || '#94a3b8'};"></span>${r.label}</span>
        <strong style="margin-left: 10px;">${r.val}</strong>
      </div>
    `;
  });
  tip.innerHTML = html;
  tip.classList.add('active');
  window.positionChartTooltip(e);
};

window.positionChartTooltip = function(e) {
  const tip = document.getElementById('chart-floating-tooltip');
  if (!tip || !e) return;
  const x = e.clientX;
  const y = e.clientY;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
};

window.hideChartTooltip = function() {
  const tip = document.getElementById('chart-floating-tooltip');
  if (tip) tip.classList.remove('active');
};

window.showFlowTooltip = function(e, periodLabel, incomeVal, expenseVal) {
  const diff = incomeVal - expenseVal;
  const isPos = diff >= 0;
  window.showChartTooltip(e, `Fluxo: ${periodLabel}`, [
    { label: 'Entradas', val: formatCurrency(incomeVal), color: '#38bdf8', cls: 'positive' },
    { label: 'Saídas', val: formatCurrency(expenseVal), color: '#f87171', cls: 'negative' },
    { label: 'Saldo', val: `${isPos ? '+' : ''} ${formatCurrency(diff)}`, color: isPos ? '#34d399' : '#f87171', cls: isPos ? 'positive' : 'negative' }
  ]);
};

window.showDonutTooltip = function(e, name, amount, pct) {
  window.showChartTooltip(e, name, [
    { label: 'Valor', val: formatCurrency(amount), color: '#38bdf8', cls: 'positive' },
    { label: 'Participação', val: `${pct.toFixed(1)}% do total`, color: '#94a3b8', cls: 'neutral' }
  ]);
};

window.showProjectionTooltip = function(e, monthLabel, total, itemsCount) {
  const isZero = total <= 0;
  window.showChartTooltip(e, `Fatura Prevista: ${monthLabel}`, [
    { label: 'Valor da Fatura', val: formatCurrency(total), color: '#38bdf8', cls: 'positive' },
    { label: 'Parcelas Ativas', val: `${itemsCount} item(s)`, color: '#94a3b8', cls: 'neutral' },
    { label: 'Situação', val: isZero ? 'Totalmente quitada' : 'Aguardando fechamento', color: isZero ? '#34d399' : '#fbbf24', cls: isZero ? 'positive' : 'neutral' }
  ]);
};

window.showSummaryCardTooltip = function(e, type) {
  if (!currentFinancialData) return;
  if (type === 'income') {
    const inc = currentFinancialData.currentMonthIncome || 0;
    const txCount = (currentTransactions || []).filter(t => t.type === 'INCOME' && (t.date || '').startsWith(currentCompetency)).length;
    window.showChartTooltip(e, `Entradas no Mês (${getCompetencyLabel(currentCompetency)})`, [
      { label: 'Receitas Registradas', val: formatCurrency(inc), color: '#38bdf8', cls: 'positive' },
      { label: 'Lançamentos', val: `${txCount} registros`, color: '#94a3b8', cls: 'neutral' },
      { label: 'Dica', val: 'Envie "Recebi 5000" no WhatsApp', color: '#10b981', cls: 'neutral' }
    ]);
  } else if (type === 'expense') {
    const fixas = currentFinancialData.currentMonthExpenses || 0;
    const faturas = currentFinancialData.totalInvoicesCurrent || 0;
    const total = fixas + faturas;
    window.showChartTooltip(e, `Despesas Consolidadas (${getCompetencyLabel(currentCompetency)})`, [
      { label: 'Contas Fixas & Boletos', val: formatCurrency(fixas), color: '#f87171', cls: 'negative' },
      { label: 'Faturas de Cartões', val: formatCurrency(faturas), color: '#f87171', cls: 'negative' },
      { label: 'Total Consolidado', val: formatCurrency(total), color: '#fbbf24', cls: 'negative' }
    ]);
  } else if (type === 'balance') {
    const bal = currentFinancialData.accountBalance || 0;
    const res = currentFinancialData.emergencyReserve || 0;
    const inv = currentFinancialData.investmentsBalance || 0;
    window.showChartTooltip(e, 'Resumo Patrimonial & Liquidez', [
      { label: 'Saldo em Conta', val: formatCurrency(bal), color: '#38bdf8', cls: 'neutral' },
      { label: 'Reserva de Emergência', val: formatCurrency(res), color: '#34d399', cls: 'positive' },
      { label: 'Investimentos em Carteira', val: formatCurrency(inv), color: '#a78bfa', cls: 'positive' }
    ]);
  }
};

function isResponsibleSelected(resp) {
  if (!currentResponsibleFilters || currentResponsibleFilters.length === 0) return true;
  if (!resp) return false;
  return currentResponsibleFilters.includes(resp.trim().toLowerCase());
}

function getResponsibleInitials(resp) {
  if (!resp) return '?';
  const clean = resp.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    return (parts[0][0] + (parts[1] ? parts[1][0] : '')).toUpperCase();
  }
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

let billsToPay = [];
let billsToReceive = [];

// Helper: Responsible extraction & badge styling
function getResponsibleClass(resp) {
  if (!resp) return 'badge-resp-default';
  const clean = resp.toLowerCase().trim();
  if (clean === 'marcos') return 'badge-resp-marcos';
  if (clean === 'grazy') return 'badge-resp-grazy';
  if (clean.includes('grazy') && clean.includes('marcos')) return 'badge-resp-grazy-marcos';
  if (clean.includes('mãe') || clean.includes('mae')) return 'badge-resp-mae';
  if (clean === 'wagner') return 'badge-resp-wagner';
  if (clean.includes('bambu')) return 'badge-resp-bambuboys';
  if (clean === 'guilherme') return 'badge-resp-guilherme';
  if (clean === 'nininha') return 'badge-resp-nininha';
  if (clean === 'sogra') return 'badge-resp-sogra';
  if (clean === 'junior') return 'badge-resp-junior';
  if (clean === 'nelson') return 'badge-resp-nelson';
  return 'badge-resp-default';
}

function getTxResponsible(tx) {
  if (!tx) return 'Marcos';
  if (tx.responsible && typeof tx.responsible === 'string' && tx.responsible.trim()) {
    return tx.responsible.trim();
  }
  const desc = tx.description || '';
  const parcMatch = desc.match(/\(Parc\.\s*[\d/]+\s*-\s*([^)]+)\)/i);
  if (parcMatch) return parcMatch[1].trim();
  const simpleMatch = desc.match(/\(([^)]+)\)$/);
  if (simpleMatch) {
    let v = simpleMatch[1].trim();
    if (v.includes('-')) v = v.split('-').pop().trim();
    return v;
  }
  if (desc.toLowerCase().includes('grazy')) return 'Grazy';
  return 'Marcos';
}

function getTxCardName(tx) {
  if (!tx || !currentFinancialData) return null;
  const cards = currentFinancialData.cards || [];
  const cardId = tx.cardId || tx.card_id;
  if (cardId) {
    const c = cards.find(card => card.id === cardId);
    if (c) return c.name;
  }
  if (tx.installmentId && currentFinancialData.installments) {
    const inst = currentFinancialData.installments.find(i => i.id === tx.installmentId);
    if (inst && inst.cardId) {
      const c = cards.find(card => card.id === inst.cardId);
      if (c) return c.name;
    }
  }
  if (tx.account && tx.account !== 'Conta Principal') {
    const c = cards.find(card => card.name.toLowerCase() === tx.account.toLowerCase());
    if (c) return c.name;
  }
  const desc = (tx.description || '').toLowerCase();
  for (const c of cards) {
    const cleanName = c.name.toLowerCase().replace('cartão ', '').trim();
    if (cleanName.length >= 3 && desc.includes(cleanName)) {
      return c.name;
    }
  }
  return null;
}

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

// Toast helper (Enterprise clean)
window.showToast = function(msg, icon = '•') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.style.cssText = 'background: #0f1118; border: 1px solid rgba(255,255,255,0.12); border-radius: 4px; padding: 8px 14px; color: #f1f5f9; font-size: 11px; font-weight: 500; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.6); animation: fadeIn 0.15s ease;';
  t.innerHTML = `<span style="color: #3b82f6; font-size: 12px; font-weight: bold;">${icon}</span> <span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s ease';
    setTimeout(() => t.remove(), 300);
  }, 3500);
};

// Document Init
document.addEventListener('DOMContentLoaded', async () => {
  try {
    initAuthSystem();
  } catch (e) {
    console.error('Error initializing auth system:', e);
  }

  try {
    initTabsNavigation();
    initMobileNavigation();
    initHeaderTools();
    initChartFilterControls();
    initCalculator();
    initCalendar();
    initModals();
    initChatInput();
    initWhatsAppQRControls();
    initRealtimeSSE();
  } catch (e) {
    console.error('Error initializing navigation/tools:', e);
  }

  // Load initial theme from localStorage
  const savedTheme = localStorage.getItem('mi-theme');
  if (savedTheme === 'light') {
    document.body.classList.add('light-theme');
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = '☀️';
  }

  // Load financial data & user profile from API
  try {
    await refreshAllData();
  } catch (e) {
    console.error('Error refreshing financial data:', e);
  }
  try {
    await loadUserProfile();
  } catch (e) {
    console.error('Error loading user profile:', e);
  }
  try {
    await checkWhatsAppStatus();
  } catch (e) {
    console.error('Error checking whatsapp status:', e);
  }

  try {
    renderBillsLists();
    renderBarsChart();
    renderDonutChart();
    renderMetaTimelineChart();
  } catch (e) {
    console.error('Error rendering initial charts/lists:', e);
  }
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

function openMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('active');
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('app-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
}

function initMobileNavigation() {
  const btnToggle = document.getElementById('btn-mobile-menu-toggle');
  const btnClose = document.getElementById('btn-close-sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const btnMobileAdd = document.getElementById('btn-mobile-open-tx');

  if (btnToggle) {
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      openMobileSidebar();
    });
  }

  if (btnClose) {
    btnClose.addEventListener('click', () => {
      closeMobileSidebar();
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      closeMobileSidebar();
    });
  }

  if (btnMobileAdd) {
    btnMobileAdd.addEventListener('click', (e) => {
      e.preventDefault();
      openModal('modal-novo-lancamento');
    });
  }

  // Mobile bottom nav buttons
  document.querySelectorAll('.mobile-bottom-nav .mobile-nav-btn[data-tab]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabId = btn.getAttribute('data-tab');
      navigateToTab(tabId);
    });
  });
}

window.navigateToTab = function(tabId) {
  if (tabId === 'tab-whatsapp') {
    tabId = 'tab-settings';
  }

  // Update sidebar active state
  document.querySelectorAll('.app-sidebar .nav-link').forEach(l => {
    l.classList.toggle('active', l.getAttribute('data-tab') === tabId);
  });

  // Update mobile bottom nav active state
  document.querySelectorAll('.mobile-bottom-nav .mobile-nav-btn[data-tab]').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  // Switch content panes
  document.querySelectorAll('.tab-content-pane').forEach(pane => {
    pane.classList.remove('active');
  });

  const activePane = document.getElementById(tabId);
  if (activePane) activePane.classList.add('active');

  // Close mobile sidebar drawer if open
  closeMobileSidebar();

  // Scroll to top of content on mobile
  const scrollContainer = document.querySelector('.app-content-scroll');
  if (scrollContainer) scrollContainer.scrollTop = 0;

  // Update topbar title
  const titles = {
    'tab-dashboard': 'Dashboard',
    'tab-lancamentos': 'Lançamentos',
    'tab-planejamento': 'Planejamento',
    'tab-open-finance': 'Cartões & Faturas',
    'tab-settings': 'Preferências'
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
      const unpaid = (currentFinancialData?.bills || []).filter(b => b.type === 'PAY' && !b.isPaid).length;
      const invCount = (currentFinancialData?.cards || []).filter(c => (c.currentInvoice || 0) > 0).length;
      if (unpaid > 0 || invCount > 0) {
        window.showToast(`Você possui ${unpaid} conta(s) a pagar e ${invCount} fatura(s) em aberto este mês!`, '🔔');
      } else {
        window.showToast('Tudo em dia! Nenhuma pendência em aberto para este mês.', '✅');
      }
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

function initChartFilterControls() {
  // Fluxo Mensal filters: Anual, Mês, Período
  document.querySelectorAll('button[data-proj]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('button[data-proj]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFlowPeriod = btn.getAttribute('data-proj');
      renderBarsChart();
      const p = getCompetencyParts(currentCompetency);
      const labels = { anual: `Anual (${p.yearStr})`, mes: `Mês (Semanas de ${p.monthName})`, periodo: 'Período (Semestral)' };
      window.showToast(`Fluxo alterado: ${labels[currentFlowPeriod] || currentFlowPeriod}`, '📊');
    });
  });

  // Distribuição filters: Entradas, Saídas
  document.querySelectorAll('button[data-cat]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelectorAll('button[data-cat]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentDistributionType = btn.getAttribute('data-cat');
      renderDonutChart();
      const labels = { entradas: 'Distribuição de Entradas', saidas: 'Distribuição de Despesas' };
      window.showToast(labels[currentDistributionType] || 'Distribuição atualizada', '🍩');
    });
  });
}

function updateHeroBalanceView(btype) {
  const valEl = document.getElementById('dash-metric-balance');
  const subEl = document.querySelector('.balance-hero-sub');
  if (!valEl) return;
  const balance = currentFinancialData ? currentFinancialData.accountBalance : 0;

  if (btype === 'emergencia') {
    valEl.textContent = formatCurrency(currentFinancialData?.emergencyReserve || 0);
    if (subEl) subEl.textContent = 'Reserva de liquidez imediata (CDI / Tesouro Selic)';
  } else if (btype === 'investimento') {
    valEl.textContent = formatCurrency(currentFinancialData?.investmentsBalance || 0);
    if (subEl) subEl.textContent = 'Total alocado em carteira de investimentos';
  } else {
    valEl.textContent = formatCurrency(balance);
    if (subEl) subEl.textContent = 'Saldo disponível para liquidação imediata';
  }
}

// ==========================================================================
// DATA REFRESH & REALTIME
// ==========================================================================
async function refreshAllData() {
  try {
    syncCompetencyUI();
    const compParam = encodeURIComponent(currentCompetency);
    const [finRes, projRes, txRes, chatRes] = await Promise.all([
      fetch(`/api/financial/summary?month=${compParam}`).then(r => r.json()),
      fetch(`/api/invoices/projection?month=${compParam}`).then(r => r.json()),
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
        if (data.currentCompetency && data.currentCompetency !== currentCompetency) {
          refreshAllData();
        } else {
          currentFinancialData = data;
          renderAllViews();
        }
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
// RENDER ALL VIEWS & MULTISELECT RESPONSIBLE CONTROLLER
// ==========================================================================
function populateResponsibleDropdowns() {
  const modalSel = document.getElementById('tx-modal-responsible');

  let resps = (currentFinancialData && currentFinancialData.responsibles) || [];
  if (resps.length === 0 && currentTransactions.length > 0) {
    const s = new Set();
    currentTransactions.forEach(t => s.add(getTxResponsible(t)));
    resps = Array.from(s).filter(Boolean).sort();
  }

  const stats = (currentFinancialData && currentFinancialData.responsibleStats) || {};

  // Build items HTML for multiselect dropdowns
  const buildOptionsListHtml = () => {
    if (resps.length === 0) {
      return '<div class="resp-option-empty">Nenhum responsável encontrado</div>';
    }
    return resps.map(r => {
      const cleanR = r.trim().toLowerCase();
      const isChecked = currentResponsibleFilters.includes(cleanR);
      const count = stats[r]?.txCount || currentTransactions.filter(t => getTxResponsible(t).toLowerCase() === cleanR).length;
      const countLabel = count > 0 ? `${count} lanç.` : '';
      const badgeCls = getResponsibleClass(r);
      const initials = getResponsibleInitials(r);

      return `
        <div class="resp-option-item ${isChecked ? 'selected' : ''}" data-name="${r}" onclick="window.toggleResponsibleItem('${r}')">
          <div class="resp-option-left">
            <input type="checkbox" class="resp-option-checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleResponsibleItem('${r}')" />
            <div class="resp-avatar-mini badge-resp ${badgeCls}">${initials}</div>
            <span class="resp-option-name">${r}</span>
          </div>
          <div class="resp-option-right">
            ${countLabel ? `<span class="resp-option-txcount">${countLabel}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  };

  const listHtml = buildOptionsListHtml();
  const gList = document.getElementById('global-resp-options-list');
  const tList = document.getElementById('tx-resp-options-list');
  if (gList) gList.innerHTML = listHtml;
  if (tList) tList.innerHTML = listHtml;

  if (modalSel && modalSel.options.length <= 1 && resps.length > 0) {
    modalSel.innerHTML = resps.map(r => `<option value="${r}">${r}</option>`).join('');
  }

  updateResponsibleUI();
}

function updateResponsibleUI() {
  const count = currentResponsibleFilters.length;
  const allResps = (currentFinancialData && currentFinancialData.responsibles) || [];

  let labelText = 'Todos os Responsáveis';
  if (count === 1) {
    const found = allResps.find(r => r.toLowerCase() === currentResponsibleFilters[0]);
    labelText = found || currentResponsibleFilters[0];
  } else if (count === 2) {
    const f1 = allResps.find(r => r.toLowerCase() === currentResponsibleFilters[0]) || currentResponsibleFilters[0];
    const f2 = allResps.find(r => r.toLowerCase() === currentResponsibleFilters[1]) || currentResponsibleFilters[1];
    labelText = `${f1}, ${f2}`;
  } else if (count > 2) {
    const f1 = allResps.find(r => r.toLowerCase() === currentResponsibleFilters[0]) || currentResponsibleFilters[0];
    labelText = `${f1} +${count - 1}`;
  }

  const updateWrapper = (prefix) => {
    const trigger = document.getElementById(`${prefix}-resp-trigger`);
    const label = document.getElementById(`${prefix}-resp-label`);
    const badge = document.getElementById(`${prefix}-resp-badge`);
    const clearBtn = document.getElementById(`${prefix}-resp-clear-btn`);

    if (label) label.textContent = labelText;
    if (badge) {
      if (count > 1) {
        badge.style.display = 'inline-block';
        badge.textContent = count;
      } else {
        badge.style.display = 'none';
      }
    }
    if (clearBtn) {
      clearBtn.style.display = count > 0 ? 'inline-flex' : 'none';
    }
    if (trigger) {
      if (count > 0) {
        trigger.classList.add('active-filter');
      } else {
        trigger.classList.remove('active-filter');
      }
    }

    const optionsContainer = document.getElementById(`${prefix}-resp-options-list`);
    if (optionsContainer) {
      const items = optionsContainer.querySelectorAll('.resp-option-item');
      items.forEach(item => {
        const name = (item.dataset.name || '').trim().toLowerCase();
        const chk = item.querySelector('.resp-option-checkbox');
        const isSel = currentResponsibleFilters.includes(name);
        if (chk) chk.checked = isSel;
        if (isSel) {
          item.classList.add('selected');
        } else {
          item.classList.remove('selected');
        }
      });
    }
  };

  updateWrapper('global');
  updateWrapper('tx');
}

function populateCardFilterDropdown() {
  const cardSelect = document.getElementById('tx-filter-card');
  if (!cardSelect || !currentFinancialData) return;
  const cards = currentFinancialData.cards || [];
  const prevVal = cardSelect.value || currentCardFilter || 'all';

  let html = `
    <option value="all">Todos os Cartões (${cards.length})</option>
    <option value="no_card">🏦 Sem Cartão (Conta / Pix / Débito)</option>
  `;
  if (cards.length > 0) {
    html += `<optgroup label="Cartões de Crédito Cadastrados">`;
    cards.forEach(c => {
      html += `<option value="${c.id}">💳 ${escapeHtml(c.name)} (•••• ${escapeHtml(c.last4)})</option>`;
    });
    html += `</optgroup>`;
  }
  cardSelect.innerHTML = html;
  if (Array.from(cardSelect.options).some(o => o.value === prevVal)) {
    cardSelect.value = prevVal;
  }
}

function isFixedBill(tx) {
  if (!tx) return false;
  const cat = (tx.category || '').toLowerCase();
  if (cat === 'conta fixa' || cat.includes('fixa')) return true;
  const id = (tx.id || '').toLowerCase();
  if (id.includes('fixa') || id.includes('bill')) return true;
  if (currentFinancialData?.bills) {
    const desc = (tx.description || '').toLowerCase();
    const match = currentFinancialData.bills.some(b => {
      const bDesc = (b.description || '').toLowerCase();
      return bDesc && (desc.includes(bDesc) || bDesc.includes(desc));
    });
    if (match) return true;
  }
  return false;
}

function populateCategoryFilterDropdown() {
  const catSelect = document.getElementById('tx-filter-category');
  if (!catSelect) return;
  const prevVal = catSelect.value || currentCategoryFilter || 'all';

  const counts = {};
  (currentTransactions || []).forEach(t => {
    const cat = t.category || 'Geral';
    counts[cat] = (counts[cat] || 0) + 1;
  });

  const catIcons = {
    'Conta Fixa': '📌',
    'Mercado': '🛒',
    'Operacional': '⚙️',
    'Moradia/Investimento': '🏠',
    'Cartão de Crédito': '💳',
    'Receitas': '💰',
    'Logística': '🚚',
    'Infraestrutura': '🏗️',
    'Geral': '📁',
    'Ajuste de Saldo': '⚖️',
    'Compras Parceladas': '🛍️'
  };

  const standardCats = ['Conta Fixa', 'Mercado', 'Operacional', 'Moradia/Investimento', 'Cartão de Crédito', 'Receitas', 'Logística', 'Infraestrutura', 'Geral'];
  const allCatsSet = new Set([...standardCats, ...Object.keys(counts)]);
  const sortedCats = Array.from(allCatsSet).sort((a, b) => {
    const countA = counts[a] || 0;
    const countB = counts[b] || 0;
    if (countB !== countA) return countB - countA;
    return a.localeCompare(b);
  });

  let html = `<option value="all">🏷️ Todas as Categorias</option>`;
  sortedCats.forEach(cat => {
    const icon = catIcons[cat] || '🏷️';
    const count = counts[cat] || 0;
    html += `<option value="${escapeHtml(cat)}">${icon} ${escapeHtml(cat)} (${count})</option>`;
  });

  catSelect.innerHTML = html;
  if (Array.from(catSelect.options).some(o => o.value === prevVal)) {
    catSelect.value = prevVal;
  }
}

function applyPeriodPreset(preset) {
  currentPeriodPreset = preset;
  const customBox = document.getElementById('tx-filter-custom-dates');
  const startIn = document.getElementById('tx-filter-date-start');
  const endIn = document.getElementById('tx-filter-date-end');

  if (preset === 'custom') {
    if (customBox) customBox.style.display = 'inline-flex';
    currentStartDate = startIn ? startIn.value : '';
    currentEndDate = endIn ? endIn.value : '';
  } else {
    if (customBox) customBox.style.display = 'none';

    const compParts = getCompetencyParts(currentCompetency);
    const lastDayOfComp = new Date(compParts.year, compParts.month, 0).getDate();
    if (preset === 'all') {
      currentStartDate = '';
      currentEndDate = '';
    } else if (preset === 'current_month') {
      currentStartDate = `${currentCompetency}-01`;
      currentEndDate = `${currentCompetency}-${String(lastDayOfComp).padStart(2, '0')}`;
    } else if (preset === 'last7') {
      const refDate = new Date(`${currentCompetency}-16T12:00:00`);
      const past7 = new Date(refDate);
      past7.setDate(refDate.getDate() - 7);
      currentStartDate = past7.toISOString().slice(0, 10);
      currentEndDate = refDate.toISOString().slice(0, 10);
    } else if (preset === 'last30') {
      const refDate = new Date(`${currentCompetency}-16T12:00:00`);
      const past30 = new Date(refDate);
      past30.setDate(refDate.getDate() - 30);
      currentStartDate = past30.toISOString().slice(0, 10);
      currentEndDate = refDate.toISOString().slice(0, 10);
    } else if (preset === 'last90') {
      const refDate = new Date(`${currentCompetency}-16T12:00:00`);
      const past90 = new Date(refDate);
      past90.setDate(refDate.getDate() - 90);
      currentStartDate = past90.toISOString().slice(0, 10);
      currentEndDate = refDate.toISOString().slice(0, 10);
    } else if (preset === 'year') {
      currentStartDate = `${compParts.yearStr}-01-01`;
      currentEndDate = `${compParts.yearStr}-12-31`;
    }

    if (startIn) startIn.value = currentStartDate;
    if (endIn) endIn.value = currentEndDate;
  }
}

window.toggleRespDropdown = function(target) {
  const gDrop = document.getElementById('global-resp-dropdown');
  const tDrop = document.getElementById('tx-resp-dropdown');
  const gWrap = document.getElementById('global-resp-wrapper');
  const tWrap = document.getElementById('tx-resp-wrapper');

  if (target === 'global') {
    const isShowing = gDrop?.classList.contains('show');
    if (tDrop) tDrop.classList.remove('show');
    if (tWrap) tWrap.classList.remove('open');
    if (isShowing) {
      gDrop?.classList.remove('show');
      gWrap?.classList.remove('open');
    } else {
      gDrop?.classList.add('show');
      gWrap?.classList.add('open');
      setTimeout(() => gDrop?.querySelector('.resp-search-input')?.focus(), 50);
    }
  } else {
    const isShowing = tDrop?.classList.contains('show');
    if (gDrop) gDrop.classList.remove('show');
    if (gWrap) gWrap.classList.remove('open');
    if (isShowing) {
      tDrop?.classList.remove('show');
      tWrap?.classList.remove('open');
    } else {
      tDrop?.classList.add('show');
      tWrap?.classList.add('open');
      setTimeout(() => tDrop?.querySelector('.resp-search-input')?.focus(), 50);
    }
  }
};

// Close multiselect dropdowns when clicking outside
document.addEventListener('click', (e) => {
  const gWrap = document.getElementById('global-resp-wrapper');
  const tWrap = document.getElementById('tx-resp-wrapper');
  if (gWrap && !gWrap.contains(e.target)) {
    document.getElementById('global-resp-dropdown')?.classList.remove('show');
    gWrap.classList.remove('open');
  }
  if (tWrap && !tWrap.contains(e.target)) {
    document.getElementById('tx-resp-dropdown')?.classList.remove('show');
    tWrap.classList.remove('open');
  }
});

window.filterRespList = function(query, target) {
  const container = document.getElementById(`${target}-resp-options-list`);
  if (!container) return;
  const q = (query || '').toLowerCase().trim();
  const items = container.querySelectorAll('.resp-option-item');
  items.forEach(item => {
    const name = (item.dataset.name || '').toLowerCase();
    item.style.display = (!q || name.includes(q)) ? 'flex' : 'none';
  });
};

function triggerAllFiltersUpdate() {
  updateResponsibleUI();
  renderFullTransactionsTable();
  renderRecentTxTable();
  renderBillsLists();
  updateResponsibleFilterBanners();
  updateResponsibleDashboardMetrics();
  renderBarsChart();
  renderDonutChart();
  renderDashboardMetasAndBudgets();
}

window.selectAllResponsibles = function() {
  currentResponsibleFilters = [];
  triggerAllFiltersUpdate();
  window.showToast('Exibindo todos os responsáveis', '👥');
};

window.clearResponsibleFilter = function() {
  window.selectAllResponsibles();
};

window.toggleResponsibleItem = function(resp) {
  if (!resp) return;
  const clean = resp.trim().toLowerCase();
  const idx = currentResponsibleFilters.indexOf(clean);
  if (idx >= 0) {
    currentResponsibleFilters.splice(idx, 1);
  } else {
    currentResponsibleFilters.push(clean);
  }

  triggerAllFiltersUpdate();

  const count = currentResponsibleFilters.length;
  if (count === 0) {
    window.showToast('Exibindo todos os responsáveis', '👥');
  } else if (count === 1) {
    window.showToast(`Filtrado por: ${resp}`, '👤');
  } else {
    window.showToast(`${count} responsáveis selecionados`, '👥');
  }
};

window.setResponsibleFilter = function(resp, mode = 'toggle') {
  if (!resp || resp === 'todos') {
    currentResponsibleFilters = [];
  } else if (mode === 'only') {
    currentResponsibleFilters = [resp.trim().toLowerCase()];
  } else if (mode === 'toggle') {
    window.toggleResponsibleItem(resp);
    return;
  } else if (Array.isArray(resp)) {
    currentResponsibleFilters = resp.map(r => r.trim().toLowerCase()).filter(Boolean);
  } else if (typeof resp === 'string') {
    currentResponsibleFilters = resp.split(',').map(r => r.trim().toLowerCase()).filter(s => s && s !== 'todos');
  }

  triggerAllFiltersUpdate();
};

window.handleBadgeClick = function(event, resp) {
  if (event) event.stopPropagation();
  const clean = (resp || '').trim().toLowerCase();
  if (event && (event.ctrlKey || event.shiftKey || event.metaKey)) {
    window.toggleResponsibleItem(resp);
  } else {
    if (currentResponsibleFilters.length === 1 && currentResponsibleFilters[0] === clean) {
      window.selectAllResponsibles();
    } else {
      currentResponsibleFilters = [clean];
      triggerAllFiltersUpdate();
      window.showToast(`Filtrando apenas por: ${resp}`, '👤');
    }
  }
};

function updateResponsibleFilterBanners() {
  const isFiltered = currentResponsibleFilters && currentResponsibleFilters.length > 0;

  const txBanner = document.getElementById('tx-active-filter-banner');
  const txRespName = document.getElementById('active-filter-resp-name');
  const txStats = document.getElementById('active-filter-stats');

  const dashBanner = document.getElementById('dash-active-filter-banner');
  const dashRespName = document.getElementById('dash-filter-resp-name');
  const dashStats = document.getElementById('dash-filter-stats');

  if (isFiltered) {
    const matchingTxs = currentTransactions.filter(t => isResponsibleSelected(getTxResponsible(t)));
    const totalExp = matchingTxs.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const count = matchingTxs.length;

    let names = [];
    const allResps = (currentFinancialData && currentFinancialData.responsibles) || [];
    currentResponsibleFilters.forEach(sel => {
      const match = allResps.find(r => r.toLowerCase() === sel.toLowerCase());
      names.push(match || sel);
    });
    const labelStr = names.join(', ');

    if (txBanner) txBanner.style.display = 'flex';
    if (txRespName) txRespName.textContent = labelStr;
    if (txStats) txStats.textContent = `• ${count} lançamentos (R$ ${totalExp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;

    if (dashBanner) dashBanner.style.display = 'flex';
    if (dashRespName) dashRespName.textContent = labelStr;
    if (dashStats) dashStats.textContent = `• Total de despesas: R$ ${totalExp.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  } else {
    if (txBanner) txBanner.style.display = 'none';
    if (dashBanner) dashBanner.style.display = 'none';
  }
}

function updateResponsibleDashboardMetrics() {
  if (!currentFinancialData) return;

  const expenseEl = document.getElementById('dash-metric-expense');
  const incomeEl = document.getElementById('dash-metric-income');
  const balanceEl = document.getElementById('dash-metric-balance');
  const expenseSub = document.querySelector('.summary-card-metric:nth-child(2) .metric-trend-pill span');
  const incomeSub = document.querySelector('.summary-card-metric:nth-child(1) .metric-trend-pill span');

  const stats = currentFinancialData.responsibleStats || {};
  const currentYM = currentCompetency;

  if (!currentResponsibleFilters || currentResponsibleFilters.length === 0) {
    const totalExp = (currentFinancialData.currentMonthExpenses || 0) + (currentFinancialData.totalInvoicesCurrent || 0);
    if (expenseEl) expenseEl.textContent = formatCurrency(totalExp);
    if (incomeEl) incomeEl.textContent = formatCurrency(currentFinancialData.currentMonthIncome || 0);
    if (balanceEl) balanceEl.textContent = formatCurrency(currentFinancialData.accountBalance || 0);
    if (expenseSub) {
      expenseSub.textContent = `${formatCurrency(currentFinancialData.currentMonthExpenses)} fixas + ${formatCurrency(currentFinancialData.totalInvoicesCurrent)} faturas`;
    }
    const txCount = (currentTransactions || []).filter(t => t.type === 'INCOME' && (t.date || '').startsWith(currentYM)).length;
    if (incomeSub) incomeSub.textContent = `${txCount} lançamentos`;
  } else {
    let totalFixedExp = 0;
    let totalInvoices = 0;
    let totalInc = 0;
    let totalTxs = 0;

    const allResps = Object.keys(stats);
    let matchedKeys = [];

    currentResponsibleFilters.forEach(sel => {
      const foundKey = allResps.find(k => k.toLowerCase() === sel.toLowerCase());
      if (foundKey && stats[foundKey]) {
        matchedKeys.push(foundKey);
        totalFixedExp += (stats[foundKey].expenses || 0);
        totalInvoices += (stats[foundKey].invoices || 0);
        totalInc += (stats[foundKey].income || 0);
        totalTxs += (stats[foundKey].txCount || 0);
      } else {
        const matchingTxs = currentTransactions.filter(t => getTxResponsible(t).toLowerCase() === sel && (t.date || '').startsWith(currentYM));
        totalFixedExp += matchingTxs.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount || 0), 0);
        totalInc += matchingTxs.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount || 0), 0);
        totalTxs += matchingTxs.length;
      }
    });

    const totalCommitted = totalFixedExp + totalInvoices;
    if (expenseEl) expenseEl.textContent = formatCurrency(totalCommitted);
    if (incomeEl) incomeEl.textContent = formatCurrency(totalInc);
    if (balanceEl) balanceEl.textContent = formatCurrency(totalInc - totalCommitted);

    const namesLabel = matchedKeys.length > 0
      ? (matchedKeys.length <= 2 ? matchedKeys.join(', ') : `${matchedKeys.length} selecionados`)
      : `${currentResponsibleFilters.length} selecionados`;

    if (expenseSub) {
      expenseSub.textContent = `${formatCurrency(totalFixedExp)} fixas + ${formatCurrency(totalInvoices)} faturas (${namesLabel})`;
    }
    if (incomeSub) {
      incomeSub.textContent = `Entradas de ${namesLabel}`;
    }
  }
}

// ==========================================================================
// RENDER ALL VIEWS
// ==========================================================================
function renderAllViews() {
  if (!currentFinancialData) return;

  populateResponsibleDropdowns();
  populateCardFilterDropdown();
  populateCategoryFilterDropdown();
  updateResponsibleDashboardMetrics();
  updateResponsibleFilterBanners();

  if (!currentResponsibleFilters || currentResponsibleFilters.length === 0) {
    const incomeEl = document.getElementById('dash-metric-income');
    const expenseEl = document.getElementById('dash-metric-expense');
    const balanceEl = document.getElementById('dash-metric-balance');

    if (incomeEl) incomeEl.textContent = formatCurrency(currentFinancialData.currentMonthIncome || 0);
    const totalExp = (currentFinancialData.currentMonthExpenses || 0) + (currentFinancialData.totalInvoicesCurrent || 0);
    if (expenseEl) expenseEl.textContent = formatCurrency(totalExp);
    if (balanceEl) balanceEl.textContent = formatCurrency(currentFinancialData.accountBalance || 0);

    const expenseSub = document.querySelector('.summary-card-metric:nth-child(2) .metric-trend-pill span');
    if (expenseSub && currentFinancialData) {
      expenseSub.textContent = `${formatCurrency(currentFinancialData.currentMonthExpenses)} fixas + ${formatCurrency(currentFinancialData.totalInvoicesCurrent)} faturas`;
    }
    const incomeSub = document.querySelector('.summary-card-metric:nth-child(1) .metric-trend-pill span');
    if (incomeSub) {
      const txCount = (currentTransactions || []).filter(t => t.type === 'INCOME' && (t.date || '').startsWith(currentCompetency)).length;
      incomeSub.textContent = `${txCount} lançamentos`;
    }
  }

  // Render recent mini table
  renderRecentTxTable();
  // Render full table in Lançamentos
  renderFullTransactionsTable();
  // Render sidebar mini cards in Lançamentos
  renderSidebarMiniCards();
  // Render open finance cards
  renderOpenFinanceCards();
  // Render bills lists (Pagar & Receber)
  renderBillsLists();
  // Render budgets (Tetos Orçamentários)
  renderBudgets();
  // Render goals (Metas Estratégicas)
  renderGoals();
  // Render dashboard charts & widgets
  renderBarsChart();
  renderDonutChart();
  renderDashboardMetasAndBudgets();
  initCalendar();
  // Sync settings inputs
  syncSettingsUI();
}

function getProjectedInstallmentsForMonth(ym) {
  if (!ym || !/^\d{4}-\d{2}$/.test(ym)) return [];
  const installments = currentProjectionData?.installments || [];
  const cards = currentFinancialData?.cards || [];
  const existingInstIds = new Set(
    (currentTransactions || [])
      .filter(tx => (tx.date || '').startsWith(ym) && tx.installmentId)
      .map(tx => tx.installmentId)
  );

  const [tY, tM] = ym.split('-').map(Number);
  const projected = [];

  installments.forEach(inst => {
    if (!inst.startMonth || !inst.endMonth) return;
    if (ym < inst.startMonth || ym > inst.endMonth) return;
    if (existingInstIds.has(inst.id)) return;

    const [sY, sM] = inst.startMonth.split('-').map(Number);
    const installmentNum = (tY * 12 + tM) - (sY * 12 + sM) + 1;
    const card = cards.find(c => c.id === inst.cardId);
    if (!card) return;
    const dueDay = card.dueDay ? String(Math.min(28, Math.max(1, card.dueDay))).padStart(2, '0') : '10';
    const resp = inst.responsible || 'Marcos';

    projected.push({
      id: `proj-${inst.id}-${ym}`,
      isProjectedInstallment: true,
      installmentId: inst.id,
      description: `${inst.description} (Parc. ${installmentNum}/${inst.totalInstallments} - ${resp})`,
      type: 'EXPENSE',
      amount: Number(inst.installmentAmount || 0),
      category: 'Cartão de Crédito',
      paymentMethod: 'CREDIT_CARD',
      isInstallment: true,
      cardId: inst.cardId,
      account: card ? card.name : 'Cartão de Crédito',
      responsible: resp,
      date: `${ym}-${dueDay}T12:00:00.000Z`,
      isPaid: false
    });
  });

  return projected;
}

function renderRecentTxTable() {
  const tbody = document.getElementById('dash-recent-tx-body');
  if (!tbody) return;

  const realTxs = (currentTransactions || []).filter(tx => (tx.date || '').startsWith(currentCompetency));
  const projTxs = getProjectedInstallmentsForMonth(currentCompetency);
  let list = [...realTxs, ...projTxs];
  if (currentResponsibleFilters && currentResponsibleFilters.length > 0) {
    list = list.filter(tx => isResponsibleSelected(getTxResponsible(tx)));
  }
  list = list.slice(0, 5);

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: var(--text-muted); padding: 16px;">Nenhuma transação em ${getCompetencyLabel(currentCompetency)}.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(tx => {
    const resp = getTxResponsible(tx);
    const badgeCls = getResponsibleClass(resp);
    return `
    <tr>
      <td style="color: var(--text-muted);">${formatDate(tx.date || tx.created_at)}</td>
      <td style="font-weight: 500;">
        ${tx.description || 'Sem descrição'}
        <span class="badge-resp ${badgeCls}" style="font-size: 9px; padding: 1px 6px; margin-left: 5px; cursor: pointer;" onclick="window.handleBadgeClick(event, '${resp}')" title="Clique para filtrar por ${resp} (Ctrl+Clique para multi-seleção)">${resp}</span>
      </td>
      <td class="tx-amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}">
        ${tx.type === 'INCOME' ? '+' : '-'} ${formatCurrency(tx.amount)}
      </td>
    </tr>
  `;
  }).join('');
}

function updateTxFilterMetricsAndBanner(filtered) {
  const metricsPill = document.getElementById('tx-filtered-metrics-pill');
  const banner = document.getElementById('tx-active-filter-banner');
  const bannerStats = document.getElementById('active-filter-stats');
  const bannerRespName = document.getElementById('active-filter-resp-name');
  const clearBtn = document.getElementById('btn-clear-tx-filters');

  const totalCount = filtered.length;
  const incTotal = filtered.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount || 0), 0);
  const expTotal = filtered.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + Number(t.amount || 0), 0);
  const net = incTotal - expTotal;

  if (metricsPill) {
    metricsPill.style.display = 'flex';
    metricsPill.innerHTML = `
      <span><strong>${totalCount}</strong> ${totalCount === 1 ? 'registro' : 'registros'}</span>
      <span style="color: var(--border-medium);">|</span>
      <span style="color: #38bdf8;" title="Total de Entradas">+ ${formatCurrency(incTotal)}</span>
      <span style="color: var(--border-medium);">|</span>
      <span style="color: #f87171;" title="Total de Saídas">- ${formatCurrency(expTotal)}</span>
      <span style="color: var(--border-medium);">|</span>
      <span style="color: ${net >= 0 ? '#34d399' : '#f87171'}; font-weight: 700;" title="Saldo Líquido">${net >= 0 ? '+' : ''}${formatCurrency(net)}</span>
    `;
  }

  const cardSelVal = document.getElementById('tx-filter-card')?.value || currentCardFilter || 'all';
  const catSelVal = document.getElementById('tx-filter-category')?.value || currentCategoryFilter || 'all';
  const searchVal = document.getElementById('tx-search-input')?.value?.trim() || '';
  const hasRespFilter = currentResponsibleFilters && currentResponsibleFilters.length > 0;
  const hasPillFilter = currentFilter !== 'todos';
  const hasCardFilter = cardSelVal !== 'all';
  const hasCategoryFilter = catSelVal !== 'all';
  const hasPeriodFilter = currentPeriodPreset !== 'all' || Boolean(currentStartDate || currentEndDate);
  const hasSearch = searchVal.length > 0;

  const isAnyFilterActive = hasPillFilter || hasCardFilter || hasCategoryFilter || hasPeriodFilter || hasRespFilter || hasSearch;

  if (clearBtn) {
    clearBtn.style.display = isAnyFilterActive ? 'inline-flex' : 'none';
  }

  if (isAnyFilterActive && banner) {
    banner.style.display = 'flex';
    const activeTags = [];

    if (hasPillFilter) {
      const pillLabels = {
        'entradas': '🟢 Entradas (+)',
        'saidas': '🔴 Saídas (-)',
        'pagos': 'Liquidados',
        'agendados': 'Agendados',
        'atrasados': 'Atrasados',
        'faturas': 'Faturas Cartão',
        'contas_fixas': '📌 Contas Fixas',
        'mes': 'Mês Vigente'
      };
      activeTags.push(pillLabels[currentFilter] || currentFilter);
    }

    if (hasCardFilter) {
      if (cardSelVal === 'no_card') {
        activeTags.push('Sem Cartão (Conta/Pix)');
      } else {
        const c = (currentFinancialData?.cards || []).find(card => card.id === cardSelVal);
        activeTags.push(`Cartão: ${c ? c.name : cardSelVal}`);
      }
    }

    if (hasCategoryFilter) {
      activeTags.push(`Categoria: ${catSelVal}`);
    }

    if (hasPeriodFilter) {
      if (currentStartDate && currentEndDate) {
        activeTags.push(`Período: ${currentStartDate} a ${currentEndDate}`);
      } else if (currentPeriodPreset !== 'all') {
        const presetLabels = {
          'current_month': 'Mês Vigente',
          'last7': 'Últimos 7 dias',
          'last30': 'Últimos 30 dias',
          'last90': 'Últimos 90 dias',
          'year': 'Ano Atual (2026)'
        };
        activeTags.push(`Período: ${presetLabels[currentPeriodPreset] || currentPeriodPreset}`);
      }
    }

    if (hasRespFilter) {
      const allResps = (currentFinancialData && currentFinancialData.responsibles) || [];
      const names = currentResponsibleFilters.map(sel => {
        const m = allResps.find(r => r.toLowerCase() === sel.toLowerCase());
        return m || sel;
      });
      activeTags.push(`Resp: ${names.join(', ')}`);
    }

    if (hasSearch) {
      activeTags.push(`Busca: "${searchVal}"`);
    }

    if (bannerRespName) {
      bannerRespName.textContent = activeTags.join(' • ');
    }
    if (bannerStats) {
      bannerStats.textContent = `• ${totalCount} lançamentos (Entradas: ${formatCurrency(incTotal)} | Saídas: ${formatCurrency(expTotal)})`;
    }
  } else if (banner) {
    banner.style.display = 'none';
  }
}

function renderFullTransactionsTable() {
  const tbody = document.getElementById('full-transactions-table-body');
  if (!tbody) return;

  const searchVal = (document.getElementById('tx-search-input')?.value || '').toLowerCase().trim();
  const cardSelVal = document.getElementById('tx-filter-card')?.value || currentCardFilter || 'all';
  const catSelVal = document.getElementById('tx-filter-category')?.value || currentCategoryFilter || 'all';
  const useHeaderCompetency = (currentPeriodPreset === 'all' && !currentStartDate && !currentEndDate) || currentPeriodPreset === 'current_month';

  let baseTransactions = currentTransactions || [];
  if (useHeaderCompetency || currentFilter === 'mes') {
    baseTransactions = [...baseTransactions, ...getProjectedInstallmentsForMonth(currentCompetency)];
  }

  let filtered = baseTransactions.filter(tx => {
    // 1. Search text filter
    if (searchVal) {
      const desc = (tx.description || '').toLowerCase();
      const cat = (tx.category || '').toLowerCase();
      const resp = getTxResponsible(tx).toLowerCase();
      const card = (getTxCardName(tx) || '').toLowerCase();
      if (!desc.includes(searchVal) && !cat.includes(searchVal) && !resp.includes(searchVal) && !card.includes(searchVal)) {
        return false;
      }
    }

    // 2. Responsible filter
    if (currentResponsibleFilters && currentResponsibleFilters.length > 0) {
      const resp = getTxResponsible(tx);
      if (!isResponsibleSelected(resp)) return false;
    }

    // 3. Status & Type filter (pills)
    if (currentFilter === 'entradas') {
      if (tx.type !== 'INCOME') return false;
    } else if (currentFilter === 'saidas') {
      if (tx.type !== 'EXPENSE') return false;
    } else if (currentFilter === 'pagos') {
      if (tx.isPaid === false || tx.is_paid === false) return false;
    } else if (currentFilter === 'agendados') {
      if (tx.isPaid !== false && tx.is_paid !== false) return false;
    } else if (currentFilter === 'atrasados') {
      const isUnpaid = (tx.isPaid === false || tx.is_paid === false);
      const isPast = tx.date && new Date(tx.date) < new Date(`${currentCompetency}-01`);
      if (!isUnpaid || !isPast) return false;
    } else if (currentFilter === 'faturas') {
      const isCard = tx.isInstallment || tx.paymentMethod === 'CREDIT_CARD' || !!tx.cardId;
      if (!isCard) return false;
    } else if (currentFilter === 'contas_fixas') {
      if (!isFixedBill(tx)) return false;
    } else if (currentFilter === 'mes') {
      if (!tx.date || !tx.date.startsWith(currentCompetency)) return false;
    }

    // 4. Card filter
    if (cardSelVal && cardSelVal !== 'all') {
      if (cardSelVal === 'no_card') {
        const isCard = tx.cardId || tx.card_id || tx.paymentMethod === 'CREDIT_CARD' || tx.isInstallment;
        if (isCard) return false;
      } else {
        const targetCard = (currentFinancialData?.cards || []).find(c => c.id === cardSelVal);
        let match = (tx.cardId === cardSelVal || tx.card_id === cardSelVal);
        if (!match && targetCard) {
          const cardName = targetCard.name.toLowerCase();
          const account = (tx.account || '').toLowerCase();
          const desc = (tx.description || '').toLowerCase();
          if (account && account.includes(cardName)) match = true;
          if (!match && targetCard.brand && account.includes(targetCard.brand.toLowerCase())) match = true;
          if (!match && desc.includes(cardName)) match = true;
          if (!match && tx.installmentId && currentFinancialData?.installments) {
            const inst = currentFinancialData.installments.find(i => i.id === tx.installmentId);
            if (inst && inst.cardId === cardSelVal) match = true;
          }
        }
        if (!match) return false;
      }
    }

    // 4.1 Category filter
    if (catSelVal && catSelVal !== 'all') {
      const txCat = (tx.category || 'Geral').toLowerCase().trim();
      const filterCat = catSelVal.toLowerCase().trim();
      if (filterCat === 'conta fixa') {
        if (!isFixedBill(tx)) return false;
      } else if (txCat !== filterCat) {
        return false;
      }
    }

    // 5. Header Competency filter (when no custom period range overrides it)
    const txDateStr = (tx.date || tx.created_at || '').slice(0, 10);
    if (useHeaderCompetency) {
      if (!txDateStr.startsWith(currentCompetency)) return false;
    }

    // 6. Period filter (Date range)
    if (currentStartDate && txDateStr && txDateStr < currentStartDate) return false;
    if (currentEndDate && txDateStr && txDateStr > currentEndDate) return false;

    return true;
  });

  updateTxFilterMetricsAndBanner(filtered);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 28px;">Nenhum lançamento encontrado para os filtros selecionados.<br><button class="btn-action-text" style="margin-top: 8px; color: var(--color-primary-light); cursor: pointer;" onclick="window.clearAllTxFilters()">Limpar todos os filtros</button></td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(tx => {
    const resp = getTxResponsible(tx);
    const badgeCls = getResponsibleClass(resp);
    const cardName = getTxCardName(tx);
    const methodLabel = cardName ? `💳 ${escapeHtml(cardName)}` : (tx.paymentMethod === 'CREDIT_CARD' ? '💳 Cartão de Crédito' : (tx.paymentMethod ? `⚡ ${tx.paymentMethod}` : 'Pix / Débito'));

    return `
    <tr class="tx-table-row">
      <td style="color: var(--text-muted); font-size: 11px;">${formatDate(tx.date || tx.created_at)}</td>
      <td>
        <div class="tx-desc-title">${escapeHtml(tx.description)}</div>
        <div class="tx-desc-sub"><span style="color: ${cardName ? 'var(--color-primary-light)' : 'var(--text-muted)'};">${methodLabel}</span> • ${escapeHtml(tx.category || 'Geral')}</div>
      </td>
      <td>
        <span class="badge-resp ${badgeCls}" onclick="window.handleBadgeClick(event, '${escapeHtml(resp)}')" title="Clique para filtrar por ${escapeHtml(resp)} (Ctrl+Clique para multi-seleção)">
          👤 ${escapeHtml(resp)}
        </span>
      </td>
      <td class="tx-amount ${tx.type === 'INCOME' ? 'positive' : 'negative'}">
        ${tx.type === 'INCOME' ? '+' : '-'} ${formatCurrency(tx.amount)}
      </td>
      <td style="text-align: right;">
        ${tx.isProjectedInstallment
          ? `<span style="font-size: 10px; color: #60a5fa; background: rgba(37, 99, 235, 0.12); border: 1px solid rgba(37, 99, 235, 0.28); padding: 2px 8px; border-radius: 10px;">Parcela Prevista</span>`
          : `<div class="tx-actions-group" style="justify-content: flex-end;">
               <button class="btn-action-text" style="font-size: 11px; padding: 2px 6px; width: auto;" onclick="window.openEditTxModal('${tx.id}')">Editar</button>
               <button class="btn-action-text" style="font-size: 11px; color: var(--color-danger); padding: 2px 6px; width: auto;" onclick="deleteTx('${tx.id}')">Excluir</button>
             </div>`
        }
      </td>
    </tr>
  `;
  }).join('');
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
        <button class="btn-pay-invoice-pill" onclick="payCardInvoice('${c.id}')">Pagar fatura</button>
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

window.payCardInvoice = async function(cardId) {
  if (!confirm('Deseja liquidar integralmente a fatura atual com débito na conta principal?')) return;
  try {
    const res = await fetch(`/api/cards/${cardId}/pay-invoice`, { method: 'POST' }).then(r => r.json());
    if (res.success) {
      window.showToast(res.message, '💳');
      await refreshAllData();
    } else {
      window.showToast(res.error || 'Erro ao processar pagamento', '⚠️');
    }
  } catch (err) {
    console.error(err);
  }
};

function renderOpenFinanceCards() {
  const container = document.getElementById('open-finance-cards-grid');
  if (!container || !currentFinancialData) return;

  const cards = currentFinancialData.cards || [];
  if (cards.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 30px; color: var(--text-muted); background: var(--bg-card); border-radius: 12px; border: 1px dashed var(--border-medium);">
        Nenhum cartão cadastrado. Clique no botão <strong>"+ Adicionar Cartão"</strong> acima para começar.
      </div>
    `;
  } else {
    container.innerHTML = cards.map(c => `
      <div class="mi-card" style="border-left: 4px solid var(--color-primary); position: relative; overflow: hidden;">
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: ${c.color || 'var(--color-primary-gradient)'};"></div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
          <div>
            <span style="font-size: 15px; font-weight: 700;">${escapeHtml(c.name)}</span>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">${escapeHtml(c.brand)} •••• ${escapeHtml(c.last4)}</div>
          </div>
          <div style="display: flex; gap: 6px;">
            <button type="button" class="btn-action-text" onclick="window.openEditCardModal('${c.id}')" style="font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(255,255,255,0.06); color: var(--color-primary-light); cursor: pointer;" title="Editar dados do cartão">✏️ Editar</button>
            <button type="button" class="btn-action-text" onclick="window.payCardInvoice('${c.id}')" style="font-size: 11px; padding: 4px 8px; border-radius: 6px; background: rgba(56, 189, 248, 0.12); color: #38bdf8; cursor: pointer;" title="Pagar fatura atual">Pagar</button>
          </div>
        </div>
        <div style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">${formatCurrency(c.currentInvoice)}</div>
        <div style="font-size: 11px; color: var(--text-muted); margin-bottom: 12px;">Fatura aberta • Vence dia ${c.dueDay} (Fecha dia ${c.closingDay})</div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: ${c.usedPercentage}%; background: ${c.color || 'var(--color-primary-gradient)'};"></div>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted); margin-top: 8px;">
          <span>Limite: ${formatCurrency(c.limitTotal)}</span>
          <span>Disponível: ${formatCurrency(c.limitAvailable)}</span>
        </div>
      </div>
    `).join('');
  }

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
      const safeLabel = escapeHtml(m.monthLabel || m.shortLabel || '');
      const itemsCount = (m.items && m.items.length) || 0;
      return `
        <div class="projection-bar-col"
             onmouseenter="window.showProjectionTooltip(event, '${safeLabel}', ${m.total}, ${itemsCount})"
             onmousemove="window.positionChartTooltip(event)"
             onmouseleave="window.hideChartTooltip()"
             style="flex: 1; min-width: 44px; display: flex; flex-direction: column; align-items: center; gap: 6px; cursor: pointer; padding: 4px; border-radius: 6px; transition: background 0.2s;">
          <span style="font-size: 10px; font-weight: 700; color: var(--color-primary-light);">${formatCurrency(m.total)}</span>
          <div style="width: 100%; height: 120px; display: flex; align-items: flex-end; justify-content: center;">
            <div class="projection-bar-elem" style="width: 24px; height: ${Math.max(hPct, 8)}%; background: var(--color-primary-gradient); border-radius: 4px 4px 0 0; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 2px 8px rgba(59, 130, 246, 0.25);"></div>
          </div>
          <span style="font-size: 10px; color: var(--text-subtle);">${m.shortLabel}</span>
        </div>
      `;
    }).join('');
  }
}

// ==========================================================================
// BILLS WIDGETS (PAGAR & A RECEBER - PERSISTED NO SUPABASE)
// ==========================================================================
function renderBillsLists() {
  const pagarBox = document.getElementById('dash-pagar-container');
  const receberBox = document.getElementById('dash-receber-container');
  const allBills = (currentFinancialData && currentFinancialData.bills) || [];

  let payItems = allBills.filter(b => b.type === 'PAY' && (!b.dueDate || b.dueDate.startsWith(currentCompetency)));
  let receiveItems = allBills.filter(b => b.type === 'RECEIVE' && (!b.dueDate || b.dueDate.startsWith(currentCompetency)));

  if (currentResponsibleFilters && currentResponsibleFilters.length > 0) {
    payItems = payItems.filter(b => isResponsibleSelected(b.responsible || 'Marcos'));
    receiveItems = receiveItems.filter(b => isResponsibleSelected(b.responsible || 'Marcos'));
  }

  if (pagarBox) {
    if (payItems.length === 0) {
      pagarBox.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 12px;">Sem contas a pagar pendentes.</div>';
    } else {
      pagarBox.innerHTML = payItems.map(b => {
        const dStr = b.dueDate ? b.dueDate.slice(8, 10) + '/' + b.dueDate.slice(5, 7) : '--/--';
        return `
          <div class="action-bill-row">
            <span class="bill-date">${dStr}</span>
            <span class="bill-desc" title="${escapeHtml(b.description)}">${escapeHtml(b.description)}</span>
            <span class="bill-val pay">${formatCurrency(b.amount)}</span>
            <div class="check-action-circle ${b.isPaid ? 'checked' : ''}" onclick="toggleBillStatus('${b.id}', ${b.isPaid})">✓</div>
          </div>
        `;
      }).join('');
    }
  }

  if (receberBox) {
    if (receiveItems.length === 0) {
      receberBox.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); text-align: center; padding: 12px;">Sem recebíveis previstos.</div>';
    } else {
      receberBox.innerHTML = receiveItems.map(b => {
        const dStr = b.dueDate ? b.dueDate.slice(8, 10) + '/' + b.dueDate.slice(5, 7) : '--/--';
        return `
          <div class="action-bill-row">
            <span class="bill-date">${dStr}</span>
            <span class="bill-desc" title="${escapeHtml(b.description)}">${escapeHtml(b.description)}</span>
            <span class="bill-val receive">${formatCurrency(b.amount)}</span>
            <div class="check-action-circle ${b.isPaid ? 'checked' : ''}" onclick="toggleBillStatus('${b.id}', ${b.isPaid})">✓</div>
          </div>
        `;
      }).join('');
    }
  }

  // Pagar tudo button
  const btnPayAll = document.getElementById('btn-pay-all');
  if (btnPayAll) {
    btnPayAll.onclick = async () => {
      try {
        const res = await fetch('/api/bills/pay-all', { method: 'POST' }).then(r => r.json());
        if (res.success) {
          window.showToast('Todas as contas foram liquidadas!', '💳');
          await refreshAllData();
        }
      } catch (err) { console.error(err); }
    };
  }

  // Receber tudo button
  const btnReceiveAll = document.getElementById('btn-receive-all');
  if (btnReceiveAll) {
    btnReceiveAll.onclick = async () => {
      try {
        const res = await fetch('/api/bills/receive-all', { method: 'POST' }).then(r => r.json());
        if (res.success) {
          window.showToast('Todas as receitas foram conciliadas!', '💵');
          await refreshAllData();
        }
      } catch (err) { console.error(err); }
    };
  }
}

window.toggleBillStatus = async function(id, currentStatus) {
  try {
    const res = await fetch(`/api/bills/${id}/toggle`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isPaid: !currentStatus })
    }).then(r => r.json());

    if (res.success) {
      window.showToast(!currentStatus ? 'Status liquidado!' : 'Status reaberto', '✓');
      await refreshAllData();
    }
  } catch (err) {
    console.error(err);
  }
};

// ==========================================================================
// ORÇAMENTOS (BUDGETS) & METAS (GOALS) PERSISTIDOS NO SUPABASE
// ==========================================================================
function renderBudgets() {
  const box = document.getElementById('active-budgets-container');
  if (!box) return;

  const budgets = (currentFinancialData && currentFinancialData.budgets) || [];
  if (budgets.length === 0) {
    box.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 14px; text-align: center; border: 1px dashed var(--border-subtle); border-radius: 4px;">Nenhum teto orçamentário configurado.</div>';
    return;
  }

  box.innerHTML = budgets.map(b => {
    const pct = b.percentage != null ? b.percentage : Math.min(100, Math.round(((b.spentAmount || 0) / (b.monthlyLimit || 1)) * 100));
    const isWarning = pct >= 80;
    return `
      <div class="budget-card-box">
        <div class="budget-card-header">
          <span style="font-weight: 600;">${escapeHtml(b.category)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: ${isWarning ? '#f59e0b' : 'var(--color-primary-light)'}; font-weight: 600;">${pct}% executado</span>
            <button class="btn-action-text" style="width: auto; padding: 0 4px; color: var(--color-danger); font-size: 10px;" onclick="deleteBudget('${b.id}')" title="Excluir Orçamento">✕</button>
          </div>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: ${pct}%; background: ${isWarning ? '#f59e0b' : 'var(--color-primary-gradient)'};"></div>
        </div>
        <div class="budget-card-values">
          <span>Gasto: ${formatCurrency(b.spentAmount)}</span>
          <span>Teto: ${formatCurrency(b.monthlyLimit)}</span>
        </div>
      </div>
    `;
  }).join('');
}

window.deleteBudget = async function(id) {
  if (!confirm('Deseja excluir este teto orçamentário?')) return;
  try {
    const res = await fetch(`/api/budgets/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.success) {
      window.showToast('Orçamento excluído!', '🗑️');
      await refreshAllData();
    }
  } catch (err) {
    console.error(err);
  }
};

function renderGoals() {
  const box = document.getElementById('active-goals-container');
  if (!box) return;

  const goals = (currentFinancialData && currentFinancialData.goals) || [];
  if (goals.length === 0) {
    box.innerHTML = '<div style="color: var(--text-muted); font-size: 11px; padding: 14px; text-align: center; border: 1px dashed var(--border-subtle); border-radius: 4px;">Nenhuma meta estratégica cadastrada.</div>';
    return;
  }

  box.innerHTML = goals.map(g => {
    const pct = g.targetAmount > 0 ? Math.min(100, Math.round(((g.currentAmount || 0) / g.targetAmount) * 100)) : 0;
    return `
      <div class="progress-row-item" style="background: var(--bg-card); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
        <div class="progress-label-row">
          <span style="font-weight: 600;">${escapeHtml(g.title)}</span>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="progress-pct-badge">${pct}% concluído</span>
            <button class="btn-action-text" style="width: auto; padding: 0 4px; color: var(--color-danger); font-size: 10px;" onclick="deleteGoal('${g.id}')" title="Excluir Meta">✕</button>
          </div>
        </div>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" style="width: ${pct}%;"></div>
        </div>
        <div class="budget-card-values" style="margin-top: 4px;">
          <span>Posição Atual: ${formatCurrency(g.currentAmount)}</span>
          <span>Objetivo: ${formatCurrency(g.targetAmount)}</span>
        </div>
        <div class="meta-timeline-phrase" style="margin-top: 4px; font-size: 10px; color: var(--text-subtle);">
          Prazo: ${g.deadlineDate ? formatDate(g.deadlineDate) : 'Meta contínua'}
        </div>
      </div>
    `;
  }).join('');
}

window.deleteGoal = async function(id) {
  if (!confirm('Deseja excluir esta meta?')) return;
  try {
    const res = await fetch(`/api/goals/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.success) {
      window.showToast('Meta estratégica removida!', '🗑️');
      await refreshAllData();
    }
  } catch (err) {
    console.error(err);
  }
};

function syncSettingsUI() {
  if (!currentFinancialData) return;
  const balIn = document.getElementById('settings-balance');
  const resIn = document.getElementById('settings-reserve');
  const invIn = document.getElementById('settings-investments');
  if (balIn && document.activeElement !== balIn) balIn.value = currentFinancialData.accountBalance != null ? currentFinancialData.accountBalance : 0;
  if (resIn && document.activeElement !== resIn) resIn.value = currentFinancialData.emergencyReserve != null ? currentFinancialData.emergencyReserve : 0;
  if (invIn && document.activeElement !== invIn) invIn.value = currentFinancialData.investmentsBalance != null ? currentFinancialData.investmentsBalance : 0;

  const settings = currentFinancialData.settings || {};
  const tDue = document.getElementById('toggle-alert-due');
  const tBud = document.getElementById('toggle-alert-budget');
  const tWk = document.getElementById('toggle-alert-weekly');
  const tDb = document.getElementById('toggle-supabase-status');

  if (tDue && settings.alertDueDates !== undefined) tDue.checked = settings.alertDueDates;
  if (tBud && settings.alertBudgetLimit !== undefined) tBud.checked = settings.alertBudgetLimit;
  if (tWk && settings.alertWeeklyReport !== undefined) tWk.checked = settings.alertWeeklyReport;
  if (tDb) tDb.checked = currentFinancialData.isUsingSupabase !== false;
}

// ==========================================================================
// CALENDÁRIO DE VENCIMENTO (Images 3 & 4)
// ==========================================================================
function initCalendar() {
  const grid = document.getElementById('dash-calendar-grid');
  if (!grid) return;

  const p = getCompetencyParts(currentCompetency);
  const labelEl = document.getElementById('dash-calendar-month-label');
  if (labelEl) {
    labelEl.textContent = `${p.monthName} ${p.yearStr}`;
  }

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const now = new Date();
  const realTodayYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const today = currentCompetency === realTodayYM ? now.getDate() : -1;
  const daysInMonth = new Date(p.year, p.month, 0).getDate();
  const firstWeekday = new Date(p.year, p.month - 1, 1).getDay();

  const allBills = (currentFinancialData && currentFinancialData.bills) || [];
  const cards = (currentFinancialData && currentFinancialData.cards) || [];

  const dayEvents = {};
  allBills.forEach(b => {
    if (b.dueDate && b.dueDate.startsWith(currentCompetency)) {
      const d = parseInt(b.dueDate.slice(8, 10), 10);
      if (d >= 1 && d <= daysInMonth) {
        if (!dayEvents[d]) dayEvents[d] = [];
        dayEvents[d].push(`${b.description}: ${formatCurrency(b.amount)}`);
      }
    }
  });
  cards.forEach(c => {
    if (c.dueDay && c.dueDay >= 1 && c.dueDay <= daysInMonth) {
      if (!dayEvents[c.dueDay]) dayEvents[c.dueDay] = [];
      dayEvents[c.dueDay].push(`Fatura ${c.name}: ${formatCurrency(c.currentInvoice || 0)}`);
    }
  });

  let html = daysOfWeek.map(d => `<div class="cal-day-name">${d}</div>`).join('');

  for (let blank = 0; blank < firstWeekday; blank++) {
    html += `<div class="cal-day-num empty" style="opacity: 0; pointer-events: none;"></div>`;
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const events = dayEvents[i] || [];
    const isDue = events.length > 0;
    const isToday = i === today;
    const safeMsg = isDue 
      ? `Dia ${i} • ${events.join(' | ')}`
      : `Dia ${i} • Sem vencimentos programados`;

    html += `
      <div class="cal-day-num ${isToday ? 'today' : ''} ${isDue ? 'has-due' : ''}" 
           title="${isDue ? events.join(' - ') : 'Sem vencimentos'}"
           onclick="window.showToast('${safeMsg.replace(/'/g, "\\'")}', '${isDue ? '📅' : '✨'}')">
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
// SVG CHARTS RENDERING (Projeção de Saldo, Donut, Timeline & Tooltips)
// ==========================================================================
function renderBarsChart() {
  const box = document.getElementById('dashboard-bars-svg-box');
  if (!box) return;

  const currentYM = currentCompetency;
  const compParts = getCompetencyParts(currentYM);
  let chartData = []; // Array of { ym?, label, fullLabel, income, expense }

  const getMonthMetrics = (ym) => {
    if (ym === currentYM && currentFinancialData) {
      if (currentResponsibleFilters && currentResponsibleFilters.length > 0) {
        const stats = currentFinancialData.responsibleStats || {};
        let exp = 0; let inc = 0;
        currentResponsibleFilters.forEach(sel => {
          const k = Object.keys(stats).find(key => key.toLowerCase() === sel.toLowerCase());
          if (k && stats[k]) {
            exp += (stats[k].expenses || 0) + (stats[k].invoices || 0);
            inc += (stats[k].income || 0);
          }
        });
        return { income: inc, expense: exp };
      }
      return {
        income: currentFinancialData.currentMonthIncome || 0,
        expense: (currentFinancialData.currentMonthExpenses || 0) + (currentFinancialData.totalInvoicesCurrent || 0)
      };
    }

    const isFiltered = currentResponsibleFilters && currentResponsibleFilters.length > 0;
    const txs = (currentTransactions || []).filter(t => (t.date || '').startsWith(ym) && (!isFiltered || isResponsibleSelected(getTxResponsible(t))));
    const incTxs = txs.filter(t => t.type === 'INCOME').reduce((s, t) => s + Number(t.amount || 0), 0);
    const allBills = (currentFinancialData && currentFinancialData.bills) || [];
    const recBills = allBills.filter(b => b.type === 'RECEIVE' && b.dueDate && b.dueDate.startsWith(ym) && (!isFiltered || isResponsibleSelected(b.responsible || 'Marcos'))).reduce((s, b) => s + Number(b.amount || 0), 0);
    const inc = incTxs + recBills;

    const nonCardExp = txs.filter(t => t.type === 'EXPENSE' && !t.isInstallment && (!t.cardId || t.paymentMethod !== 'CREDIT_CARD')).reduce((s, t) => s + Number(t.amount || 0), 0);
    const singleCardExp = txs.filter(t => t.type === 'EXPENSE' && !t.isInstallment && t.cardId).reduce((s, t) => s + Number(t.amount || 0), 0);
    const projMonths = currentProjectionData?.projection?.months || [];
    const projEntry = projMonths.find(m => m.yearMonth === ym);
    const instExp = projEntry ? Number(projEntry.total || 0) : 0;

    return { income: inc, expense: nonCardExp + singleCardExp + instExp };
  };

  if (currentFlowPeriod === 'mes') {
    const allBills = (currentFinancialData && currentFinancialData.bills) || [];
    const filteredBills = allBills.filter(b => isResponsibleSelected(b.responsible || 'Marcos') && (!b.dueDate || b.dueDate.startsWith(currentYM)));
    const daysInMonth = new Date(compParts.year, compParts.month, 0).getDate();
    const ms = compParts.monthShort;

    const weeks = [
      { label: 'Sem 1', fullLabel: `Semana 1 • 01 a 07/${ms}`, startDay: 1, endDay: 7, income: 0, expense: 0 },
      { label: 'Sem 2', fullLabel: `Semana 2 • 08 a 14/${ms}`, startDay: 8, endDay: 14, income: 0, expense: 0 },
      { label: 'Sem 3', fullLabel: `Semana 3 • 15 a 21/${ms}`, startDay: 15, endDay: 21, income: 0, expense: 0 },
      { label: 'Sem 4 (Faturas)', fullLabel: `Semana 4 • 22 a 28/${ms} (Vencimento Faturas)`, startDay: 22, endDay: 28, income: 0, expense: 0 },
      { label: 'Sem 5', fullLabel: `Semana 5 • 29 a ${daysInMonth}/${ms}`, startDay: 29, endDay: 31, income: 0, expense: 0 }
    ];

    filteredBills.forEach(b => {
      const day = b.dueDate ? parseInt(b.dueDate.slice(8, 10), 10) : 1;
      const amt = Number(b.amount || 0);
      const w = weeks.find(wk => day >= wk.startDay && day <= wk.endDay) || weeks[0];
      if (b.type === 'RECEIVE') w.income += amt;
      else w.expense += amt;
    });

    const stats = currentFinancialData?.responsibleStats || {};
    let totalInv = 0;
    if (currentResponsibleFilters && currentResponsibleFilters.length > 0) {
      currentResponsibleFilters.forEach(sel => {
        const k = Object.keys(stats).find(key => key.toLowerCase() === sel.toLowerCase());
        if (k && stats[k]) totalInv += (stats[k].invoices || 0);
      });
    } else {
      totalInv = currentFinancialData ? Number(currentFinancialData.totalInvoicesCurrent || 0) : 0;
    }
    weeks[3].expense += totalInv;

    (currentTransactions || []).filter(t => isResponsibleSelected(getTxResponsible(t)) && (t.date || '').startsWith(currentYM)).forEach(t => {
      const d = t.date ? parseInt(t.date.slice(8, 10), 10) : 1;
      const amt = Number(t.amount || 0);
      const w = weeks.find(wk => d >= wk.startDay && d <= wk.endDay) || weeks[0];
      if (t.type === 'INCOME') w.income += amt;
    });

    chartData = weeks;
  } else if (currentFlowPeriod === 'periodo') {
    const offsets = [-2, -1, 0, 1, 2, 3];
    chartData = offsets.map(off => {
      const ym = addMonthsYM(currentYM, off);
      const p = getCompetencyParts(ym);
      const m = getMonthMetrics(ym);
      const suffix = off === 0 ? ' (Selecionado)' : (off > 0 ? ' (Projetado)' : '');
      return {
        ym,
        label: `${p.monthShort}/${p.yearStr.slice(2)}`,
        fullLabel: `${p.monthName}/${p.yearStr}${suffix}`,
        income: m.income,
        expense: m.expense
      };
    });
  } else {
    chartData = COMP_MONTH_SHORT.map((mName, idx) => {
      const ym = `${compParts.yearStr}-${String(idx + 1).padStart(2, '0')}`;
      const m = getMonthMetrics(ym);
      return {
        ym,
        label: mName,
        fullLabel: `${COMP_MONTH_NAMES[idx]} • ${compParts.yearStr}`,
        income: m.income,
        expense: m.expense
      };
    });
  }

  // Calculate SVG layout
  const count = chartData.length;
  const svgW = 500;
  const svgH = 180;
  const padX = 20;
  const usableW = svgW - padX * 2;
  const colW = usableW / count;
  const barW = Math.min(14, Math.max(8, colW * 0.28));

  let maxVal = 1000;
  chartData.forEach(d => {
    if (d.income > maxVal) maxVal = d.income * 1.15;
    if (d.expense > maxVal) maxVal = d.expense * 1.15;
  });

  let colsHtml = '';
  chartData.forEach((d, idx) => {
    const colX = padX + idx * colW;
    const centerX = colX + colW / 2;

    const incH = Math.max(2, (d.income / maxVal) * (svgH - 45));
    const expH = Math.max(2, (d.expense / maxVal) * (svgH - 45));

    const incY = svgH - 26 - incH;
    const expY = svgH - 26 - expH;

    const bar1X = centerX - barW - 1;
    const bar2X = centerX + 1;
    const isSelected = d.ym && d.ym === currentYM;
    const clickAttr = d.ym ? `style="cursor: pointer;" onclick="window.setCompetency('${d.ym}')"` : '';

    colsHtml += `
      <g class="chart-col-group" ${clickAttr}
         onmouseenter="window.showFlowTooltip(event, '${d.fullLabel}', ${d.income}, ${d.expense})"
         onmousemove="window.positionChartTooltip(event)"
         onmouseleave="window.hideChartTooltip()">
        <!-- Hover highlight backdrop -->
        <rect class="chart-col-bg" x="${colX + 1}" y="12" width="${colW - 2}" height="${svgH - 36}" rx="4" fill="#fff" opacity="${isSelected ? '0.05' : '0'}" />
        
        <!-- Income Bar (Blue) -->
        <rect class="chart-bar-rect income" x="${bar1X}" y="${incY}" width="${barW}" height="${incH}" rx="2" fill="${isSelected ? '#3b82f6' : '#2563eb'}" />
        
        <!-- Expense Bar (Slate/Coral) -->
        <rect class="chart-bar-rect expense" x="${bar2X}" y="${expY}" width="${barW}" height="${expH}" rx="2" fill="${isSelected ? '#64748b' : '#475569'}" />
        
        <!-- Column Label -->
        <text x="${centerX}" y="${svgH - 8}" text-anchor="middle" font-size="10" font-weight="${isSelected ? '700' : '500'}" fill="${isSelected ? '#60a5fa' : 'var(--text-subtle)'}">${d.label}</text>
      </g>
    `;
  });

  box.innerHTML = `
    <svg viewBox="0 0 ${svgW} ${svgH}" width="100%" height="100%" style="overflow: visible; display: block;">
      <!-- Grid lines -->
      <line x1="16" y1="30" x2="${svgW - 16}" y2="30" stroke="var(--border-subtle)" stroke-dasharray="3 3" opacity="0.6" />
      <line x1="16" y1="75" x2="${svgW - 16}" y2="75" stroke="var(--border-subtle)" stroke-dasharray="3 3" opacity="0.6" />
      <line x1="16" y1="120" x2="${svgW - 16}" y2="120" stroke="var(--border-subtle)" stroke-dasharray="3 3" opacity="0.6" />
      <line x1="16" y1="${svgH - 25}" x2="${svgW - 16}" y2="${svgH - 25}" stroke="var(--border-subtle)" />
      ${colsHtml}
    </svg>
  `;
}

function renderDonutChart() {
  const box = document.getElementById('dashboard-donut-svg-box');
  const legendBox = document.getElementById('dashboard-donut-legend');
  if (!box) return;

  const c = 2 * Math.PI * 50; // ≈ 314.16

  let items = [];

  if (currentDistributionType === 'entradas') {
    const inc = currentFinancialData ? Number(currentFinancialData.currentMonthIncome || 0) : 0;
    if (inc <= 0) {
      box.innerHTML = `
        <svg viewBox="0 0 140 140" width="100%" height="100%">
          <circle cx="70" cy="70" r="50" fill="transparent" stroke="var(--border-subtle)" stroke-width="14" stroke-dasharray="4 4" />
          <text x="70" y="66" text-anchor="middle" font-size="9" fill="var(--text-muted)">Entradas</text>
          <text x="70" y="82" text-anchor="middle" font-size="11" font-weight="700" fill="#38bdf8">R$ 0,00</text>
        </svg>
      `;
      if (legendBox) {
        legendBox.innerHTML = `
          <div class="donut-legend-item" style="color: var(--text-muted); font-size: 11px;">
            Nenhuma receita em ${getCompetencyParts(currentCompetency).monthName}.
          </div>
        `;
      }
      return;
    }

    const currentYM = currentCompetency;
    const isFiltered = currentResponsibleFilters && currentResponsibleFilters.length > 0;
    const monthIncomes = (currentTransactions || []).filter(t => t.type === 'INCOME' && (t.date || '').startsWith(currentYM) && (!isFiltered || isResponsibleSelected(getTxResponsible(t))));
    const colorPalette = ['#38bdf8', '#34d399', '#818cf8', '#f472b6', '#fbbf24', '#a78bfa', '#2dd4bf'];
    items = monthIncomes.map((t, idx) => ({
      name: t.description,
      amount: Number(t.amount || 0),
      color: colorPalette[idx % colorPalette.length]
    }));
  } else {
    // Despesas Consolidadas:
    const isFiltered = currentResponsibleFilters && currentResponsibleFilters.length > 0;
    if (isFiltered) {
      const stats = currentFinancialData?.responsibleStats || {};
      let fixas = 0; let faturas = 0;
      currentResponsibleFilters.forEach(sel => {
        const k = Object.keys(stats).find(key => key.toLowerCase() === sel.toLowerCase());
        if (k && stats[k]) {
          fixas += (stats[k].expenses || 0);
          faturas += (stats[k].invoices || 0);
        }
      });
      items = [
        { name: 'Faturas de Cartão', amount: faturas, color: '#2563eb' },
        { name: 'Contas Fixas & Boletos', amount: fixas, color: '#3b82f6' }
      ].filter(i => i.amount > 0);
    } else {
      const allBills = (currentFinancialData && currentFinancialData.bills) || [];
      const monthBills = allBills.filter(b => b.type === 'PAY' && (!b.dueDate || b.dueDate.startsWith(currentCompetency)));

      let habitacao = 0, mercado = 0, utilidades = 0, outras = 0;
      monthBills.forEach(b => {
        const d = (b.description || '').toLowerCase();
        const amt = Number(b.amount || 0);
        if (d.includes('casa') || d.includes('terreno') || d.includes('aluguel') || d.includes('financiamento')) habitacao += amt;
        else if (d.includes('mercado') || d.includes('aliment')) mercado += amt;
        else if (d.includes('energia') || d.includes('luz') || d.includes('água') || d.includes('agua') || d.includes('net') || d.includes('internet') || d.includes('tim')) utilidades += amt;
        else outras += amt;
      });

      const nonCardTxs = (currentTransactions || []).filter(t => t.type === 'EXPENSE' && !t.isInstallment && (!t.cardId || t.paymentMethod !== 'CREDIT_CARD') && (t.date || '').startsWith(currentCompetency));
      if (monthBills.length === 0 && nonCardTxs.length > 0) {
        nonCardTxs.forEach(t => {
          const d = `${t.description || ''} ${t.category || ''}`.toLowerCase();
          const amt = Number(t.amount || 0);
          if (d.includes('casa') || d.includes('terreno') || d.includes('aluguel') || d.includes('financiamento')) habitacao += amt;
          else if (d.includes('mercado') || d.includes('aliment')) mercado += amt;
          else if (d.includes('energia') || d.includes('luz') || d.includes('água') || d.includes('agua') || d.includes('net') || d.includes('internet') || d.includes('tim')) utilidades += amt;
          else outras += amt;
        });
      }

      const faturasAmt = Number(currentFinancialData?.totalInvoicesCurrent || 0);

      items = [
        { name: 'Faturas de Cartão', amount: faturasAmt, color: '#2563eb' },
        { name: 'Habitação (Casa/Terreno)', amount: habitacao, color: '#3b82f6' },
        { name: 'Mercado & Alimentação', amount: mercado, color: '#06b6d4' },
        { name: 'Utilidades (Luz/Água/Net)', amount: utilidades, color: '#10b981' },
        { name: 'Outras Despesas Fixas', amount: outras, color: '#8b5cf6' }
      ].filter(i => i.amount > 0);
    }
  }

  if (items.length === 0) {
    box.innerHTML = `
      <svg viewBox="0 0 140 140" width="100%" height="100%">
        <circle cx="70" cy="70" r="50" fill="transparent" stroke="var(--border-subtle)" stroke-width="14" stroke-dasharray="4 4" />
        <text x="70" y="66" text-anchor="middle" font-size="9" fill="var(--text-muted)">Saídas</text>
        <text x="70" y="82" text-anchor="middle" font-size="11" font-weight="700" fill="#94a3b8">R$ 0,00</text>
      </svg>
    `;
    if (legendBox) {
      legendBox.innerHTML = `
        <div class="donut-legend-item" style="color: var(--text-muted); font-size: 11px;">
          Nenhuma despesa em ${getCompetencyParts(currentCompetency).monthName}.
        </div>
      `;
    }
    return;
  }

  const total = items.reduce((s, i) => s + i.amount, 0) || 1;
  let accumulated = 0;

  let circlesHtml = '';
  items.forEach(item => {
    const pct = (item.amount / total) * 100;
    const dash = (item.amount / total) * c;
    const offset = -accumulated;
    accumulated += dash;

    circlesHtml += `
      <circle class="donut-slice" cx="70" cy="70" r="50"
              fill="transparent"
              stroke="${item.color}"
              stroke-width="16"
              stroke-dasharray="${dash} ${c - dash}"
              stroke-dashoffset="${offset}"
              onmouseenter="window.onDonutHover(event, '${item.name}', ${item.amount}, ${pct})"
              onmousemove="window.positionChartTooltip(event)"
              onmouseleave="window.onDonutLeave(${total})" />
    `;
  });

  box.innerHTML = `
    <svg viewBox="0 0 140 140" width="100%" height="100%" style="transform: rotate(-90deg); overflow: visible;">
      ${circlesHtml}
      <g style="transform: rotate(90deg); transform-origin: 70px 70px;">
        <text id="donut-center-lbl" x="70" y="65" text-anchor="middle" font-size="9" fill="var(--text-muted)">${currentDistributionType === 'entradas' ? 'Total Entradas' : 'Total Saídas'}</text>
        <text id="donut-center-val" x="70" y="82" text-anchor="middle" font-size="11" font-weight="700" fill="#fff">${formatCurrency(total)}</text>
      </g>
    </svg>
  `;

  if (legendBox) {
    legendBox.innerHTML = items.map(item => {
      const pct = ((item.amount / total) * 100).toFixed(0);
      return `
        <div class="donut-legend-item"
             onmouseenter="window.onDonutHover(event, '${item.name}', ${item.amount}, ${(item.amount / total) * 100})"
             onmousemove="window.positionChartTooltip(event)"
             onmouseleave="window.onDonutLeave(${total})">
          <span class="legend-color-dot" style="background: ${item.color};"></span>
          <span>${item.name} <strong style="color: #fff;">(${pct}%)</strong></span>
        </div>
      `;
    }).join('');
  }
}

window.onDonutHover = function(e, name, amount, pct) {
  const lbl = document.getElementById('donut-center-lbl');
  const val = document.getElementById('donut-center-val');
  if (lbl) lbl.textContent = name.length > 13 ? name.slice(0, 11) + '...' : name;
  if (val) val.textContent = formatCurrency(amount);
  window.showDonutTooltip(e, name, amount, pct);
};

window.onDonutLeave = function(total) {
  const lbl = document.getElementById('donut-center-lbl');
  const val = document.getElementById('donut-center-val');
  if (lbl) lbl.textContent = 'Total Saídas';
  if (val) val.textContent = formatCurrency(total);
  window.hideChartTooltip();
};

function renderDashboardMetasAndBudgets() {
  const metasBox = document.getElementById('dash-metas-list');
  const orcBox = document.getElementById('dash-orcamento-list');

  if (metasBox) {
    const goals = currentFinancialData?.goals || [];
    if (goals.length === 0) {
      metasBox.innerHTML = `
        <div style="font-size: 11px; color: var(--text-muted); padding: 14px 8px; text-align: center; border: 1px dashed var(--border-subtle); border-radius: 4px;">
          Nenhuma meta definida. <a href="#" onclick="window.openMetaModal(); return false;" style="color: var(--color-primary-light); text-decoration: underline;">+ Criar meta</a>
        </div>
      `;
    } else {
      metasBox.innerHTML = goals.slice(0, 3).map(g => {
        const pct = g.targetAmount > 0 ? Math.min(100, Math.round((g.currentAmount / g.targetAmount) * 100)) : 0;
        const faltam = Math.max(0, g.targetAmount - g.currentAmount);
        return `
          <div class="progress-row-item"
               onmouseenter="window.showChartTooltip(event, '${escapeHtml(g.title)}', [
                 { label: 'Posição Atual', val: '${formatCurrency(g.currentAmount)}', color: '#38bdf8', cls: 'positive' },
                 { label: 'Meta Alvo', val: '${formatCurrency(g.targetAmount)}', color: '#94a3b8', cls: 'neutral' },
                 { label: 'Faltam para Meta', val: '${formatCurrency(faltam)}', color: '#fbbf24', cls: 'neutral' }
               ])"
               onmousemove="window.positionChartTooltip(event)"
               onmouseleave="window.hideChartTooltip()">
            <div class="progress-label-row">
              <span>${escapeHtml(g.title)}</span>
              <span class="progress-pct-badge">${pct}%</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  if (orcBox) {
    const budgets = currentFinancialData?.budgets || [];
    if (budgets.length === 0) {
      orcBox.innerHTML = `
        <div style="font-size: 11px; color: var(--text-muted); padding: 14px 8px; text-align: center; border: 1px dashed var(--border-subtle); border-radius: 4px;">
          Nenhum teto configurado. <a href="#" onclick="window.openBudgetModal(); return false;" style="color: var(--color-primary-light); text-decoration: underline;">+ Definir teto</a>
        </div>
      `;
    } else {
      orcBox.innerHTML = budgets.slice(0, 3).map(b => {
        const pct = b.monthlyLimit > 0 ? Math.min(100, Math.round((b.spentAmount / b.monthlyLimit) * 100)) : 0;
        const isWarn = pct >= 80;
        const disp = Math.max(0, b.monthlyLimit - b.spentAmount);
        return `
          <div class="progress-row-item"
               onmouseenter="window.showChartTooltip(event, 'Teto: ${escapeHtml(b.category)}', [
                 { label: 'Gasto Consumido', val: '${formatCurrency(b.spentAmount)}', color: '${isWarn ? '#f87171' : '#38bdf8'}', cls: '${isWarn ? 'negative' : 'positive'}' },
                 { label: 'Teto Mensal', val: '${formatCurrency(b.monthlyLimit)}', color: '#94a3b8', cls: 'neutral' },
                 { label: 'Saldo Disponível', val: '${formatCurrency(disp)}', color: '#34d399', cls: 'positive' }
               ])"
               onmousemove="window.positionChartTooltip(event)"
               onmouseleave="window.hideChartTooltip()">
            <div class="progress-label-row">
              <span>${escapeHtml(b.category)}</span>
              <span class="progress-pct-badge" style="${isWarn ? 'background: rgba(239, 68, 68, 0.2); color: #f87171;' : ''}">${pct}%</span>
            </div>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width: ${pct}%; background: ${isWarn ? 'linear-gradient(90deg, #f59e0b, #ef4444)' : 'var(--color-primary-gradient)'};"></div>
            </div>
          </div>
        `;
      }).join('');
    }
  }
}

function renderMetaTimelineChart() {
  const box = document.getElementById('meta-evolution-svg-box');
  if (!box) return;

  const goals = (currentFinancialData && currentFinancialData.goals) || [];
  if (goals.length === 0) {
    box.innerHTML = `
      <div style="height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); font-size: 11px; gap: 6px; text-align: center; padding: 10px;">
        <span style="font-size: 18px;">🎯</span>
        <span style="font-weight: 500;">Nenhuma meta estratégica cadastrada</span>
        <span style="font-size: 10px; color: var(--text-subtle);">Cadastre suas metas acima para acompanhar o gráfico de evolução patrimonial.</span>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <svg viewBox="0 0 450 160" width="100%" height="100%">
      <!-- Gridlines -->
      <line x1="30" y1="20" x2="430" y2="20" stroke="var(--border-subtle)" stroke-dasharray="2 2" />
      <line x1="30" y1="60" x2="430" y2="60" stroke="var(--border-subtle)" stroke-dasharray="2 2" />
      <line x1="30" y1="100" x2="430" y2="100" stroke="var(--border-subtle)" stroke-dasharray="2 2" />
      <line x1="30" y1="140" x2="430" y2="140" stroke="var(--border-subtle)" />

      <!-- Curve 1: Imobiliário (Cobalt) -->
      <path d="M 50 140 Q 150 70, 230 85 T 330 35 T 410 35" fill="none" stroke="#2563eb" stroke-width="2" />
      <circle cx="50" cy="140" r="3" fill="#2563eb" />
      <circle cx="150" cy="90" r="3" fill="#2563eb" />
      <circle cx="230" cy="85" r="3" fill="#2563eb" />
      <circle cx="330" cy="35" r="3" fill="#2563eb" />
      <circle cx="410" cy="35" r="3" fill="#2563eb" />

      <!-- Curve 2: Veículo (Slate) -->
      <path d="M 50 140 Q 140 50, 230 65 T 330 70 T 410 50" fill="none" stroke="#64748b" stroke-width="2" />
      <circle cx="140" cy="55" r="3" fill="#64748b" />
      <circle cx="230" cy="65" r="3" fill="#64748b" />
      <circle cx="330" cy="70" r="3" fill="#64748b" />
      <circle cx="410" cy="50" r="3" fill="#64748b" />

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
// MODALS MANAGEMENT
// ==========================================================================
function initModals() {
  // New transaction modal trigger
  const btnOpenTx = document.getElementById('btn-open-tx-modal');
  if (btnOpenTx) btnOpenTx.addEventListener('click', openNewTxModal);

  // Type tabs in new tx modal
  let selectedTxType = 'EXPENSE';
  const typePills = document.querySelectorAll('.modal-tab-pill');
  const instCheck = document.getElementById('tx-modal-is-installment');
  const instBox = document.getElementById('tx-installment-details');
  const txValIn = document.getElementById('tx-modal-val');
  const instCountIn = document.getElementById('tx-modal-installments-count');
  const instCalcPreview = document.getElementById('tx-installment-calc-preview');

  function updateInstallmentPreview() {
    if (!instCalcPreview || !txValIn || !instCountIn) return;
    const total = parseFloat(txValIn.value) || 0;
    const count = parseInt(instCountIn.value, 10) || 2;
    const perMonth = count > 0 ? (total / count) : 0;
    instCalcPreview.textContent = `💡 Simulação: ${count}x de ${formatCurrency(perMonth)} (Total: ${formatCurrency(total)})`;
  }

  const methodSel = document.getElementById('tx-modal-method');
  const cardWrap = document.getElementById('tx-modal-card-wrap');
  const accountWrap = document.getElementById('tx-modal-account-wrap');
  const updateBalCheck = document.getElementById('tx-modal-update-balance');
  const isPaidCheck = document.getElementById('tx-modal-is-paid');

  function updateTxModalMethodState() {
    const isCc = (methodSel && methodSel.value === 'CREDIT_CARD') || (instCheck && instCheck.checked);
    if (cardWrap) cardWrap.style.display = isCc ? 'block' : 'none';
    if (accountWrap) accountWrap.style.display = isCc ? 'none' : 'block';
    if (isCc) {
      if (updateBalCheck) updateBalCheck.checked = false;
      if (isPaidCheck) isPaidCheck.checked = false;
    } else {
      if (updateBalCheck) updateBalCheck.checked = true;
      if (isPaidCheck) isPaidCheck.checked = true;
    }
  }

  if (methodSel) {
    methodSel.addEventListener('change', updateTxModalMethodState);
  }

  if (instCheck && instBox) {
    instCheck.addEventListener('change', () => {
      instBox.style.display = instCheck.checked ? 'block' : 'none';
      if (instCheck.checked) {
        if (methodSel) methodSel.value = 'CREDIT_CARD';
      }
      updateTxModalMethodState();
      if (instCheck.checked) {
        updateInstallmentPreview();
      }
    });
  }

  if (txValIn) txValIn.addEventListener('input', updateInstallmentPreview);
  if (instCountIn) instCountIn.addEventListener('input', updateInstallmentPreview);

  typePills.forEach(pill => {
    pill.addEventListener('click', (e) => {
      e.preventDefault();
      typePills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      selectedTxType = pill.getAttribute('data-txtype');

      const descInput = document.getElementById('tx-modal-desc');
      const valLabel = document.querySelector('#form-novo-lancamento div:first-child label');
      const instRow = document.getElementById('tx-modal-is-installment')?.closest('.form-checkbox-item');

      if (selectedTxType === 'BALANCE') {
        if (descInput) descInput.value = 'Ajuste Manual de Saldo';
        if (valLabel) valLabel.textContent = 'Novo Saldo em Conta (R$)';
        if (instRow) instRow.style.display = 'none';
        if (instBox) instBox.style.display = 'none';
      } else {
        if (descInput && descInput.value === 'Ajuste Manual de Saldo') descInput.value = '';
        if (valLabel) valLabel.textContent = 'Valor (R$)';
        if (instRow) instRow.style.display = 'inline-flex';
        if (instCheck && instCheck.checked && instBox) instBox.style.display = 'block';
      }
    });
  });

  // Submit new transaction
  const formTx = document.getElementById('form-novo-lancamento');
  if (formTx) {
    formTx.addEventListener('submit', async (e) => {
      e.preventDefault();
      const val = parseFloat(document.getElementById('tx-modal-val').value) || 0;
      if (val <= 0) {
        window.showToast('Por favor, informe um valor maior que zero.', '⚠️');
        document.getElementById('tx-modal-val')?.focus();
        return;
      }

      const desc = document.getElementById('tx-modal-desc').value.trim() || 'Lançamento';
      const category = document.getElementById('tx-modal-category').value;
      const method = document.getElementById('tx-modal-method').value;
      const resp = document.getElementById('tx-modal-responsible')?.value || 'Marcos';
      const dateVal = document.getElementById('tx-modal-date')?.value || new Date().toISOString().slice(0, 10);
      const dueVal = document.getElementById('tx-modal-due')?.value || null;
      let accountVal = document.getElementById('tx-modal-account')?.value || resp;
      const isPaid = document.getElementById('tx-modal-is-paid') ? document.getElementById('tx-modal-is-paid').checked : true;
      const isInstallment = document.getElementById('tx-modal-is-installment') ? document.getElementById('tx-modal-is-installment').checked : false;
      const installmentsCount = parseInt(document.getElementById('tx-modal-installments-count')?.value, 10) || 1;
      const cardId = (method === 'CREDIT_CARD' || isInstallment) ? (document.getElementById('tx-modal-card-select')?.value || null) : null;
      const updateBal = document.getElementById('tx-modal-update-balance') ? document.getElementById('tx-modal-update-balance').checked : (method !== 'CREDIT_CARD');

      if ((method === 'CREDIT_CARD' || isInstallment) && !cardId) {
        window.showToast('Por favor, selecione qual cartão de crédito foi utilizado.', '⚠️');
        return;
      }

      if (cardId && currentFinancialData?.cards) {
        const cObj = currentFinancialData.cards.find(c => c.id === cardId);
        if (cObj) accountVal = cObj.name;
      }

      try {
        const payload = {
          description: desc,
          amount: val,
          type: selectedTxType,
          category: category,
          paymentMethod: method,
          responsible: resp,
          date: dateVal,
          dueDate: dueVal,
          account: accountVal,
          isPaid: isPaid,
          isInstallment: isInstallment,
          installmentsCount: installmentsCount,
          cardId: cardId,
          updateBalance: updateBal
        };

        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).then(r => r.json());

        if (res.success) {
          window.showToast(selectedTxType === 'BALANCE' ? 'Saldo ajustado com sucesso!' : 'Lançamento salvo com sucesso!', '✅');
          closeModal('modal-novo-lancamento');
          formTx.reset();
          if (instBox) instBox.style.display = 'none';
          await refreshAllData();
        } else {
          window.showToast(res.error || 'Erro ao salvar lançamento', '❌');
        }
      } catch (err) {
        console.error(err);
        window.showToast('Erro ao comunicar com o servidor', '❌');
      }
    });
  }

  // Form: Novo Orçamento
  const formBudget = document.getElementById('form-novo-orcamento');
  if (formBudget) {
    formBudget.addEventListener('submit', async (e) => {
      e.preventDefault();
      const category = document.getElementById('orc-target').value;
      const limit = parseFloat(document.getElementById('orc-limit').value);
      try {
        const res = await fetch('/api/budgets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ category, monthlyLimit: limit })
        }).then(r => r.json());
        if (res.success) {
          window.showToast('Orçamento salvo no Supabase!', '🎯');
          closeModal('modal-novo-orcamento');
          formBudget.reset();
          await refreshAllData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Form: Nova Meta
  const formMeta = document.getElementById('form-nova-meta');
  if (formMeta) {
    formMeta.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('meta-name').value;
      const targetAmount = parseFloat(document.getElementById('meta-target').value);
      const currentAmount = parseFloat(document.getElementById('meta-current').value);
      const deadlineDate = document.getElementById('meta-deadline').value;
      try {
        const res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, targetAmount, currentAmount, deadlineDate })
        }).then(r => r.json());
        if (res.success) {
          window.showToast('Meta estratégica gravada no Supabase!', '🚀');
          closeModal('modal-nova-meta');
          formMeta.reset();
          await refreshAllData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Form: Configurações de Saldos
  const formBalances = document.getElementById('form-settings-balances');
  if (formBalances) {
    formBalances.addEventListener('submit', async (e) => {
      e.preventDefault();
      const balance = parseFloat(document.getElementById('settings-balance').value);
      const reserve = parseFloat(document.getElementById('settings-reserve').value);
      const invest = parseFloat(document.getElementById('settings-investments').value);
      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accountBalance: balance,
            emergencyReserve: reserve,
            investmentsBalance: invest
          })
        }).then(r => r.json());
        if (res.success) {
          window.showToast('Saldos e reservas atualizados no Supabase!', '💾');
          await refreshAllData();
        }
      } catch (err) {
        console.error(err);
      }
    });
  }

  // Toggles de Alertas
  ['toggle-alert-due', 'toggle-alert-budget', 'toggle-alert-weekly'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', async () => {
        const payload = {};
        if (id === 'toggle-alert-due') payload.alertDueDates = el.checked;
        if (id === 'toggle-alert-budget') payload.alertBudgetLimit = el.checked;
        if (id === 'toggle-alert-weekly') payload.alertWeeklyReport = el.checked;
        try {
          await fetch('/api/settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          window.showToast('Preferência gravada', '✓');
        } catch (e) { console.error(e); }
      });
    }
  });

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

  // Card filter select
  const cardSel = document.getElementById('tx-filter-card');
  if (cardSel) {
    cardSel.addEventListener('change', () => {
      currentCardFilter = cardSel.value;
      renderFullTransactionsTable();
    });
  }

  // Category filter select
  const catSel = document.getElementById('tx-filter-category');
  if (catSel) {
    catSel.addEventListener('change', () => {
      currentCategoryFilter = catSel.value;
      renderFullTransactionsTable();
    });
  }

  // Period preset select
  const periodSel = document.getElementById('tx-filter-period-preset');
  if (periodSel) {
    periodSel.addEventListener('change', () => {
      applyPeriodPreset(periodSel.value);
      renderFullTransactionsTable();
    });
  }

  // Date range inputs (start / end)
  const dateStart = document.getElementById('tx-filter-date-start');
  if (dateStart) {
    dateStart.addEventListener('input', () => {
      currentStartDate = dateStart.value;
      renderFullTransactionsTable();
    });
  }
  const dateEnd = document.getElementById('tx-filter-date-end');
  if (dateEnd) {
    dateEnd.addEventListener('input', () => {
      currentEndDate = dateEnd.value;
      renderFullTransactionsTable();
    });
  }
}

window.clearAllTxFilters = function() {
  currentFilter = 'todos';
  currentCardFilter = 'all';
  currentCategoryFilter = 'all';
  currentPeriodPreset = 'all';
  currentStartDate = '';
  currentEndDate = '';
  currentResponsibleFilters = [];

  const filterPills = document.querySelectorAll('#tx-filter-pills-group .filter-pill');
  filterPills.forEach(p => {
    if (p.getAttribute('data-filter') === 'todos') p.classList.add('active');
    else p.classList.remove('active');
  });

  const cardSel = document.getElementById('tx-filter-card');
  if (cardSel) cardSel.value = 'all';

  const catSel = document.getElementById('tx-filter-category');
  if (catSel) catSel.value = 'all';

  const periodSel = document.getElementById('tx-filter-period-preset');
  if (periodSel) periodSel.value = 'all';

  const customDates = document.getElementById('tx-filter-custom-dates');
  if (customDates) customDates.style.display = 'none';

  const dateStart = document.getElementById('tx-filter-date-start');
  if (dateStart) dateStart.value = '';

  const dateEnd = document.getElementById('tx-filter-date-end');
  if (dateEnd) dateEnd.value = '';

  const searchIn = document.getElementById('tx-search-input');
  if (searchIn) searchIn.value = '';

  populateResponsibleDropdowns();
  updateResponsibleDashboardMetrics();
  updateResponsibleFilterBanners();
  renderFullTransactionsTable();
  window.showToast('Filtros redefinidos para o padrão', '🧹');
};

window.openNewTxModal = function() {
  const m = document.getElementById('modal-novo-lancamento');
  if (!m) return;

  m.classList.add('open');

  // Populate credit cards dropdown
  const cardSel = document.getElementById('tx-modal-card-select');
  if (cardSel && currentFinancialData?.cards) {
    cardSel.innerHTML = '<option value="">Selecione o cartão...</option>' + 
      currentFinancialData.cards.map(c => `<option value="${c.id}">${c.name} (Final ${c.last4 || '****'})</option>`).join('');
  }

  // Set default date
  const dateIn = document.getElementById('tx-modal-date');
  if (dateIn && !dateIn.value) {
    const todayStr = new Date().toISOString().slice(0, 10);
    dateIn.value = todayStr.startsWith(currentCompetency) ? todayStr : `${currentCompetency}-01`;
  }

  // Reset inputs
  const valIn = document.getElementById('tx-modal-val');
  if (valIn) {
    valIn.value = '';
    setTimeout(() => {
      valIn.focus();
    }, 80);
  }

  const descIn = document.getElementById('tx-modal-desc');
  if (descIn) descIn.value = '';

  const catIn = document.getElementById('tx-modal-category');
  if (catIn) catIn.value = 'Operacional';

  const methodSel = document.getElementById('tx-modal-method');
  if (methodSel) methodSel.value = 'DEBIT';

  const cardWrap = document.getElementById('tx-modal-card-wrap');
  if (cardWrap) cardWrap.style.display = 'none';

  const accountWrap = document.getElementById('tx-modal-account-wrap');
  if (accountWrap) accountWrap.style.display = 'block';

  const instCheck = document.getElementById('tx-modal-is-installment');
  if (instCheck) instCheck.checked = false;

  const instBox = document.getElementById('tx-installment-details');
  if (instBox) instBox.style.display = 'none';

  const paidCheck = document.getElementById('tx-modal-is-paid');
  if (paidCheck) paidCheck.checked = true;

  const updateBal = document.getElementById('tx-modal-update-balance');
  if (updateBal) updateBal.checked = true;

  // Reset tabs to EXPENSE
  const expTab = document.querySelector('.modal-tab-pill[data-txtype="EXPENSE"]');
  if (expTab) expTab.click();
};

// Modal: Ajustar Saldo em Conta
window.openBalanceModal = function() {
  const m = document.getElementById('modal-ajustar-saldo');
  if (m) {
    m.classList.add('open');
    const input = document.getElementById('manual-balance-val');
    if (input) {
      input.value = (currentFinancialData?.accountBalance != null ? currentFinancialData.accountBalance : 0);
      input.focus();
      input.select();
    }
  }
};

const formAdjustBalance = document.getElementById('form-ajustar-saldo');
if (formAdjustBalance) {
  formAdjustBalance.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newBal = parseFloat(document.getElementById('manual-balance-val').value) || 0;
    try {
      const res = await fetch('/api/financial/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: newBal })
      }).then(r => r.json());

      if (res.success) {
        window.showToast(`Saldo em Conta definido para ${formatCurrency(newBal)}!`, '💰');
        closeModal('modal-ajustar-saldo');
        await refreshAllData();
      }
    } catch (err) {
      console.error(err);
      window.showToast('Erro ao atualizar saldo', '❌');
    }
  });
}

// Modal: Editar Lançamento
window.openEditTxModal = function(id) {
  const tx = (currentTransactions || []).find(t => t.id === id);
  if (!tx) return;

  const m = document.getElementById('modal-editar-lancamento');
  if (!m) return;

  document.getElementById('edit-tx-id').value = tx.id;
  document.getElementById('edit-tx-val').value = tx.amount;
  document.getElementById('edit-tx-desc').value = tx.description || '';
  document.getElementById('edit-tx-type').value = tx.type || 'EXPENSE';
  document.getElementById('edit-tx-category').value = tx.category || 'Geral';
  document.getElementById('edit-tx-responsible').value = getTxResponsible(tx);
  document.getElementById('edit-tx-method').value = tx.paymentMethod || 'PIX';
  document.getElementById('edit-tx-is-paid').value = (tx.isPaid !== false).toString();

  const d = tx.date ? tx.date.slice(0, 10) : '';
  document.getElementById('edit-tx-date').value = d;

  const editCardSel = document.getElementById('edit-tx-card-select');
  const editCardWrap = document.getElementById('edit-tx-card-wrap');
  if (editCardSel && currentFinancialData && currentFinancialData.cards) {
    editCardSel.innerHTML = '<option value="">Sem cartão vinculado...</option>' +
      currentFinancialData.cards.map(c => `<option value="${c.id}">${c.name} (Final ${c.last4 || '****'})</option>`).join('');
    editCardSel.value = tx.cardId || tx.card_id || '';
  }

  const isCard = (tx.paymentMethod === 'CREDIT_CARD' || !!tx.cardId || !!tx.card_id);
  if (editCardWrap) {
    editCardWrap.style.display = isCard ? 'block' : 'none';
  }

  m.classList.add('open');
};

const editMethodSel = document.getElementById('edit-tx-method');
if (editMethodSel) {
  editMethodSel.addEventListener('change', () => {
    const editCardWrap = document.getElementById('edit-tx-card-wrap');
    if (editCardWrap) {
      editCardWrap.style.display = editMethodSel.value === 'CREDIT_CARD' ? 'block' : 'none';
    }
  });
}

const formEditTx = document.getElementById('form-editar-lancamento');
if (formEditTx) {
  formEditTx.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-tx-id').value;
    const amount = parseFloat(document.getElementById('edit-tx-val').value);
    const description = document.getElementById('edit-tx-desc').value;
    const type = document.getElementById('edit-tx-type').value;
    const category = document.getElementById('edit-tx-category').value;
    const responsible = document.getElementById('edit-tx-responsible').value;
    const paymentMethod = document.getElementById('edit-tx-method').value;
    const isPaid = document.getElementById('edit-tx-is-paid').value === 'true';
    const date = document.getElementById('edit-tx-date').value;
    const cardId = paymentMethod === 'CREDIT_CARD' ? (document.getElementById('edit-tx-card-select')?.value || null) : null;

    try {
      const payload = {
        amount,
        description,
        type,
        category,
        responsible,
        paymentMethod,
        cardId,
        isPaid,
        date
      };
      if (cardId && currentFinancialData?.cards) {
        const cObj = currentFinancialData.cards.find(c => c.id === cardId);
        if (cObj) payload.account = cObj.name;
      }

      const res = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(r => r.json());

      if (res.success) {
        window.showToast('Lançamento atualizado com sucesso!', '✅');
        closeModal('modal-editar-lancamento');
        await refreshAllData();
      }
    } catch (err) {
      console.error(err);
      window.showToast('Erro ao atualizar lançamento', '❌');
    }
  });
}

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
// CARDS MODALS CONTROLS (NOVO & EDITAR)
// ==========================================================================
window.openNewCardModal = function() {
  const m = document.getElementById('modal-novo-cartao');
  if (m) {
    document.getElementById('form-novo-cartao')?.reset();
    m.classList.add('open');
  }
};

window.openEditCardModal = function(cardId) {
  const cards = (currentFinancialData && currentFinancialData.cards) || [];
  const card = cards.find(c => c.id === cardId);
  if (!card) return;

  const m = document.getElementById('modal-editar-cartao');
  if (!m) return;

  document.getElementById('edit-card-id').value = card.id;
  document.getElementById('edit-card-name').value = card.name || '';
  document.getElementById('edit-card-brand').value = card.brand || 'Mastercard';
  document.getElementById('edit-card-last4').value = card.last4 || '';
  document.getElementById('edit-card-limit').value = card.limitTotal || 0;
  document.getElementById('edit-card-closing').value = card.closingDay || 20;
  document.getElementById('edit-card-due').value = card.dueDay || 28;
  document.getElementById('edit-card-color').value = card.color || 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)';

  m.classList.add('open');
};

window.deleteCardFromModal = async function() {
  const id = document.getElementById('edit-card-id').value;
  if (!id) return;
  if (!confirm('Deseja realmente remover este cartão? Os lançamentos vinculados permanecerão no histórico.')) return;

  try {
    const res = await fetch(`/api/cards/${id}`, { method: 'DELETE' }).then(r => r.json());
    if (res.success) {
      window.showToast('Cartão removido com sucesso!', '🗑️');
      closeModal('modal-editar-cartao');
      await refreshAllData();
    } else {
      window.showToast(res.error || 'Erro ao remover cartão', '⚠️');
    }
  } catch (err) {
    console.error(err);
    window.showToast('Erro de conexão ao remover cartão', '❌');
  }
};

const formNovoCartao = document.getElementById('form-novo-cartao');
if (formNovoCartao) {
  formNovoCartao.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-card-name').value.trim();
    const brand = document.getElementById('new-card-brand').value;
    const last4 = document.getElementById('new-card-last4').value.trim();
    const limitTotal = parseFloat(document.getElementById('new-card-limit').value) || 0;
    const closingDay = parseInt(document.getElementById('new-card-closing').value, 10) || 1;
    const dueDay = parseInt(document.getElementById('new-card-due').value, 10) || 1;
    const color = document.getElementById('new-card-color').value;

    try {
      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, brand, last4, limitTotal, closingDay, dueDay, color })
      }).then(r => r.json());

      if (res.success) {
        window.showToast('Cartão adicionado com sucesso!', '💳');
        closeModal('modal-novo-cartao');
        await refreshAllData();
      } else {
        window.showToast(res.error || 'Erro ao adicionar cartão', '⚠️');
      }
    } catch (err) {
      console.error(err);
      window.showToast('Erro ao cadastrar cartão', '❌');
    }
  });
}

const formEditarCartao = document.getElementById('form-editar-cartao');
if (formEditarCartao) {
  formEditarCartao.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-card-id').value;
    const name = document.getElementById('edit-card-name').value.trim();
    const brand = document.getElementById('edit-card-brand').value;
    const last4 = document.getElementById('edit-card-last4').value.trim();
    const limitTotal = parseFloat(document.getElementById('edit-card-limit').value) || 0;
    const closingDay = parseInt(document.getElementById('edit-card-closing').value, 10) || 1;
    const dueDay = parseInt(document.getElementById('edit-card-due').value, 10) || 1;
    const color = document.getElementById('edit-card-color').value;

    try {
      const res = await fetch(`/api/cards/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, brand, last4, limitTotal, closingDay, dueDay, color })
      }).then(r => r.json());

      if (res.success) {
        window.showToast('Cartão atualizado com sucesso!', '✅');
        closeModal('modal-editar-cartao');
        await refreshAllData();
      } else {
        window.showToast(res.error || 'Erro ao atualizar cartão', '⚠️');
      }
    } catch (err) {
      console.error(err);
      window.showToast('Erro ao atualizar cartão', '❌');
    }
  });
}

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

const renderedMessageIds = new Set();

function appendChatMessage(msg) {
  const box = document.getElementById('chat-messages-area');
  if (!box || !msg || !msg.text) return;

  const msgKey = msg.id || (msg.sender + ':' + (msg.text || '').trim());
  if (renderedMessageIds.has(msgKey)) return;
  renderedMessageIds.add(msgKey);
  if (renderedMessageIds.size > 300) {
    const first = renderedMessageIds.values().next().value;
    renderedMessageIds.delete(first);
  }

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

// ==========================================================================
// AUTHENTICATION SYSTEM (LOGIN, LOGOUT, CHANGE PASSWORD)
// ==========================================================================

function getStoredAuthSession() {
  try {
    const rawLocal = localStorage.getItem('lancei_auth_session');
    if (rawLocal) return JSON.parse(rawLocal);
    const rawSession = sessionStorage.getItem('lancei_auth_session');
    if (rawSession) return JSON.parse(rawSession);
  } catch (e) {
    console.error('Error reading auth session:', e);
  }
  return null;
}

function updateAuthUserProfile(user) {
  if (!user) return;
  const displayName = user.name || 'Marques';
  const initial = displayName.charAt(0).toUpperCase();

  // Topbar
  const nameEl = document.getElementById('user-display-name');
  const avatarEl = document.getElementById('user-avatar-circle');
  if (nameEl) nameEl.textContent = displayName;
  if (avatarEl) avatarEl.textContent = initial;

  // Preferences Card Header
  const profName = document.getElementById('profile-display-name');
  const profAvatar = document.getElementById('profile-avatar-large');
  if (profName) profName.textContent = displayName;
  if (profAvatar) profAvatar.textContent = initial;

  // Preferences Form Fields
  const inputName = document.getElementById('user-info-name');
  const inputEmail = document.getElementById('user-info-email');
  const inputUser = document.getElementById('user-info-username');
  const inputPhone = document.getElementById('user-info-phone');
  const inputRole = document.getElementById('user-info-role');

  if (inputName && user.name && document.activeElement !== inputName) inputName.value = user.name;
  if (inputEmail && user.email && document.activeElement !== inputEmail) inputEmail.value = user.email;
  if (inputUser && user.username && document.activeElement !== inputUser) inputUser.value = user.username;
  if (inputPhone && user.phone !== undefined && document.activeElement !== inputPhone) inputPhone.value = user.phone;
  if (inputRole && user.role && document.activeElement !== inputRole) inputRole.value = user.role;
}

async function loadUserProfile() {
  try {
    const res = await fetch('/api/user/profile');
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.profile) {
        updateAuthUserProfile(data.profile);
      }
    }
  } catch (err) {
    console.error('Failed to load user profile:', err);
  }
}

function initAuthSystem() {
  const overlay = document.getElementById('login-screen-overlay');
  const formLogin = document.getElementById('form-login');
  const errorAlert = document.getElementById('login-error-alert');
  const btnTogglePass = document.getElementById('btn-toggle-login-pass');
  const passInput = document.getElementById('login-password');
  const usernameInput = document.getElementById('login-username');
  const rememberCheckbox = document.getElementById('login-remember');
  const btnSubmit = document.getElementById('btn-submit-login');
  const btnLogout = document.getElementById('btn-sidebar-logout');
  const formChangePass = document.getElementById('form-settings-password');

  // Check existing session
  const currentSession = getStoredAuthSession();
  if (currentSession && overlay) {
    overlay.classList.add('hidden');
    overlay.style.display = 'none';
    updateAuthUserProfile(currentSession);
  } else if (overlay) {
    overlay.classList.remove('hidden');
    overlay.style.display = 'flex';
    if (usernameInput && !usernameInput.value) {
      usernameInput.value = 'admin';
    }
    if (passInput && !passInput.value) {
      passInput.value = '123456';
    }
  }

  // Clickable badge for instant auto-fill and submit
  const btnAutofill = document.getElementById('btn-autofill-login');
  if (btnAutofill) {
    btnAutofill.addEventListener('click', () => {
      if (usernameInput) usernameInput.value = 'admin';
      if (passInput) passInput.value = '123456';
      if (formLogin) {
        if (typeof formLogin.requestSubmit === 'function') {
          formLogin.requestSubmit();
        } else {
          formLogin.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
      }
    });
  }

  // Toggle Password Visibility
  if (btnTogglePass && passInput) {
    btnTogglePass.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = passInput.type === 'password';
      passInput.type = isPassword ? 'text' : 'password';
      btnTogglePass.innerHTML = isPassword
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    });
  }

  // Handle Login Form Submit
  if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = usernameInput ? usernameInput.value.trim() : '';
      const password = passInput ? passInput.value : '';

      if (!username || !password) {
        if (errorAlert) {
          errorAlert.textContent = 'Por favor, informe o usuário e a senha.';
          errorAlert.style.display = 'block';
        }
        return;
      }

      // Loading state
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<span>Autenticando...</span>`;
      }
      if (errorAlert) {
        errorAlert.style.display = 'none';
      }

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          const userSession = data.user || { username, name: 'Marcos' };
          
          if (rememberCheckbox && rememberCheckbox.checked) {
            localStorage.setItem('lancei_auth_session', JSON.stringify(userSession));
          } else {
            sessionStorage.setItem('lancei_auth_session', JSON.stringify(userSession));
          }

          updateAuthUserProfile(userSession);

          if (overlay) {
            overlay.classList.add('hidden');
            setTimeout(() => {
              overlay.style.display = 'none';
            }, 300);
          }

          if (passInput) passInput.value = '';

          // Refresh data on fresh login
          refreshAllData();
          checkWhatsAppStatus();

          window.showToast(`Bem-vindo, ${userSession.name || 'Marcos'}!`, '✓');
        } else {
          if (errorAlert) {
            errorAlert.textContent = data.message || data.error || 'Credenciais inválidas. Verifique seu login e senha.';
            errorAlert.style.display = 'block';
            errorAlert.style.animation = 'none';
            errorAlert.offsetHeight; // force reflow
            errorAlert.style.animation = 'shake 0.4s ease';
          }
        }
      } catch (err) {
        console.error('Login error:', err);
        if (errorAlert) {
          errorAlert.textContent = 'Erro ao conectar ao servidor. Verifique a conexão.';
          errorAlert.style.display = 'block';
        }
      } finally {
        if (btnSubmit) {
          btnSubmit.disabled = false;
          btnSubmit.innerHTML = `<span>Entrar no Sistema</span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`;
        }
      }
    });
  }

  // Handle Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', (e) => {
      e.preventDefault();
      localStorage.removeItem('lancei_auth_session');
      sessionStorage.removeItem('lancei_auth_session');
      if (passInput) passInput.value = '';
      if (errorAlert) errorAlert.style.display = 'none';
      if (overlay) {
        overlay.classList.remove('hidden');
        if (usernameInput) {
          setTimeout(() => usernameInput.focus(), 150);
        }
      }
      window.showToast('Sessão encerrada com sucesso.', '🔒');
    });
  }

  // Handle Preferences Change Password
  if (formChangePass) {
    formChangePass.addEventListener('submit', async (e) => {
      e.preventDefault();
      const oldPass = document.getElementById('settings-old-pass')?.value;
      const newPass = document.getElementById('settings-new-pass')?.value;
      const confirmPass = document.getElementById('settings-confirm-pass')?.value;
      const btnSave = document.getElementById('btn-save-new-password');

      if (!oldPass || !newPass || !confirmPass) {
        window.showToast('Preencha todos os campos de senha.', '⚠️');
        return;
      }

      if (newPass !== confirmPass) {
        window.showToast('A nova senha e a confirmação não coincidem.', '⚠️');
        return;
      }

      if (newPass.length < 4) {
        window.showToast('A nova senha deve possuir pelo menos 4 caracteres.', '⚠️');
        return;
      }

      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Atualizando...';
      }

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ currentPassword: oldPass, newPassword: newPass })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          window.showToast('Senha atualizada com sucesso!', '✓');
          formChangePass.reset();
        } else {
          window.showToast(data.message || data.error || 'Erro ao atualizar senha.', '✕');
        }
      } catch (err) {
        console.error('Change password error:', err);
        window.showToast('Erro de comunicação com o servidor.', '✕');
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = 'Redefinir Senha';
        }
      }
    });
  }

  // Handle Preferences Save User Profile
  const formUserProfile = document.getElementById('form-user-profile');
  if (formUserProfile) {
    formUserProfile.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('user-info-name')?.value;
      const email = document.getElementById('user-info-email')?.value;
      const username = document.getElementById('user-info-username')?.value;
      const phone = document.getElementById('user-info-phone')?.value;
      const role = document.getElementById('user-info-role')?.value;
      const btnSave = document.getElementById('btn-save-user-profile');

      if (!name || !email || !username) {
        window.showToast('Preencha os campos obrigatórios (Nome, E-mail e Usuário).', '⚠️');
        return;
      }

      if (btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Salvando...';
      }

      try {
        const res = await fetch('/api/user/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, username, phone, role })
        });
        const data = await res.json();

        if (res.ok && data.success) {
          updateAuthUserProfile(data.profile);

          // Sync session storage
          const session = getStoredAuthSession() || {};
          const newSession = { ...session, ...data.profile };
          if (localStorage.getItem('lancei_auth_session')) {
            localStorage.setItem('lancei_auth_session', JSON.stringify(newSession));
          } else {
            sessionStorage.setItem('lancei_auth_session', JSON.stringify(newSession));
          }

          window.showToast('Informações do usuário salvas com sucesso!', '✓');
        } else {
          window.showToast(data.error || 'Erro ao salvar informações.', '✕');
        }
      } catch (err) {
        console.error('Error saving profile:', err);
        window.showToast('Erro de comunicação com o servidor.', '✕');
      } finally {
        if (btnSave) {
          btnSave.disabled = false;
          btnSave.textContent = 'Salvar Informações do Usuário';
        }
      }
    });
  }
}

