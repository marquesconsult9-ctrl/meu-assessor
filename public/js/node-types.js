// ==========================================================================
// NODE DEFINITIONS & FINANCIAL WEBHOOK TEMPLATES
// ==========================================================================

const NODE_TYPES = {
  'trigger-webhook': {
    type: 'trigger-webhook',
    category: 'Gatilhos (Triggers)',
    title: 'Gatilho: Webhook',
    subtitle: 'Disparo via requisição HTTP externa',
    icon: '⚡',
    color: '#8b5cf6',
    isTrigger: true,
    hasInput: false,
    hasOutputs: [
      { id: 'output', label: 'Evento Recebido' }
    ],
    defaultConfig: {
      endpointId: 'financeiro-pix',
      httpMethod: 'POST',
      authType: 'bearer',
      secretToken: 'secret_fin_token_2026',
      filterEvent: 'pix.recebido',
      responseStatus: 200,
      responseJson: JSON.stringify({
        status: "received",
        system: "FinFlow Engine",
        processed: true
      }, null, 2)
    }
  },
  'condition': {
    type: 'condition',
    category: 'Lógica & Validação',
    title: 'Condição / Filtro',
    subtitle: 'Filtra por valor, status ou regra',
    icon: '🔀',
    color: '#f59e0b',
    isTrigger: false,
    hasInput: true,
    hasOutputs: [
      { id: 'output-true', label: 'Verdadeiro (Sim)' },
      { id: 'output-false', label: 'Falso (Não)' }
    ],
    defaultConfig: {
      conditionField: 'valor',
      conditionOperator: '>=',
      conditionValue: '50.00'
    }
  },
  'financial-action': {
    type: 'financial-action',
    category: 'Ações Financeiras',
    title: 'Conciliação Financeira',
    subtitle: 'Lança crédito no contas a receber',
    icon: '💰',
    color: '#10b981',
    isTrigger: false,
    hasInput: true,
    hasOutputs: [
      { id: 'output', label: 'Conciliado' }
    ],
    defaultConfig: {
      tipoLancamento: 'RECEITA',
      categoria: 'Vendas Online (Pix)',
      contaBancaria: 'Conta Digital PJ (0001 / 98765-4)',
      autoCompensar: true
    }
  },
  'notification': {
    type: 'notification',
    category: 'Comunicação',
    title: 'Notificação WhatsApp / Slack',
    subtitle: 'Dispara alerta para equipe financeira',
    icon: '💬',
    color: '#3b82f6',
    isTrigger: false,
    hasInput: true,
    hasOutputs: [
      { id: 'output', label: 'Enviado' }
    ],
    defaultConfig: {
      canal: '#financeiro-recebimentos',
      template: '💰 *Novo Pix Confirmado!*\n• Valor: R$ {{payload.valor}}\n• Pagador: {{payload.pagador.nome}}\n• ID Transação: {{payload.endToEndId}}'
    }
  },
  'tax-invoice': {
    type: 'tax-invoice',
    category: 'Fiscal & Compliance',
    title: 'Emitir NFS-e / Recibo',
    subtitle: 'Gera comprovante ou nota fiscal',
    icon: '📜',
    color: '#06b6d4',
    isTrigger: false,
    hasInput: true,
    hasOutputs: [
      { id: 'output', label: 'Emitido' }
    ],
    defaultConfig: {
      modelo: 'NFS-e Municipal',
      aliquotaIss: '2.00%',
      descricaoServico: 'Serviços de consultoria financeira e tecnologia'
    }
  }
};

// PRESET FINANCIAL PAYLOAD TEMPLATES FOR WEBHOOK TESTING
const WEBHOOK_PRESETS = {
  pix: {
    name: '🪙 Pix Instantâneo (Banco Central)',
    event: 'pix.recebido',
    payload: {
      evento: 'pix.recebido',
      endToEndId: 'E00416968202610111530999888',
      txid: 'TXID-FIN-889921',
      valor: 1540.75,
      horario: new Date().toISOString(),
      pagador: {
        nome: 'Maria Eduarda Silva',
        cpf: '***.456.789-**',
        banco: 'Nu Pagamentos S.A.'
      },
      recebedor: {
        nome: 'Minha Empresa Financeira LTDA',
        cnpj: '12.345.678/0001-90',
        chavePix: 'financeiro@empresa.com.br'
      },
      infoAdicional: 'Pagamento de fatura #1092'
    }
  },
  stripe: {
    name: '💳 Stripe Checkout (Cartão Aprovado)',
    event: 'charge.succeeded',
    payload: {
      id: 'ch_3Nxy123456789',
      object: 'charge',
      evento: 'charge.succeeded',
      amount: 48990, // em centavos (R$ 489.90)
      valor: 489.90,
      currency: 'brl',
      status: 'succeeded',
      paid: true,
      customer: {
        id: 'cus_P928374',
        name: 'Carlos Alberto Mendes',
        email: 'carlos.mendes@email.com'
      },
      payment_method_details: {
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          installments: 3
        }
      }
    }
  },
  asaas: {
    name: '📄 Asaas Boleto Bancário (Compensado)',
    event: 'PAYMENT_RECEIVED',
    payload: {
      event: 'PAYMENT_RECEIVED',
      evento: 'PAYMENT_RECEIVED',
      payment: {
        id: 'pay_908127391823',
        customer: 'cus_817263',
        valor: 850.00,
        netValue: 846.51,
        billingType: 'BOLETO',
        status: 'RECEIVED',
        dueDate: '2026-10-15',
        clientPaymentDate: '2026-10-11',
        description: 'Mensalidade Assinatura Plano Enterprise'
      },
      pagador: {
        nome: 'Tech Solutions Consultoria ME',
        cnpj: '98.765.432/0001-11'
      }
    }
  },
  mercadopago: {
    name: '🛍️ Mercado Pago (QR Code Dinâmico)',
    event: 'payment.created',
    payload: {
      action: 'payment.created',
      evento: 'payment.created',
      data: {
        id: '9982736154'
      },
      valor: 320.00,
      status: 'approved',
      status_detail: 'accredited',
      date_approved: new Date().toISOString(),
      transaction_details: {
        net_received_amount: 316.80,
        total_paid_amount: 320.00
      },
      pagador: {
        nome: 'Lucas Ferreira Guimarães',
        email: 'lucas.fg@gmail.com'
      }
    }
  }
};
