// ==========================================================================
// APP CONTROLLER - UI BINDINGS, INSPECTOR, SSE & WEBHHOOK SIMULATION
// ==========================================================================

let canvasInstance = null;
let workflowEngine = null;
let currentSelectedNode = null;
let activeTab = 'tab-config';
let sseSource = null;
let receivedWebhooks = [];

// Logger helper
const logConsole = {
  container: null,
  counterEl: null,
  count: 0,
  init() {
    this.container = document.getElementById('console-logs');
    this.counterEl = document.getElementById('log-count-pill');
  },
  addLog(type, message, tagClass = 'tag-info') {
    if (!this.container) return;
    this.count++;
    if (this.counterEl) this.counterEl.textContent = `${this.count} eventos`;

    const timeStr = new Date().toLocaleTimeString('pt-BR');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      <span class="log-time">${timeStr}</span>
      <span class="log-tag ${tagClass}">${type.toUpperCase()}</span>
      <span class="log-text">${message}</span>
    `;
    this.container.appendChild(entry);
    this.container.scrollTop = this.container.scrollHeight;
  },
  clear() {
    if (!this.container) return;
    this.container.innerHTML = '';
    this.count = 0;
    if (this.counterEl) this.counterEl.textContent = '0 eventos';
  }
};

// Toast notification
window.showToast = function(message, type = 'toast-trigger') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>⚡</span> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3200);
};

// Document Ready Initialization
document.addEventListener('DOMContentLoaded', async () => {
  logConsole.init();

  const viewportEl = document.getElementById('canvas-viewport');
  const svgEl = document.getElementById('connections-svg');
  const nodesLayerEl = document.getElementById('nodes-layer');

  canvasInstance = new FlowCanvas(viewportEl, svgEl, nodesLayerEl, onNodeSelect);
  workflowEngine = new WorkflowEngine(canvasInstance, logConsole);

  // Load workflow from server or default
  await loadWorkflow();

  // Setup SSE for real-time external webhooks
  initSSE();

  // Setup sidebar palette drag & drop
  initPalette();

  // Setup Header Actions
  initHeaderControls();

  // Setup Inspector Tabs
  initInspectorTabs();

  // Setup Console drawer toggle
  initConsoleToggle();

  logConsole.addLog('info', 'Sistema Financeiro carregado. Motor de fluxo e Webhook Trigger prontos para receber requisições.', 'tag-info');
});

// Load workflow from backend API
async function loadWorkflow() {
  try {
    const res = await fetch('/api/workflows');
    if (res.ok) {
      const data = await res.json();
      if (data.workflow) {
        canvasInstance.loadWorkflow(data.workflow);
        return;
      }
    }
  } catch (e) {
    console.warn('Backend not responding, using local default workflow', e);
  }

  // Fallback default
  canvasInstance.loadWorkflow({
    id: 'wf-financeiro',
    name: 'Fluxo Pix',
    nodes: [
      {
        id: 'node-trigger-webhook',
        type: 'trigger-webhook',
        title: 'Gatilho: Webhook Financeiro',
        subtitle: 'Recebe eventos de pagamentos instantâneos',
        x: 100,
        y: 160,
        config: {
          endpointId: 'financeiro-pix',
          httpMethod: 'POST',
          authType: 'bearer',
          secretToken: 'secret_fin_token_2026',
          filterEvent: 'pix.recebido',
          responseStatus: 200,
          responseJson: '{\n  "status": "received",\n  "system": "FinFlow Engine",\n  "processed": true\n}'
        }
      },
      {
        id: 'node-filter-valor',
        type: 'condition',
        title: 'Condição: Valor Mínimo',
        subtitle: 'payload.valor >= 50.00',
        x: 480,
        y: 160,
        config: {
          conditionField: 'valor',
          conditionOperator: '>=',
          conditionValue: '50.00'
        }
      },
      {
        id: 'node-action-conciliacao',
        type: 'financial-action',
        title: 'Conciliação Financeira',
        subtitle: 'Lançar no Contas a Receber',
        x: 860,
        y: 90,
        config: {
          tipoLancamento: 'RECEITA',
          categoria: 'Vendas Online (Pix)',
          contaBancaria: 'Conta Digital PJ (0001 / 98765-4)',
          autoCompensar: true
        }
      },
      {
        id: 'node-action-notificacao',
        type: 'notification',
        title: 'Notificação Push / Slack',
        subtitle: 'Canal #financeiro-alertas',
        x: 860,
        y: 280,
        config: {
          canal: '#financeiro-recebimentos',
          template: '💰 *Novo Pix Confirmado!*\n• Valor: R$ {{payload.valor}}\n• Pagador: {{payload.pagador.nome}}\n• ID Transação: {{payload.endToEndId}}'
        }
      }
    ],
    connections: [
      { id: 'c1', fromNode: 'node-trigger-webhook', fromPort: 'output', toNode: 'node-filter-valor', toPort: 'input' },
      { id: 'c2', fromNode: 'node-filter-valor', fromPort: 'output-true', toNode: 'node-action-conciliacao', toPort: 'input' },
      { id: 'c3', fromNode: 'node-filter-valor', fromPort: 'output-true', toNode: 'node-action-notificacao', toPort: 'input' }
    ]
  });
}

// SSE Connection to listen for external incoming webhooks
function initSSE() {
  if (!!window.EventSource) {
    sseSource = new EventSource('/api/events');
    sseSource.addEventListener('webhook-triggered', (e) => {
      try {
        const eventRecord = JSON.parse(e.data);
        handleIncomingWebhookEvent(eventRecord);
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    });

    sseSource.onerror = () => {
      // Reconnect handled automatically by EventSource
    };
  }
}

function handleIncomingWebhookEvent(eventRecord) {
  receivedWebhooks.unshift(eventRecord);
  if (receivedWebhooks.length > 50) receivedWebhooks.pop();

  window.showToast(`⚡ Webhook recebido via ${eventRecord.method}! ID: ${eventRecord.id}`, 'toast-trigger');
  
  // Run flow
  workflowEngine.runFromWebhook(eventRecord);

  // Update logs tab if open
  if (currentSelectedNode && currentSelectedNode.type === 'trigger-webhook' && activeTab === 'tab-logs') {
    renderWebhookHistoryTab(currentSelectedNode);
  }
}

// Sidebar palette drag & drop
function initPalette() {
  document.querySelectorAll('.palette-item').forEach(item => {
    item.addEventListener('click', () => {
      const type = item.getAttribute('data-type');
      const centerX = window.innerWidth / 2 - 140;
      const centerY = window.innerHeight / 2 - 100;
      canvasInstance.addNode(type, centerX, centerY);
    });
  });
}

// Header controls
function initHeaderControls() {
  document.getElementById('btn-zoom-in').addEventListener('click', () => {
    canvasInstance.zoom = Math.min(2.0, canvasInstance.zoom * 1.15);
    canvasInstance.applyTransform();
    canvasInstance.updateZoomIndicator();
  });

  document.getElementById('btn-zoom-out').addEventListener('click', () => {
    canvasInstance.zoom = Math.max(0.4, canvasInstance.zoom * 0.85);
    canvasInstance.applyTransform();
    canvasInstance.updateZoomIndicator();
  });

  document.getElementById('btn-zoom-reset').addEventListener('click', () => {
    canvasInstance.resetZoom();
  });

  document.getElementById('btn-quick-trigger').addEventListener('click', () => {
    const triggerNode = canvasInstance.nodes.find(n => n.type === 'trigger-webhook');
    if (triggerNode) {
      window.quickTestWebhook(triggerNode.id);
    } else {
      window.showToast('Nenhum nó de Gatilho (Webhook) no fluxo!', 'toast-trigger');
    }
  });

  document.getElementById('btn-save-flow').addEventListener('click', async () => {
    const payload = {
      id: 'wf-financeiro-salvo',
      nodes: canvasInstance.nodes,
      connections: canvasInstance.connections
    };
    try {
      const res = await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        window.showToast('Fluxo salvo com sucesso no servidor!', 'toast-success');
      }
    } catch (e) {
      window.showToast('Fluxo salvo localmente!', 'toast-success');
    }
  });

  document.getElementById('btn-clear-logs').addEventListener('click', () => {
    logConsole.clear();
  });
}

// Inspector Tabs setup
function initInspectorTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeTab = btn.getAttribute('data-tab');
      if (currentSelectedNode) {
        renderInspectorContent(currentSelectedNode);
      }
    });
  });

  document.getElementById('inspector-close').addEventListener('click', () => {
    document.getElementById('inspector-drawer').classList.add('collapsed');
  });
}

// Bottom console toggle
function initConsoleToggle() {
  const bar = document.getElementById('console-bar');
  const header = document.getElementById('console-toggle-header');
  header.addEventListener('click', () => {
    bar.classList.toggle('expanded');
    bar.classList.toggle('collapsed');
  });
}

// Callback when a node is selected in Canvas
function onNodeSelect(node) {
  currentSelectedNode = node;
  const drawer = document.getElementById('inspector-drawer');
  if (!node) {
    drawer.classList.add('collapsed');
    return;
  }

  drawer.classList.remove('collapsed');
  renderInspectorContent(node);
}

// Renders Inspector Content based on selected node & active tab
function renderInspectorContent(node) {
  const titleEl = document.getElementById('inspector-node-title');
  const badgeEl = document.getElementById('inspector-node-badge');
  const bodyEl = document.getElementById('inspector-body');

  titleEl.textContent = node.title;
  badgeEl.textContent = node.type === 'trigger-webhook' ? '⚡ GATILHO WEBHOOK' : node.type.toUpperCase();

  const isTrigger = node.type === 'trigger-webhook';

  // Toggle tab visibility: Trigger has Config, Simulator, Logs, Snippets.
  const tabsContainer = document.querySelector('.inspector-tabs');
  if (isTrigger) {
    tabsContainer.style.display = 'flex';
  } else {
    tabsContainer.style.display = 'none';
  }

  if (isTrigger) {
    if (activeTab === 'tab-config') {
      renderWebhookConfigTab(node, bodyEl);
    } else if (activeTab === 'tab-simulator') {
      renderWebhookSimulatorTab(node, bodyEl);
    } else if (activeTab === 'tab-logs') {
      renderWebhookHistoryTab(node, bodyEl);
    } else if (activeTab === 'tab-snippets') {
      renderWebhookSnippetsTab(node, bodyEl);
    }
  } else {
    renderStandardNodeConfig(node, bodyEl);
  }
}

// ==========================================================================
// WEBHOOK TRIGGER INSPECTOR VIEWS
// ==========================================================================

// TAB 1: Configuração do Webhook
function renderWebhookConfigTab(node, container) {
  const cfg = node.config || {};
  const currentUrl = `${window.location.origin}/api/webhooks/${cfg.endpointId || 'financeiro-pix'}`;

  container.innerHTML = `
    <div class="form-group">
      <label class="form-label">
        <span>URL Completa do Webhook</span>
        <span style="color: #34d399; font-size: 10px;">● Pronta para receber POST</span>
      </label>
      <div class="copy-input-box">
        <input type="text" id="cfg-webhook-url" readonly value="${currentUrl}" />
        <button class="copy-icon-btn" onclick="window.copyToClipboard('${currentUrl}', this)">
          Copiar URL
        </button>
      </div>
      <p class="form-hint">Cole esta URL no painel do gateway bancário (ex: Asaas, Stripe, Banco Central).</p>
    </div>

    <div class="form-grid-2">
      <div class="form-group">
        <label class="form-label">Método HTTP</label>
        <select class="form-select" id="cfg-method">
          <option value="POST" ${cfg.httpMethod === 'POST' ? 'selected' : ''}>POST (Padrão)</option>
          <option value="GET" ${cfg.httpMethod === 'GET' ? 'selected' : ''}>GET</option>
          <option value="PUT" ${cfg.httpMethod === 'PUT' ? 'selected' : ''}>PUT</option>
        </select>
      </div>

      <div class="form-group">
        <label class="form-label">Identificador do Endpoint</label>
        <input class="form-input" type="text" id="cfg-endpoint-id" value="${cfg.endpointId || 'financeiro-pix'}" />
      </div>
    </div>

    <div class="form-group">
      <label class="form-label">Tipo de Autenticação</label>
      <select class="form-select" id="cfg-auth-type">
        <option value="none" ${cfg.authType === 'none' ? 'selected' : ''}>Nenhuma Autenticação (Aberto)</option>
        <option value="bearer" ${cfg.authType === 'bearer' ? 'selected' : ''}>Bearer Token (Header Authorization)</option>
        <option value="hmac" ${cfg.authType === 'hmac' ? 'selected' : ''}>HMAC SHA256 Signature (Header X-Signature)</option>
      </select>
    </div>

    <div class="form-group">
      <label class="form-label">Chave Secreta / Bearer Token</label>
      <input class="form-input" type="text" id="cfg-secret" value="${cfg.secretToken || ''}" placeholder="Ex: secret_token_abc123" />
      <p class="form-hint">Validação de integridade nas requisições recebidas.</p>
    </div>

    <div class="form-group">
      <label class="form-label">Filtro de Nome de Evento (Opcional)</label>
      <input class="form-input" type="text" id="cfg-filter-event" value="${cfg.filterEvent || ''}" placeholder="Ex: pix.recebido ou charge.succeeded" />
      <p class="form-hint">Somente executará o fluxo se o campo <code>evento</code> corresponder a este valor.</p>
    </div>

    <div class="form-group">
      <label class="form-label">Resposta HTTP Automática</label>
      <div class="form-grid-2" style="margin-bottom: 8px;">
        <select class="form-select" id="cfg-response-status">
          <option value="200" ${cfg.responseStatus == 200 ? 'selected' : ''}>HTTP 200 OK</option>
          <option value="201" ${cfg.responseStatus == 201 ? 'selected' : ''}>HTTP 201 Created</option>
          <option value="202" ${cfg.responseStatus == 202 ? 'selected' : ''}>HTTP 202 Accepted</option>
        </select>
        <span style="font-size: 11px; color: var(--text-muted); display:flex; align-items:center;">Resposta síncrona retornada</span>
      </div>
      <textarea class="form-textarea" id="cfg-response-json" rows="4">${cfg.responseJson || '{\n  "success": true\n}'}</textarea>
    </div>

    <button class="btn btn-primary" style="margin-top: 10px;" onclick="window.saveCurrentNodeConfig()">
      Salvar Configuração do Webhook
    </button>
  `;

  // Attach change listener for auto update
  ['cfg-method', 'cfg-endpoint-id', 'cfg-auth-type', 'cfg-secret', 'cfg-filter-event', 'cfg-response-status', 'cfg-response-json'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', window.saveCurrentNodeConfig);
  });
}

// TAB 2: Testador & Simulador de Webhook
let currentSimulatorPayload = JSON.stringify(WEBHOOK_PRESETS.pix.payload, null, 2);

function renderWebhookSimulatorTab(node, container) {
  const cfg = node.config || {};
  container.innerHTML = `
    <div class="form-group">
      <label class="form-label">Escolha um Template Financeiro</label>
      <div class="preset-chip-list">
        <button class="preset-chip active" onclick="window.loadPresetPayload('pix', this)">🪙 Pix Instantâneo</button>
        <button class="preset-chip" onclick="window.loadPresetPayload('stripe', this)">💳 Stripe Cartão</button>
        <button class="preset-chip" onclick="window.loadPresetPayload('asaas', this)">📄 Asaas Boleto</button>
        <button class="preset-chip" onclick="window.loadPresetPayload('mercadopago', this)">🛍️ Mercado Pago</button>
      </div>
    </div>

    <div class="code-editor-wrapper">
      <div class="editor-toolbar">
        <span class="editor-lang">JSON Payload do Webhook</span>
        <button class="btn-ghost" style="padding: 2px 8px; font-size: 11px;" onclick="window.formatSimulatorJson()">Formatar JSON</button>
      </div>
      <textarea id="simulator-json-input" class="code-editor-textarea">${currentSimulatorPayload}</textarea>
    </div>

    <button class="fire-trigger-btn" onclick="window.triggerSimulatorWebhook()">
      ⚡ Disparar Webhook de Teste Agora
    </button>
    <p class="form-hint" style="text-align: center;">O disparo simula a chegada de um payload real e executará todos os nós conectados.</p>
  `;

  const inputEl = document.getElementById('simulator-json-input');
  if (inputEl) {
    inputEl.addEventListener('input', (e) => {
      currentSimulatorPayload = e.target.value;
    });
  }
}

// TAB 3: Histórico de Requisições Recebidas
function renderWebhookHistoryTab(node, container) {
  if (receivedWebhooks.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 10px; color: var(--text-subtle);">
        <p style="font-size: 28px; margin-bottom: 8px;">📡</p>
        <p style="font-weight: 600; color: var(--text-muted);">Nenhum webhook recebido ainda</p>
        <p style="font-size: 12px; margin-top: 4px;">Envie uma requisição HTTP para a URL do Webhook ou use o Simulador.</p>
      </div>
    `;
    return;
  }

  let html = `<div class="logs-list">`;
  receivedWebhooks.forEach((ev, idx) => {
    html += `
      <div class="request-log-card">
        <div class="log-header-row">
          <span class="log-method-badge">${ev.method}</span>
          <span class="log-time-str">${new Date(ev.timestamp).toLocaleTimeString('pt-BR')}</span>
          <span style="color: #34d399; font-size: 11px; font-weight:700;">HTTP ${ev.httpStatus}</span>
        </div>
        <div class="log-payload-preview">${JSON.stringify(ev.payload, null, 2)}</div>
        <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
          <button class="btn btn-ghost" style="padding: 4px 10px; font-size: 11px;" onclick="window.replayWebhook(${idx})">
            🔄 Re-executar com este Payload
          </button>
        </div>
      </div>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;
}

// TAB 4: Snippets de Integração (cURL, Fetch, Python)
function renderWebhookSnippetsTab(node, container) {
  const cfg = node.config || {};
  const currentUrl = `${window.location.origin}/api/webhooks/${cfg.endpointId || 'financeiro-pix'}`;
  const sampleJson = JSON.stringify(WEBHOOK_PRESETS.pix.payload, null, 2);

  const curlSnippet = `curl -X POST "${currentUrl}" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${cfg.secretToken || 'seu_token'}" \\
  -d '${sampleJson.replace(/'/g, "\\'")}'`;

  const fetchSnippet = `await fetch("${currentUrl}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer ${cfg.secretToken || 'seu_token'}"
  },
  body: JSON.stringify(${sampleJson})
});`;

  container.innerHTML = `
    <div class="form-group">
      <label class="form-label">cURL (Terminal / Postman)</label>
      <div class="snippet-box">
        <button class="snippet-copy-btn" onclick="window.copyToClipboard(\`${curlSnippet.replace(/`/g, '\\`')}\`, this)">Copiar</button>
        <pre>${curlSnippet}</pre>
      </div>
    </div>

    <div class="form-group" style="margin-top: 14px;">
      <label class="form-label">JavaScript (Fetch API / Node.js)</label>
      <div class="snippet-box">
        <button class="snippet-copy-btn" onclick="window.copyToClipboard(\`${fetchSnippet.replace(/`/g, '\\`')}\`, this)">Copiar</button>
        <pre>${fetchSnippet}</pre>
      </div>
    </div>
  `;
}

// STANDARD NODE CONFIGURATION (Condition, Financial Action, Notification)
function renderStandardNodeConfig(node, container) {
  const cfg = node.config || {};

  if (node.type === 'condition') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Campo do Payload para Testar</label>
        <input class="form-input" id="cfg-cond-field" value="${cfg.conditionField || 'valor'}" placeholder="ex: valor ou pagador.nome" />
      </div>
      <div class="form-grid-2">
        <div class="form-group">
          <label class="form-label">Operador</label>
          <select class="form-select" id="cfg-cond-op">
            <option value=">=" ${cfg.conditionOperator === '>=' ? 'selected' : ''}>Maior ou igual (&gt;=)</option>
            <option value=">" ${cfg.conditionOperator === '>' ? 'selected' : ''}>Maior (&gt;)</option>
            <option value="<=" ${cfg.conditionOperator === '<=' ? 'selected' : ''}>Menor ou igual (&lt;=)</option>
            <option value="<" ${cfg.conditionOperator === '<' ? 'selected' : ''}>Menor (&lt;)</option>
            <option value="==" ${cfg.conditionOperator === '==' ? 'selected' : ''}>Igual (==)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Valor Alvo</label>
          <input class="form-input" id="cfg-cond-val" value="${cfg.conditionValue || '50.00'}" />
        </div>
      </div>
      <button class="btn btn-primary" onclick="window.saveStandardConfig()">Salvar Condição</button>
    `;
  } else if (node.type === 'financial-action') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Tipo de Lançamento</label>
        <select class="form-select" id="cfg-fin-tipo">
          <option value="RECEITA" ${cfg.tipoLancamento === 'RECEITA' ? 'selected' : ''}>Receita / Crédito (+)</option>
          <option value="DESPESA" ${cfg.tipoLancamento === 'DESPESA' ? 'selected' : ''}>Despesa / Estorno (-)</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Categoria Financeira</label>
        <input class="form-input" id="cfg-fin-cat" value="${cfg.categoria || 'Vendas Pix Online'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Conta Bancária de Destino</label>
        <input class="form-input" id="cfg-fin-conta" value="${cfg.contaBancaria || 'Conta Digital PJ (0001 / 98765-4)'}" />
      </div>
      <button class="btn btn-primary" onclick="window.saveStandardConfig()">Salvar Ação Financeira</button>
    `;
  } else if (node.type === 'notification') {
    container.innerHTML = `
      <div class="form-group">
        <label class="form-label">Canal de Destino</label>
        <input class="form-input" id="cfg-notif-canal" value="${cfg.canal || '#financeiro-recebimentos'}" />
      </div>
      <div class="form-group">
        <label class="form-label">Template da Mensagem (Suporta variáveis)</label>
        <textarea class="form-textarea" id="cfg-notif-tpl" rows="5">${cfg.template || ''}</textarea>
        <p class="form-hint">Variáveis disponíveis: <code>{{payload.valor}}</code>, <code>{{payload.pagador.nome}}</code>, <code>{{payload.endToEndId}}</code></p>
      </div>
      <button class="btn btn-primary" onclick="window.saveStandardConfig()">Salvar Notificação</button>
    `;
  } else {
    container.innerHTML = `<p style="color: var(--text-muted); font-size: 13px;">Nenhuma configuração personalizada para este nó.</p>`;
  }
}

// Global window helpers for interactive buttons
window.saveCurrentNodeConfig = function() {
  if (!currentSelectedNode) return;
  const methodEl = document.getElementById('cfg-method');
  const endpointEl = document.getElementById('cfg-endpoint-id');
  const authEl = document.getElementById('cfg-auth-type');
  const secretEl = document.getElementById('cfg-secret');
  const filterEl = document.getElementById('cfg-filter-event');
  const respStatusEl = document.getElementById('cfg-response-status');
  const respJsonEl = document.getElementById('cfg-response-json');

  if (currentSelectedNode.type === 'trigger-webhook') {
    currentSelectedNode.config = {
      httpMethod: methodEl ? methodEl.value : 'POST',
      endpointId: endpointEl ? endpointEl.value : 'financeiro-pix',
      authType: authEl ? authEl.value : 'none',
      secretToken: secretEl ? secretEl.value : '',
      filterEvent: filterEl ? filterEl.value : '',
      responseStatus: respStatusEl ? respStatusEl.value : 200,
      responseJson: respJsonEl ? respJsonEl.value : '{"status":"ok"}'
    };
    canvasInstance.renderAll();
    window.showToast('Configuração do Webhook atualizada com sucesso!', 'toast-success');
  }
};

window.saveStandardConfig = function() {
  if (!currentSelectedNode) return;
  if (currentSelectedNode.type === 'condition') {
    currentSelectedNode.config = {
      conditionField: document.getElementById('cfg-cond-field').value,
      conditionOperator: document.getElementById('cfg-cond-op').value,
      conditionValue: document.getElementById('cfg-cond-val').value
    };
    currentSelectedNode.subtitle = `payload.${currentSelectedNode.config.conditionField} ${currentSelectedNode.config.conditionOperator} ${currentSelectedNode.config.conditionValue}`;
  } else if (currentSelectedNode.type === 'financial-action') {
    currentSelectedNode.config = {
      tipoLancamento: document.getElementById('cfg-fin-tipo').value,
      categoria: document.getElementById('cfg-fin-cat').value,
      contaBancaria: document.getElementById('cfg-fin-conta').value
    };
  } else if (currentSelectedNode.type === 'notification') {
    currentSelectedNode.config = {
      canal: document.getElementById('cfg-notif-canal').value,
      template: document.getElementById('cfg-notif-tpl').value
    };
  }
  canvasInstance.renderAll();
  window.showToast('Nó atualizado!', 'toast-success');
};

window.copyToClipboard = function(text, btnElement) {
  navigator.clipboard.writeText(text).then(() => {
    if (btnElement) {
      const origText = btnElement.textContent;
      btnElement.textContent = 'Copiado!';
      btnElement.classList.add('copied');
      setTimeout(() => {
        btnElement.textContent = origText;
        btnElement.classList.remove('copied');
      }, 2000);
    }
  });
};

window.copyWebhookUrl = function(endpointId) {
  const fullUrl = `${window.location.origin}/api/webhooks/${endpointId}`;
  window.copyToClipboard(fullUrl);
  window.showToast(`URL do Webhook copiada: ${fullUrl}`, 'toast-trigger');
};

window.loadPresetPayload = function(presetKey, btnEl) {
  document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
  if (btnEl) btnEl.classList.add('active');

  const preset = WEBHOOK_PRESETS[presetKey];
  if (preset) {
    currentSimulatorPayload = JSON.stringify(preset.payload, null, 2);
    const textarea = document.getElementById('simulator-json-input');
    if (textarea) textarea.value = currentSimulatorPayload;
    window.showToast(`Template "${preset.name}" carregado!`, 'toast-trigger');
  }
};

window.formatSimulatorJson = function() {
  const textarea = document.getElementById('simulator-json-input');
  if (textarea) {
    try {
      const obj = JSON.parse(textarea.value);
      textarea.value = JSON.stringify(obj, null, 2);
      currentSimulatorPayload = textarea.value;
    } catch (e) {
      alert('JSON Inválido: ' + e.message);
    }
  }
};

window.triggerSimulatorWebhook = async function() {
  const textarea = document.getElementById('simulator-json-input');
  let payloadObj = {};
  try {
    payloadObj = JSON.parse(textarea ? textarea.value : currentSimulatorPayload);
  } catch (e) {
    alert('Erro no JSON: ' + e.message);
    return;
  }

  const triggerNode = canvasInstance.nodes.find(n => n.type === 'trigger-webhook');
  const endpointId = triggerNode && triggerNode.config ? triggerNode.config.endpointId : 'financeiro-pix';

  try {
    const res = await fetch('/api/webhooks/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        webhookId: endpointId,
        payload: payloadObj
      })
    });
    if (res.ok) {
      const data = await res.json();
      window.showToast('⚡ Webhook disparado via simulação!', 'toast-trigger');
    }
  } catch (e) {
    // If backend simulate failed, run locally
    const fallbackEvent = {
      id: 'ev_sim_' + Date.now().toString(36),
      webhookId: endpointId,
      timestamp: new Date().toISOString(),
      method: 'POST (Simulado)',
      payload: payloadObj,
      httpStatus: 200
    };
    handleIncomingWebhookEvent(fallbackEvent);
  }
};

window.quickTestWebhook = function(nodeId) {
  canvasInstance.selectNode(nodeId);
  activeTab = 'tab-simulator';
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-tab') === 'tab-simulator');
  });
  renderInspectorContent(canvasInstance.nodes.find(n => n.id === nodeId));
  window.triggerSimulatorWebhook();
};

window.replayWebhook = function(idx) {
  const ev = receivedWebhooks[idx];
  if (ev) {
    window.showToast('Re-executando evento anterior...', 'toast-trigger');
    workflowEngine.runFromWebhook(ev);
  }
};

window.deleteNode = function(nodeId) {
  canvasInstance.deleteNode(nodeId);
  window.showToast('Nó excluído do fluxo.', 'toast-trigger');
};
