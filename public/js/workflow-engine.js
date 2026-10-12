// ==========================================================================
// WORKFLOW EXECUTION ENGINE - EVALUATION, PIPELINE RUNNER & LOGS
// ==========================================================================

class WorkflowEngine {
  constructor(canvas, logConsole) {
    this.canvas = canvas;
    this.logConsole = logConsole;
  }

  async runFromWebhook(eventRecord) {
    const triggerNode = this.canvas.nodes.find(n => n.type === 'trigger-webhook');
    if (!triggerNode) {
      this.logConsole.addLog('trigger', 'Nenhum nó de Gatilho (Webhook) encontrado no fluxo.', 'tag-trigger');
      return;
    }

    const payload = eventRecord.payload || {};
    const cfg = triggerNode.config || {};

    this.logConsole.addLog('trigger', `⚡ Webhook Recebido [${eventRecord.method} ${triggerNode.title}] - ID: ${eventRecord.id}`, 'tag-trigger');
    
    // Check event filter if specified
    if (cfg.filterEvent && payload.evento && payload.evento !== cfg.filterEvent) {
      this.logConsole.addLog('trigger', `⚠️ Evento "${payload.evento}" ignorado (filtro configurado para "${cfg.filterEvent}")`, 'tag-trigger');
      return;
    }

    // Traverse the workflow starting from trigger
    const executedPath = [triggerNode.id];
    await this.executeNodeChain(triggerNode.id, 'output', payload, executedPath);

    // Animate visual path in canvas
    this.canvas.animateExecution(executedPath);
  }

  async executeNodeChain(fromNodeId, fromPortId, currentPayload, pathTracker) {
    // Find all outgoing connections from this port
    const outConns = this.canvas.connections.filter(c => c.fromNode === fromNodeId && c.fromPort === fromPortId);

    for (const conn of outConns) {
      const nextNode = this.canvas.nodes.find(n => n.id === conn.toNode);
      if (!nextNode) continue;

      pathTracker.push(nextNode.id);
      const nextResult = await this.executeSingleNode(nextNode, currentPayload);

      if (nextResult && nextResult.continue) {
        await this.executeNodeChain(nextNode.id, nextResult.nextPort || 'output', currentPayload, pathTracker);
      }
    }
  }

  async executeSingleNode(node, payload) {
    const cfg = node.config || {};

    if (node.type === 'condition') {
      const field = cfg.conditionField || 'valor';
      const op = cfg.conditionOperator || '>=';
      const targetVal = parseFloat(cfg.conditionValue) || 0;

      // Extract field from payload (supports nested e.g. pagador.nome or valor)
      const actualVal = this.getNestedValue(payload, field);
      const numVal = parseFloat(actualVal);

      let isMatch = false;
      if (!isNaN(numVal) && !isNaN(targetVal)) {
        if (op === '>=') isMatch = numVal >= targetVal;
        else if (op === '>') isMatch = numVal > targetVal;
        else if (op === '<=') isMatch = numVal <= targetVal;
        else if (op === '<') isMatch = numVal < targetVal;
        else if (op === '==') isMatch = numVal == targetVal;
      } else {
        isMatch = String(actualVal) === String(cfg.conditionValue);
      }

      this.logConsole.addLog('condition', `🔀 [Condição: ${node.title}] "${field}" (${actualVal}) ${op} ${cfg.conditionValue} -> ${isMatch ? '✅ VERDADEIRO' : '❌ FALSO'}`, 'tag-condition');

      return {
        continue: true,
        nextPort: isMatch ? 'output-true' : 'output-false'
      };
    }

    if (node.type === 'financial-action') {
      const valor = payload.valor || payload.amount || 0;
      const pagador = (payload.pagador && payload.pagador.nome) ? payload.pagador.nome : 'Cliente Não Identificado';
      
      this.logConsole.addLog('finance', `💰 [Conciliação Financeira] Lançamento efetuado: R$ ${valor} (${cfg.categoria || 'Venda'}) na conta [${cfg.contaBancaria}]. Pagador: ${pagador}`, 'tag-finance');

      return {
        continue: true,
        nextPort: 'output'
      };
    }

    if (node.type === 'notification') {
      let msg = cfg.template || 'Notificação recebida';
      msg = msg.replace(/\{\{payload\.valor\}\}/g, payload.valor || '')
               .replace(/\{\{payload\.pagador\.nome\}\}/g, (payload.pagador && payload.pagador.nome) || '')
               .replace(/\{\{payload\.endToEndId\}\}/g, payload.endToEndId || payload.id || '');

      this.logConsole.addLog('notif', `📢 [Notificação ${cfg.canal || 'Geral'}] Enviado: "${msg.replace(/\n/g, ' ')}"`, 'tag-notif');

      return {
        continue: true,
        nextPort: 'output'
      };
    }

    if (node.type === 'tax-invoice') {
      this.logConsole.addLog('finance', `📜 [NFS-e Fiscal] Recibo fiscal emitido para ${payload.pagador ? payload.pagador.nome : 'Cliente'} no valor de R$ ${payload.valor || 0}`, 'tag-finance');
      return {
        continue: true,
        nextPort: 'output'
      };
    }

    return { continue: true, nextPort: 'output' };
  }

  getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split('.');
    let curr = obj;
    for (const part of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[part];
    }
    return curr;
  }
}
