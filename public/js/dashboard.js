// ==========================================================================
// MEU ASSESSOR - DASHBOARD, CARDS, PROJECTION & WHATSAPP ENGINE
// ==========================================================================

let currentFinancialData = null;
let currentProjectionData = null;
let currentTransactions = [];
let currentChatMessages = [];
let currentWhatsAppStatus = { status: 'DISCONNECTED' };

// Helper: Formatter
function formatCurrency(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// Toast helper
window.showToast = function(msg, icon = '⚡') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast toast-trigger';
  t.innerHTML = `<span>${icon}</span> <span>${msg}</span>`;
  container.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    setTimeout(() => t.remove(), 300);
  }, 3500);
};

// Document Init
document.addEventListener('DOMContentLoaded', async () => {
  initTabsNavigation();
  initChatInput();
  initModalControls();
  initWhatsAppQRControls();
  initRealtimeSSE();

  // Initial data loading
  await refreshAllData();
  await checkWhatsAppStatus();
});

// SSE Connection
function initRealtimeSSE() {
  if (window.EventSource) {
    const sse = new EventSource('/api/events');
    sse.addEventListener('financial-updated', (e) => {
      try {
        const data = JSON.parse(e.data);
        currentFinancialData = data;
        renderAllViews();
        window.showToast('Dados financeiros atualizados em tempo real!', '🔄');
      } catch (err) {
        console.error(err);
      }
    });

    sse.addEventListener('chat-message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.user) appendChatMessage(data.user);
        if (data.assistant) appendChatMessage(data.assistant);
      } catch (err) {
        console.error(err);
      }
    });

    sse.addEventListener('whatsapp-status-changed', (e) => {
      try {
        const statusObj = JSON.parse(e.data);
        currentWhatsAppStatus = statusObj;
        renderWhatsAppStatusUI();
      } catch (err) {
        console.error(err);
      }
    });
  }
}

// Fetch all data from server
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
    console.error('Error fetching financial data:', err);
  }
}

// Render everything
function renderAllViews() {
  if (!currentFinancialData) return;

  renderOverviewMetrics();
  renderCardsAndProjections();
  renderTransactionsTable();
  renderWebhookInfo();
}

// TABS NAVIGATION
function initTabsNavigation() {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.add('active');

      if (targetId === 'tab-chat') {
        scrollChatToBottom();
      }
    });
  });
}

// ==========================================================================
// 1. OVERVIEW VIEW
// ==========================================================================
function renderOverviewMetrics() {
  const fin = currentFinancialData;
  if (!fin) return;

  document.getElementById('metric-balance').textContent = formatCurrency(fin.accountBalance);
  document.getElementById('metric-income').textContent = '+' + formatCurrency(fin.currentMonthIncome);
  document.getElementById('metric-expense').textContent = '-' + formatCurrency(fin.currentMonthExpenses);
  document.getElementById('metric-invoices').textContent = formatCurrency(fin.totalInvoicesCurrent);

  const projCard = document.getElementById('overview-proj-finish');
  if (projCard && fin.projection) {
    projCard.textContent = fin.projection.finishMonthFormatted;
    document.getElementById('overview-proj-months').textContent = `${fin.projection.monthsUntilFree} meses restantes`;
  }

  const recentListEl = document.getElementById('overview-recent-transactions');
  if (recentListEl) {
    recentListEl.innerHTML = '';
    const recents = currentTransactions.slice(0, 5);
    if (recents.length === 0) {
      recentListEl.innerHTML = '<p style="color: var(--text-subtle); padding: 10px;">Nenhuma transação recente.</p>';
      return;
    }

    recents.forEach(tx => {
      const isIncome = tx.type === 'INCOME';
      const item = document.createElement('div');
      item.className = 'recent-tx-row';
      item.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid var(--border-subtle);';
      item.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 18px;">${isIncome ? '💰' : (tx.paymentMethod === 'CREDIT_CARD' ? '💳' : '🍔')}</span>
          <div>
            <div style="font-weight: 700; color: #fff; font-size: 13px;">${tx.description}</div>
            <div style="font-size: 11px; color: var(--text-subtle);">${tx.category} • ${tx.source === 'WHATSAPP' ? '🟢 WhatsApp' : '💻 Web'}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 800; font-family: var(--font-mono); font-size: 13px; color: ${isIncome ? '#34d399' : '#f87171'};">
            ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
          </div>
          <div style="font-size: 10px; color: var(--text-subtle);">${formatDate(tx.date)}</div>
        </div>
      `;
      recentListEl.appendChild(item);
    });
  }
}

// ==========================================================================
// 2. CARDS & PROJECTION VIEW
// ==========================================================================
function renderCardsAndProjections() {
  const fin = currentFinancialData;
  const projData = currentProjectionData;
  if (!fin || !fin.cards) return;

  const heroEl = document.getElementById('projection-hero-box');
  if (heroEl && fin.projection) {
    heroEl.innerHTML = `
      <div class="projection-banner-left">
        <span class="projection-pill">📊 Inteligência Preditiva de Fatura</span>
        <h2 class="projection-banner-title">
          Previsão de Quitação: <span>${fin.projection.finishMonthFormatted}</span>
        </h2>
        <p class="projection-banner-desc">
          Com base nas compras parceladas ativas, sua fatura diminuirá progressivamente mês a mês até zerar em <strong>${fin.projection.finishMonthFormatted}</strong>. A partir daí, <strong>${formatCurrency(fin.totalLimitUsed)}</strong> de limite comprometido estará 100% livre.
        </p>
      </div>
      <div class="projection-banner-stats">
        <div class="projection-stat-badge">
          <span>Tempo Restante</span>
          <span style="color: #a855f7;">${fin.projection.monthsUntilFree} Meses</span>
        </div>
        <div class="projection-stat-badge">
          <span>Fatura Atual</span>
          <span style="color: #fbbf24;">${formatCurrency(fin.totalInvoicesCurrent)}</span>
        </div>
        <div class="projection-stat-badge">
          <span>Limite Liberado</span>
          <span style="color: #34d399;">${formatCurrency(fin.totalLimitAvailable)}</span>
        </div>
      </div>
    `;
  }

  const cardsGridEl = document.getElementById('credit-cards-grid');
  if (cardsGridEl) {
    cardsGridEl.innerHTML = '';
    fin.cards.forEach(card => {
      const cardCard = document.createElement('div');
      cardCard.style.cssText = 'display: flex; flex-direction: column; gap: 14px;';

      const progressColorClass = card.usedPercentage > 80 ? 'danger' : (card.usedPercentage > 50 ? 'warning' : 'safe');

      cardCard.innerHTML = `
        <div class="bank-card" style="background: ${card.color || 'linear-gradient(135deg, #1e293b, #0f172a)'};">
          <div class="card-top-row">
            <span class="card-name-title">${card.name}</span>
            <span class="card-brand-logo">${card.brand}</span>
          </div>
          <div class="card-chip-contactless">
            <div class="card-chip"></div>
            <span class="card-contactless">))))</span>
          </div>
          <div class="card-number-dots">•••• •••• •••• ${card.last4}</div>
          <div class="card-bottom-row">
            <div class="card-info-group">
              <label>Fatura Atual Aberta</label>
              <span>${formatCurrency(card.currentInvoice)}</span>
            </div>
            <div class="card-info-group" style="text-align: right;">
              <label>Limite Total</label>
              <span>${formatCurrency(card.limitTotal)}</span>
            </div>
          </div>
        </div>

        <div class="card-details-box">
          <div class="limit-bar-wrapper">
            <div class="limit-labels-row">
              <span style="color: var(--text-muted); font-weight: 600;">Limite Utilizado (${card.usedPercentage}%)</span>
              <span style="font-weight: 800; font-family: var(--font-mono); color: #fff;">
                ${formatCurrency(card.limitUsed)} / ${formatCurrency(card.limitTotal)}
              </span>
            </div>
            <div class="limit-progress-track">
              <div class="limit-progress-fill ${progressColorClass}" style="width: ${card.usedPercentage}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-subtle);">
              <span>Disponível: <strong style="color: #34d399;">${formatCurrency(card.limitAvailable)}</strong></span>
              <span>Fechamento dia ${card.closingDay} | Vence dia ${card.dueDay}</span>
            </div>
          </div>
        </div>
      `;
      cardsGridEl.appendChild(cardCard);
    });
  }

  const barsContainer = document.getElementById('projection-bars-container');
  if (barsContainer && fin.projection && fin.projection.months) {
    barsContainer.innerHTML = '';
    const months = fin.projection.months;
    const maxVal = Math.max(...months.map(m => m.total), 100);

    months.forEach((m, idx) => {
      const isCurrent = idx === 0;
      const isZero = m.total === 0;
      const heightPercent = Math.max(4, Math.round((m.total / maxVal) * 100));

      const col = document.createElement('div');
      col.className = `projection-bar-col ${isCurrent ? 'current' : ''} ${isZero ? 'zero' : ''}`;
      col.title = `${m.monthLabel}: ${formatCurrency(m.total)} (${m.items.length} itens)`;

      col.innerHTML = `
        <span class="bar-amount-tooltip">${isZero ? 'R$ 0' : formatCurrency(m.total)}</span>
        <div class="bar-shape" style="height: ${heightPercent}%;"></div>
        <span class="bar-month-label">${m.shortLabel}</span>
      `;

      col.addEventListener('click', () => {
        showMonthItemsModal(m);
      });

      barsContainer.appendChild(col);
    });
  }

  const instTableBody = document.getElementById('installments-table-body');
  if (instTableBody && projData && projData.installments) {
    instTableBody.innerHTML = '';
    if (projData.installments.length === 0) {
      instTableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-subtle); padding: 20px;">Nenhum parcelamento ativo.</td></tr>';
      return;
    }

    projData.installments.forEach(inst => {
      const card = fin.cards.find(c => c.id === inst.cardId);
      const row = document.createElement('tr');
      const progressPercent = Math.round((inst.currentInstallment / inst.totalInstallments) * 100);

      row.innerHTML = `
        <td>
          <div style="font-weight: 700; color: #fff;">${inst.description}</div>
          <div style="font-size: 11px; color: var(--text-subtle);">${inst.category}</div>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 600; color: #cbd5e1;">${card ? card.name : 'Cartão'}</span>
        </td>
        <td style="font-family: var(--font-mono); font-weight: 700; color: #fbbf24;">
          ${formatCurrency(inst.installmentAmount)}
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-family: var(--font-mono); font-size: 11px; font-weight: 700;">${inst.currentInstallment}/${inst.totalInstallments}</span>
            <div style="width: 70px; height: 6px; background: rgba(255,255,255,0.1); border-radius: 4px; overflow: hidden;">
              <div style="height: 100%; width: ${progressPercent}%; background: var(--color-trigger);"></div>
            </div>
          </div>
        </td>
        <td style="font-family: var(--font-mono); color: var(--text-muted);">
          ${formatCurrency(inst.totalAmount)}
        </td>
        <td>
          <span class="table-finish-badge">🏁 ${inst.endMonth}</span>
        </td>
      `;
      instTableBody.appendChild(row);
    });
  }
}

function showMonthItemsModal(monthData) {
  const modal = document.getElementById('details-modal');
  const title = document.getElementById('details-modal-title');
  const body = document.getElementById('details-modal-body');

  title.textContent = `Fatura Prevista: ${monthData.monthLabel} (${formatCurrency(monthData.total)})`;
  
  if (!monthData.items || monthData.items.length === 0) {
    body.innerHTML = `
      <div style="text-align: center; padding: 20px; color: #34d399;">
        <p style="font-size: 32px;">🎉</p>
        <p style="font-weight: 700; font-size: 16px;">Fatura Zerada!</p>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Você não terá parcelas ativas a pagar neste mês.</p>
      </div>
    `;
  } else {
    let html = `<div style="display: flex; flex-direction: column; gap: 10px;">`;
    monthData.items.forEach(it => {
      html += `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.03); border-radius: 8px;">
          <div>
            <div style="font-weight: 700; color: #fff;">${it.description}</div>
            <div style="font-size: 11px; color: var(--text-subtle);">${it.cardName} ${it.totalInstallments ? `• Parcela ${it.installmentNum}/${it.totalInstallments}` : ''}</div>
          </div>
          <div style="font-weight: 800; font-family: var(--font-mono); color: #fbbf24;">
            ${formatCurrency(it.amount)}
          </div>
        </div>
      `;
    });
    html += `</div>`;
    body.innerHTML = html;
  }

  modal.classList.add('open');
}

// ==========================================================================
// 3. WHATSAPP BAILEYS QR CODE ENGINE
// ==========================================================================
async function checkWhatsAppStatus() {
  try {
    const res = await fetch('/api/whatsapp/status').then(r => r.json());
    if (res.success) {
      currentWhatsAppStatus = res;
      renderWhatsAppStatusUI();
    }
  } catch (err) {
    console.error('Error checking WhatsApp status:', err);
  }
}

function initWhatsAppQRControls() {
  const btnConnect = document.getElementById('btn-whatsapp-connect');
  const btnLogout = document.getElementById('btn-whatsapp-logout');

  if (btnConnect) {
    btnConnect.addEventListener('click', async () => {
      btnConnect.disabled = true;
      btnConnect.textContent = 'Gerando QR Code...';
      try {
        await fetch('/api/whatsapp/connect', { method: 'POST' });
        window.showToast('Solicitando QR Code do WhatsApp...', '📲');
        setTimeout(checkWhatsAppStatus, 1500);
      } catch (err) {
        alert('Erro ao conectar: ' + err.message);
      } finally {
        btnConnect.disabled = false;
        btnConnect.textContent = 'Conectar com QR Code';
      }
    });
  }

  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (!confirm('Deseja desconectar sua conta de WhatsApp?')) return;
      try {
        await fetch('/api/whatsapp/logout', { method: 'POST' });
        window.showToast('WhatsApp desconectado.', '👋');
        await checkWhatsAppStatus();
      } catch (err) {
        alert(err.message);
      }
    });
  }
}

function renderWhatsAppStatusUI() {
  const statusBadge = document.getElementById('wa-connection-badge');
  const statusTitle = document.getElementById('wa-status-title');
  const qrBox = document.getElementById('wa-qrcode-box');
  const connectedBox = document.getElementById('wa-connected-box');
  const btnConnect = document.getElementById('btn-whatsapp-connect');
  const btnLogout = document.getElementById('btn-whatsapp-logout');

  const { status, qrCodeDataUrl, connectedPhone, connectedName } = currentWhatsAppStatus;

  if (status === 'CONNECTED') {
    if (statusBadge) {
      statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
      statusBadge.style.color = '#34d399';
      statusBadge.textContent = '● WhatsApp Conectado';
    }
    if (statusTitle) statusTitle.textContent = `Conectado como ${connectedName || ''} (+${connectedPhone})`;
    if (qrBox) qrBox.style.display = 'none';
    if (connectedBox) {
      connectedBox.style.display = 'flex';
      document.getElementById('wa-connected-phone-display').textContent = `+${connectedPhone}`;
    }
    if (btnConnect) btnConnect.style.display = 'none';
    if (btnLogout) btnLogout.style.display = 'inline-flex';
  } else if (status === 'SCAN_QR' && qrCodeDataUrl) {
    if (statusBadge) {
      statusBadge.style.background = 'rgba(245, 158, 11, 0.2)';
      statusBadge.style.color = '#fbbf24';
      statusBadge.textContent = '● Aguardando Leitura do QR Code';
    }
    if (statusTitle) statusTitle.textContent = 'Aponte a câmera do WhatsApp para conectar';
    if (qrBox) {
      qrBox.style.display = 'flex';
      qrBox.innerHTML = `
        <div style="background: white; padding: 12px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
          <img src="${qrCodeDataUrl}" alt="QR Code WhatsApp" style="width: 260px; height: 260px; display: block;" />
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 10px;">Atualiza automaticamente</p>
      `;
    }
    if (connectedBox) connectedBox.style.display = 'none';
    if (btnConnect) btnConnect.style.display = 'inline-flex';
    if (btnLogout) btnLogout.style.display = 'none';
  } else {
    // DISCONNECTED or GENERATING_QR
    if (statusBadge) {
      statusBadge.style.background = 'rgba(255, 255, 255, 0.1)';
      statusBadge.style.color = 'var(--text-muted)';
      statusBadge.textContent = status === 'GENERATING_QR' ? '● Gerando QR Code...' : '○ Desconectado';
    }
    if (statusTitle) statusTitle.textContent = status === 'GENERATING_QR' ? 'Gerando QR Code...' : 'Clique abaixo para gerar o QR Code';
    if (qrBox) {
      qrBox.style.display = 'flex';
      qrBox.innerHTML = `
        <div style="width: 260px; height: 260px; border: 2px dashed var(--border-medium); border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; color: var(--text-subtle);">
          <span style="font-size: 38px;">📷</span>
          <span style="font-size: 13px;">Nenhum QR Code ativo</span>
        </div>
      `;
    }
    if (connectedBox) connectedBox.style.display = 'none';
    if (btnConnect) btnConnect.style.display = 'inline-flex';
    if (btnLogout) btnLogout.style.display = 'none';
  }
}

// ==========================================================================
// 4. WHATSAPP CHAT INTERACTIVE LOGIC
// ==========================================================================
function initChatInput() {
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send-btn');

  const sendMessage = async () => {
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    appendChatMessage({
      sender: 'user',
      text: text,
      timestamp: new Date().toISOString()
    });

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();
      if (data.success) {
        currentFinancialData = data.financials;
        renderAllViews();
      }
    } catch (e) {
      console.error('Error sending message:', e);
    }
  };

  if (sendBtn) sendBtn.addEventListener('click', sendMessage);
  if (inputEl) {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }

  document.querySelectorAll('.chat-suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      if (inputEl) {
        inputEl.value = chip.getAttribute('data-msg');
        sendMessage();
      }
    });
  });
}

function renderChatMessages() {
  const container = document.getElementById('chat-messages-area');
  if (!container) return;
  container.innerHTML = '';
  currentChatMessages.forEach(msg => {
    appendChatMessage(msg, false);
  });
  scrollChatToBottom();
}

function appendChatMessage(msg, autoScroll = true) {
  const container = document.getElementById('chat-messages-area');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = `chat-bubble ${msg.sender}`;

  const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
  
  let formattedText = msg.text
    .replace(/\*(.*?)\*/g, '<strong>$1</strong>')
    .replace(/_(.*?)_/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>');

  bubble.innerHTML = `
    <div>${formattedText}</div>
    <span class="bubble-time">${timeStr}</span>
  `;

  container.appendChild(bubble);
  if (autoScroll) scrollChatToBottom();
}

function scrollChatToBottom() {
  const container = document.getElementById('chat-messages-area');
  if (container) {
    container.scrollTop = container.scrollHeight;
  }
}

// ==========================================================================
// 5. TRANSACTIONS VIEW
// ==========================================================================
function renderTransactionsTable() {
  const tbody = document.getElementById('transactions-table-body');
  if (!tbody) return;

  tbody.innerHTML = '';
  if (currentTransactions.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-subtle); padding: 20px;">Nenhuma transação registrada.</td></tr>';
    return;
  }

  currentTransactions.forEach(tx => {
    const isIncome = tx.type === 'INCOME';
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <div style="font-weight: 700; color: #fff;">${tx.description}</div>
        <div style="font-size: 11px; color: var(--text-subtle);">${formatDate(tx.date)}</div>
      </td>
      <td>
        <span style="font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 4px; background: ${isIncome ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isIncome ? '#34d399' : '#f87171'};">
          ${isIncome ? 'RECEITA' : 'DESPESA'}
        </span>
      </td>
      <td>${tx.category}</td>
      <td style="font-size: 12px; color: var(--text-muted);">${tx.paymentMethod}</td>
      <td style="font-weight: 800; font-family: var(--font-mono); color: ${isIncome ? '#34d399' : '#f87171'};">
        ${isIncome ? '+' : '-'}${formatCurrency(tx.amount)}
      </td>
      <td>
        <button class="btn-ghost" style="padding: 2px 8px; font-size: 11px; color: var(--color-danger);" onclick="window.deleteTransaction('${tx.id}')">Excluir</button>
      </td>
    `;
    tbody.appendChild(row);
  });
}

window.deleteTransaction = async function(id) {
  if (!confirm('Deseja excluir esta transação?')) return;
  try {
    const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      currentTransactions = currentTransactions.filter(t => t.id !== id);
      await refreshAllData();
      window.showToast('Transação excluída.', '🗑️');
    }
  } catch (e) {
    console.error(e);
  }
};

function renderWebhookInfo() {
  const urlEl = document.getElementById('webhook-endpoint-full-url');
  if (urlEl) {
    urlEl.value = `${window.location.origin}/api/webhook/whatsapp`;
  }
}

// Modal controls
function initModalControls() {
  const modal = document.getElementById('new-tx-modal');
  const openBtn = document.getElementById('btn-open-new-tx-modal');
  const closeBtn = document.getElementById('close-new-tx-modal');
  const form = document.getElementById('new-tx-form');

  if (openBtn) openBtn.addEventListener('click', () => modal.classList.add('open'));
  if (closeBtn) closeBtn.addEventListener('click', () => modal.classList.remove('open'));

  const detailsModal = document.getElementById('details-modal');
  const closeDetailsBtn = document.getElementById('close-details-modal');
  if (closeDetailsBtn) closeDetailsBtn.addEventListener('click', () => detailsModal.classList.remove('open'));

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const desc = document.getElementById('tx-in-desc').value;
      const amount = parseFloat(document.getElementById('tx-in-amount').value);
      const type = document.getElementById('tx-in-type').value;
      const category = document.getElementById('tx-in-category').value;
      const method = document.getElementById('tx-in-method').value;

      try {
        const res = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            description: desc,
            amount: amount,
            type: type,
            category: category,
            paymentMethod: method
          })
        });

        if (res.ok) {
          modal.classList.remove('open');
          form.reset();
          await refreshAllData();
          window.showToast('Lançamento registrado com sucesso!', '✅');
        }
      } catch (err) {
        alert(err.message);
      }
    });
  }
}
