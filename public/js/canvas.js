// ==========================================================================
// CANVAS CONTROLLER: NODES, CONNECTIONS, DRAG & DROP, PAN & ZOOM
// ==========================================================================

class FlowCanvas {
  constructor(viewportEl, svgEl, nodesLayerEl, onNodeSelect) {
    this.viewportEl = viewportEl;
    this.svgEl = svgEl;
    this.nodesLayerEl = nodesLayerEl;
    this.onNodeSelect = onNodeSelect;

    this.nodes = [];
    this.connections = [];
    this.selectedNodeId = null;

    // Viewport transform
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;

    // Interaction states
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;

    this.draggingNode = null;
    this.dragOffsetX = 0;
    this.dragOffsetY = 0;

    this.connectingFrom = null; // { nodeId, portId, x, y }
    this.draftWireEl = null;

    this.initEvents();
  }

  initEvents() {
    // Pan via middle click or drag on background
    this.viewportEl.addEventListener('mousedown', (e) => {
      if (e.target === this.viewportEl || e.target === this.svgEl || e.target === this.nodesLayerEl) {
        this.isPanning = true;
        this.panStartX = e.clientX - this.panX;
        this.panStartY = e.clientY - this.panY;
        this.viewportEl.classList.add('panning');
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        this.panX = e.clientX - this.panStartX;
        this.panY = e.clientY - this.panStartY;
        this.applyTransform();
        return;
      }

      if (this.draggingNode) {
        const clientX = e.clientX;
        const clientY = e.clientY;
        const targetX = (clientX - this.panX) / this.zoom - this.dragOffsetX;
        const targetY = (clientY - this.panY) / this.zoom - this.dragOffsetY;

        this.draggingNode.x = Math.max(20, Math.round(targetX));
        this.draggingNode.y = Math.max(20, Math.round(targetY));
        this.updateNodePositionDom(this.draggingNode);
        this.renderConnections();
        return;
      }

      if (this.connectingFrom) {
        const rect = this.viewportEl.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left - this.panX) / this.zoom;
        const mouseY = (e.clientY - rect.top - this.panY) / this.zoom;
        this.updateDraftWire(mouseX, mouseY);
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (this.isPanning) {
        this.isPanning = false;
        this.viewportEl.classList.remove('panning');
      }

      if (this.draggingNode) {
        this.draggingNode = null;
      }

      if (this.connectingFrom) {
        // If dropped outside port, cancel draft
        this.cancelConnecting();
      }
    });

    // Zoom on wheel
    this.viewportEl.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      const newZoom = Math.min(2.0, Math.max(0.4, this.zoom * zoomFactor));

      const rect = this.viewportEl.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Zoom towards mouse pointer
      this.panX = mouseX - (mouseX - this.panX) * (newZoom / this.zoom);
      this.panY = mouseY - (mouseY - this.panY) * (newZoom / this.zoom);
      this.zoom = newZoom;
      this.applyTransform();
      this.updateZoomIndicator();
    }, { passive: false });
  }

  applyTransform() {
    this.nodesLayerEl.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
    this.renderConnections();
  }

  updateZoomIndicator() {
    const indicator = document.getElementById('zoom-val');
    if (indicator) {
      indicator.textContent = Math.round(this.zoom * 100) + '%';
    }
  }

  resetZoom() {
    this.zoom = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyTransform();
    this.updateZoomIndicator();
  }

  loadWorkflow(workflow) {
    this.nodes = workflow.nodes || [];
    this.connections = workflow.connections || [];
    this.renderAll();
  }

  renderAll() {
    this.nodesLayerEl.innerHTML = '';
    this.nodes.forEach(node => this.renderNodeDom(node));
    this.renderConnections();
    if (this.nodes.length > 0) {
      // Auto select trigger node by default
      const trigger = this.nodes.find(n => n.type === 'trigger-webhook') || this.nodes[0];
      this.selectNode(trigger.id);
    }
  }

  renderNodeDom(node) {
    const meta = NODE_TYPES[node.type] || {
      title: node.title,
      icon: '📦',
      hasInput: true,
      hasOutputs: [{ id: 'output', label: 'Saída' }]
    };

    const el = document.createElement('div');
    el.className = `flow-node ${this.selectedNodeId === node.id ? 'selected' : ''}`;
    el.id = node.id;
    el.setAttribute('data-type', node.type);
    el.style.left = `${node.x}px`;
    el.style.top = `${node.y}px`;

    // Inner HTML with specific Trigger Webhook view
    let detailsHtml = '';
    if (node.type === 'trigger-webhook') {
      const cfg = node.config || {};
      const endpointPath = `/api/webhooks/${cfg.endpointId || 'financeiro-pix'}`;
      detailsHtml = `
        <div class="webhook-card-details">
          <div class="webhook-endpoint-row">
            <span class="http-method-badge ${cfg.httpMethod || 'POST'}">${cfg.httpMethod || 'POST'}</span>
            <span class="endpoint-path" title="${endpointPath}">${endpointPath}</span>
            <button class="webhook-copy-btn" title="Copiar URL Completa" onclick="event.stopPropagation(); window.copyWebhookUrl('${cfg.endpointId || 'financeiro-pix'}')">
              📋
            </button>
          </div>
          <div class="webhook-meta-tags">
            <span class="meta-pill">🔑 ${cfg.authType === 'none' ? 'Sem Auth' : 'Bearer Auth'}</span>
            <span class="meta-pill">⚡ ${cfg.filterEvent || 'Qualquer'}</span>
          </div>
        </div>
      `;
    } else if (node.type === 'condition') {
      const cfg = node.config || {};
      detailsHtml = `
        <div class="webhook-card-details">
          <div style="font-family: var(--font-mono); font-size: 11px; color: #fbbf24;">
            payload.${cfg.conditionField || 'valor'} ${cfg.conditionOperator || '>='} ${cfg.conditionValue || '0'}
          </div>
        </div>
      `;
    } else if (node.type === 'financial-action') {
      const cfg = node.config || {};
      detailsHtml = `
        <div class="webhook-card-details">
          <div style="color: #34d399; font-weight: 600; font-size: 11px;">
            + Lançamento: ${cfg.tipoLancamento || 'RECEITA'}
          </div>
          <div style="color: var(--text-subtle); font-size: 10px;">
            Conta: ${cfg.contaBancaria || 'Conta Principal'}
          </div>
        </div>
      `;
    } else if (node.type === 'notification') {
      const cfg = node.config || {};
      detailsHtml = `
        <div class="webhook-card-details">
          <div style="color: #60a5fa; font-size: 11px;">
            📢 ${cfg.canal || '#financeiro'}
          </div>
        </div>
      `;
    }

    // Ports HTML
    let inputPortHtml = '';
    if (meta.hasInput) {
      inputPortHtml = `
        <div class="port-wrapper input-port">
          <div class="port-socket" data-port-type="input" data-port-id="input" title="Conectar entrada"></div>
          <span class="port-label">Entrada</span>
        </div>
      `;
    }

    let outputPortsHtml = '';
    const outputs = meta.hasOutputs || [{ id: 'output', label: 'Saída' }];
    outputs.forEach(out => {
      outputPortsHtml += `
        <div class="port-wrapper output-port">
          <div class="port-socket" data-port-type="output" data-port-id="${out.id}" title="Arrastar para conectar"></div>
          <span class="port-label">${out.label}</span>
        </div>
      `;
    });

    const isTrigger = node.type === 'trigger-webhook';
    const statusPillText = isTrigger ? '● ATIVO / OUVINDO' : 'CONECTADO';

    el.innerHTML = `
      <div class="node-header">
        <div class="node-header-left">
          <div class="node-icon-wrapper">${meta.icon}</div>
          <div class="node-header-titles">
            <span class="node-header-title">${node.title}</span>
            <span class="node-header-type">${isTrigger ? 'TRIGGER INICIAL' : meta.category}</span>
          </div>
        </div>
        <span class="node-status-pill">${statusPillText}</span>
      </div>
      <div class="node-body">
        <p class="node-desc">${node.subtitle || meta.subtitle || ''}</p>
        ${detailsHtml}
        <div class="node-ports-container">
          ${inputPortHtml}
          ${outputPortsHtml}
        </div>
      </div>
      <div class="node-card-footer">
        ${isTrigger ? `
          <button class="node-trigger-quick-btn" title="Simular Disparo Imediato deste Webhook" onclick="event.stopPropagation(); window.quickTestWebhook('${node.id}')">
            ⚡ Testar Gatilho
          </button>
        ` : `<span style="font-size: 10px; color: var(--text-subtle);">ID: ${node.id}</span>`}
        <button class="node-delete-btn" title="Excluir Nó" onclick="event.stopPropagation(); window.deleteNode('${node.id}')">
          🗑️
        </button>
      </div>
    `;

    // Drag node interaction
    el.addEventListener('mousedown', (e) => {
      if (e.target.closest('.port-socket') || e.target.closest('button')) return;
      this.selectNode(node.id);
      this.draggingNode = node;
      const rect = el.getBoundingClientRect();
      this.dragOffsetX = (e.clientX - rect.left) / this.zoom;
      this.dragOffsetY = (e.clientY - rect.top) / this.zoom;
      e.stopPropagation();
    });

    // Output port drag start for wire creation
    el.querySelectorAll('.port-socket[data-port-type="output"]').forEach(portEl => {
      portEl.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        const portId = portEl.getAttribute('data-port-id');
        const pos = this.getPortCenterCoords(node.id, portId, 'output');
        this.startConnecting(node.id, portId, pos.x, pos.y);
      });
    });

    // Input port drop target
    el.querySelectorAll('.port-socket[data-port-type="input"]').forEach(portEl => {
      portEl.addEventListener('mouseup', (e) => {
        if (this.connectingFrom) {
          e.stopPropagation();
          const portId = portEl.getAttribute('data-port-id');
          this.completeConnecting(node.id, portId);
        }
      });
    });

    this.nodesLayerEl.appendChild(el);
  }

  updateNodePositionDom(node) {
    const el = document.getElementById(node.id);
    if (el) {
      el.style.left = `${node.x}px`;
      el.style.top = `${node.y}px`;
    }
  }

  selectNode(nodeId) {
    this.selectedNodeId = nodeId;
    document.querySelectorAll('.flow-node').forEach(el => {
      el.classList.toggle('selected', el.id === nodeId);
    });
    const node = this.nodes.find(n => n.id === nodeId);
    if (this.onNodeSelect) {
      this.onNodeSelect(node);
    }
  }

  startConnecting(nodeId, portId, x, y) {
    this.connectingFrom = { nodeId, portId, x, y };
    if (!this.draftWireEl) {
      this.draftWireEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      this.draftWireEl.setAttribute('class', 'wire-draft');
      this.svgEl.appendChild(this.draftWireEl);
    }
    this.updateDraftWire(x, y);
  }

  updateDraftWire(toX, toY) {
    if (!this.connectingFrom || !this.draftWireEl) return;
    const { x: fromX, y: fromY } = this.connectingFrom;
    const pathD = this.calculateCubicBezier(fromX, fromY, toX, toY);
    this.draftWireEl.setAttribute('d', pathD);
  }

  cancelConnecting() {
    this.connectingFrom = null;
    if (this.draftWireEl) {
      this.draftWireEl.remove();
      this.draftWireEl = null;
    }
  }

  completeConnecting(toNodeId, toPortId) {
    if (!this.connectingFrom) return;
    const { nodeId: fromNodeId, portId: fromPortId } = this.connectingFrom;

    if (fromNodeId !== toNodeId) {
      // Avoid duplicate connection
      const exists = this.connections.some(c => 
        c.fromNode === fromNodeId && c.fromPort === fromPortId &&
        c.toNode === toNodeId && c.toPort === toPortId
      );

      if (!exists) {
        this.connections.push({
          id: 'conn_' + Date.now(),
          fromNode: fromNodeId,
          fromPort: fromPortId,
          toNode: toNodeId,
          toPort: toPortId
        });
        window.showToast('Conexão criada com sucesso!', 'toast-success');
      }
    }

    this.cancelConnecting();
    this.renderConnections();
  }

  removeConnection(connId) {
    this.connections = this.connections.filter(c => c.id !== connId);
    this.renderConnections();
  }

  addNode(type, x = 300, y = 200) {
    const meta = NODE_TYPES[type];
    if (!meta) return;

    const newId = 'node_' + type + '_' + Date.now().toString(36);
    const newNode = {
      id: newId,
      type: type,
      title: meta.title,
      subtitle: meta.subtitle,
      x: Math.round((x - this.panX) / this.zoom),
      y: Math.round((y - this.panY) / this.zoom),
      config: JSON.parse(JSON.stringify(meta.defaultConfig || {}))
    };

    this.nodes.push(newNode);
    this.renderNodeDom(newNode);
    this.selectNode(newId);
    window.showToast(`Nó "${meta.title}" adicionado!`, 'toast-trigger');
    return newNode;
  }

  deleteNode(nodeId) {
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    this.connections = this.connections.filter(c => c.fromNode !== nodeId && c.toNode !== nodeId);
    const el = document.getElementById(nodeId);
    if (el) el.remove();
    this.renderConnections();

    if (this.selectedNodeId === nodeId) {
      this.selectedNodeId = null;
      if (this.nodes.length > 0) {
        this.selectNode(this.nodes[0].id);
      } else if (this.onNodeSelect) {
        this.onNodeSelect(null);
      }
    }
  }

  getPortCenterCoords(nodeId, portId, portType) {
    const node = this.nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    const nodeEl = document.getElementById(nodeId);
    if (!nodeEl) return { x: node.x + 100, y: node.y + 50 };

    const selector = portType === 'output' 
      ? `.port-socket[data-port-type="output"][data-port-id="${portId}"]`
      : `.port-socket[data-port-type="input"]`;
    
    const socketEl = nodeEl.querySelector(selector);
    if (!socketEl) return { x: node.x + 100, y: node.y + 50 };

    // Position relative to node layer
    const socketRect = socketEl.getBoundingClientRect();
    const layerRect = this.nodesLayerEl.getBoundingClientRect();

    const x = (socketRect.left + socketRect.width / 2 - layerRect.left) / this.zoom;
    const y = (socketRect.top + socketRect.height / 2 - layerRect.top) / this.zoom;

    return { x, y };
  }

  calculateCubicBezier(x1, y1, x2, y2) {
    const dx = Math.abs(x2 - x1) * 0.55;
    const cp1x = x1 + Math.max(dx, 40);
    const cp1y = y1;
    const cp2x = x2 - Math.max(dx, 40);
    const cp2y = y2;
    return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
  }

  renderConnections() {
    // Preserve draft wire if connecting
    const draft = this.draftWireEl;
    this.svgEl.innerHTML = '';
    if (draft) this.svgEl.appendChild(draft);

    this.connections.forEach(conn => {
      const fromPos = this.getPortCenterCoords(conn.fromNode, conn.fromPort, 'output');
      const toPos = this.getPortCenterCoords(conn.toNode, conn.toPort, 'input');

      // Convert to SVG viewport coordinates (pan & zoom applied)
      const svgFromX = fromPos.x * this.zoom + this.panX;
      const svgFromY = fromPos.y * this.zoom + this.panY;
      const svgToX = toPos.x * this.zoom + this.panX;
      const svgToY = toPos.y * this.zoom + this.panY;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('class', 'wire-path');
      path.setAttribute('id', conn.id);
      path.setAttribute('d', this.calculateCubicBezier(svgFromX, svgFromY, svgToX, svgToY));

      // Right click to delete wire
      path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        this.removeConnection(conn.id);
        window.showToast('Conexão removida', 'toast-trigger');
      });

      this.svgEl.appendChild(path);
    });
  }

  animateExecution(pathNodeIds) {
    // Animate nodes and wires in path
    pathNodeIds.forEach((nodeId, idx) => {
      setTimeout(() => {
        const el = document.getElementById(nodeId);
        if (el) {
          el.classList.add('executing');
          setTimeout(() => el.classList.remove('executing'), 1500);
        }

        // Animate outgoing wires
        if (idx < pathNodeIds.length - 1) {
          const nextNodeId = pathNodeIds[idx + 1];
          const conn = this.connections.find(c => c.fromNode === nodeId && c.toNode === nextNodeId);
          if (conn) {
            const wireEl = document.getElementById(conn.id);
            if (wireEl) {
              wireEl.classList.add('wire-animated');
              setTimeout(() => wireEl.classList.remove('wire-animated'), 2000);
            }
          }
        }
      }, idx * 500);
    });
  }
}
