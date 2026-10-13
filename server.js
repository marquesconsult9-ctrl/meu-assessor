require('dotenv').config();
const http = require('http');
const fs = require('fs');
const path = require('path');
const dbAdapter = require('./db');
const whatsappService = require('./whatsapp-service');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');

// SSE Clients set
const sseClients = new Set();

function broadcastSSE(type, data) {
  const msg = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(msg);
    } catch (e) {
      sseClients.delete(client);
    }
  }
}

// Format Brazilian Real
function formatBRL(val) {
  return Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Month arithmetic
function addMonthsToYearMonth(yearMonthStr, monthsToAdd) {
  const [y, m] = yearMonthStr.split('-').map(Number);
  const totalMonths = y * 12 + (m - 1) + monthsToAdd;
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, '0')}`;
}

const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

function formatYearMonthPT(yearMonthStr) {
  if (!yearMonthStr) return 'Indefinido';
  const [y, m] = yearMonthStr.split('-').map(Number);
  const monthName = MONTH_NAMES_PT[m - 1] || '';
  return `${monthName} de ${y}`;
}

function getCurrentYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Financial calculations using database adapter
async function calculateFinancials() {
  const db = await dbAdapter.getData();
  const currentYM = getCurrentYearMonth();

  const cardsSummary = (db.cards || []).map(card => {
    const singleCardTxThisMonth = (db.transactions || [])
      .filter(tx => tx.cardId === card.id && tx.type === 'EXPENSE' && !tx.isInstallment && tx.date.startsWith(currentYM))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

    const activeInstForCard = (db.installments || []).filter(inst => inst.cardId === card.id);
    
    const instThisMonth = activeInstForCard
      .filter(inst => currentYM >= inst.startMonth && currentYM <= inst.endMonth)
      .reduce((sum, inst) => sum + (Number(inst.installmentAmount) || 0), 0);

    const currentInvoice = singleCardTxThisMonth + instThisMonth;

    const totalRemainingDebt = activeInstForCard.reduce((sum, inst) => {
      const [curY, curM] = currentYM.split('-').map(Number);
      const [endY, endM] = inst.endMonth.split('-').map(Number);
      const diffMonths = (endY * 12 + endM) - (curY * 12 + curM) + 1;
      const remainingCount = Math.max(0, Math.min(inst.totalInstallments, diffMonths));
      return sum + (remainingCount * (Number(inst.installmentAmount) || 0));
    }, 0);

    const limitUsed = Math.min(card.limitTotal, singleCardTxThisMonth + totalRemainingDebt);
    const limitAvailable = Math.max(0, card.limitTotal - limitUsed);
    const usedPercentage = card.limitTotal > 0 ? Math.round((limitUsed / card.limitTotal) * 100) : 0;

    return {
      ...card,
      currentInvoice,
      singleCardTxThisMonth,
      instThisMonth,
      limitUsed,
      limitAvailable,
      usedPercentage,
      activeInstallmentsCount: activeInstForCard.length
    };
  });

  const projectionMonths = [];
  let latestEndMonth = currentYM;

  for (let i = 0; i < 18; i++) {
    const targetYM = addMonthsToYearMonth(currentYM, i);
    const itemsInMonth = [];
    let monthTotal = 0;

    if (i === 0) {
      const singlePurchasesTotal = (db.transactions || [])
        .filter(tx => tx.cardId && tx.type === 'EXPENSE' && !tx.isInstallment && tx.date.startsWith(currentYM))
        .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

      if (singlePurchasesTotal > 0) {
        itemsInMonth.push({
          description: 'Compras Avulsas do Mês',
          amount: singlePurchasesTotal,
          cardName: 'Diversos'
        });
        monthTotal += singlePurchasesTotal;
      }
    }

    (db.installments || []).forEach(inst => {
      if (targetYM >= inst.startMonth && targetYM <= inst.endMonth) {
        const card = db.cards.find(c => c.id === inst.cardId);
        const [sY, sM] = inst.startMonth.split('-').map(Number);
        const [tY, tM] = targetYM.split('-').map(Number);
        const installmentNum = (tY * 12 + tM) - (sY * 12 + sM) + 1;

        itemsInMonth.push({
          id: inst.id,
          description: inst.description,
          installmentNum: installmentNum,
          totalInstallments: inst.totalInstallments,
          amount: inst.installmentAmount,
          cardName: card ? card.name : 'Cartão',
          cardId: inst.cardId
        });
        monthTotal += inst.installmentAmount;

        if (inst.endMonth > latestEndMonth) {
          latestEndMonth = inst.endMonth;
        }
      }
    });

    projectionMonths.push({
      yearMonth: targetYM,
      monthLabel: formatYearMonthPT(targetYM),
      shortLabel: targetYM.split('-')[1] + '/' + targetYM.split('-')[0].slice(2),
      total: monthTotal,
      items: itemsInMonth
    });
  }

  const [curY, curM] = currentYM.split('-').map(Number);
  const [endY, endM] = latestEndMonth.split('-').map(Number);
  const monthsUntilFree = Math.max(0, (endY * 12 + endM) - (curY * 12 + curM) + 1);

  const totalInvoicesCurrent = cardsSummary.reduce((sum, c) => sum + c.currentInvoice, 0);
  const totalCardsLimit = cardsSummary.reduce((sum, c) => sum + c.limitTotal, 0);
  const totalLimitUsed = cardsSummary.reduce((sum, c) => sum + c.limitUsed, 0);
  const totalLimitAvailable = Math.max(0, totalCardsLimit - totalLimitUsed);

  const currentMonthTransactions = (db.transactions || []).filter(tx => tx.date.startsWith(currentYM));
  const currentMonthIncome = currentMonthTransactions
    .filter(tx => tx.type === 'INCOME')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  const currentMonthExpenses = currentMonthTransactions
    .filter(tx => tx.type === 'EXPENSE')
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  // Dynamic budget spent amounts calculation
  const budgetsWithSpent = (db.budgets || []).map(b => {
    const txSpent = currentMonthTransactions
      .filter(tx => tx.type === 'EXPENSE' && tx.category && tx.category.toLowerCase().includes(b.category.toLowerCase()))
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    const spent = txSpent > 0 ? txSpent : (b.spentAmount || 0);
    const percentage = b.monthlyLimit > 0 ? Math.min(100, Math.round((spent / b.monthlyLimit) * 100)) : 0;
    return {
      ...b,
      spentAmount: spent,
      percentage
    };
  });

  return {
    accountBalance: Number(db.accountBalance || 0),
    emergencyReserve: Number(db.emergencyReserve != null ? db.emergencyReserve : 0),
    investmentsBalance: Number(db.investmentsBalance != null ? db.investmentsBalance : 0),
    settings: db.settings || {},
    currentMonthIncome,
    currentMonthExpenses,
    totalInvoicesCurrent,
    totalCardsLimit,
    totalLimitUsed,
    totalLimitAvailable,
    cards: cardsSummary,
    budgets: budgetsWithSpent,
    goals: db.goals || [],
    bills: db.bills || [],
    isUsingSupabase: dbAdapter.isSupabaseConfigured(),
    projection: {
      months: projectionMonths,
      finishMonth: latestEndMonth,
      finishMonthFormatted: formatYearMonthPT(latestEndMonth),
      monthsUntilFree,
      hasActiveInstallments: (db.installments || []).length > 0
    }
  };
}

// Natural Language Parser
async function parseWhatsAppMessage(rawText) {
  const db = await dbAdapter.getData();
  const text = (rawText || '').trim();
  const lower = text.toLowerCase();
  const currentYM = getCurrentYearMonth();

  // 0. GUARD: Ignorar anúncios, links, cupons e mensagens promocionais de grupos/lojas
  if (
    lower.includes('http://') ||
    lower.includes('https://') ||
    lower.includes('meli.la') ||
    lower.includes('cupom') ||
    lower.includes('compre aqui') ||
    lower.includes('anúncio') ||
    lower.includes('anuncio') ||
    lower.includes('oferta') ||
    lower.includes('promodehoje') ||
    lower.includes('promoção') ||
    lower.includes('promocao') ||
    lower.includes('estoque variam')
  ) {
    return {
      reply: '⚠️ Mensagem promocional ou link ignorado para registros financeiros.',
      action: 'IGNORED_PROMO'
    };
  }

  // 1. QUERY: Projeção de quando acaba a fatura
  if (
    lower.includes('quando acabo') ||
    lower.includes('quando acaba') ||
    lower.includes('projeção') ||
    lower.includes('projecao') ||
    lower.includes('termino da fatura') ||
    lower.includes('término') ||
    lower.includes('acabar a fatura') ||
    lower.includes('parcelamento') ||
    lower.includes('parcelas')
  ) {
    const fin = await calculateFinancials();
    if (!fin.projection.hasActiveInstallments) {
      return {
        reply: `🎉 *Você não possui compras parceladas ativas!*\n\nTodas as suas faturas estão livres de parcelamentos futuros.`,
        action: 'QUERY_PROJECTION'
      };
    }

    let itemsList = '';
    (db.installments || []).forEach(inst => {
      const card = db.cards.find(c => c.id === inst.cardId);
      const [curY, curM] = currentYM.split('-').map(Number);
      const [endY, endM] = inst.endMonth.split('-').map(Number);
      const remaining = Math.max(1, (endY * 12 + endM) - (curY * 12 + curM) + 1);
      itemsList += `• *${inst.description}* (${card ? card.name : 'Cartão'}): ${formatBRL(inst.installmentAmount)}/mês — faltam *${remaining} parcelas* (termina em *${formatYearMonthPT(inst.endMonth)}*)\n`;
    });

    return {
      reply: `📊 *Projeção de Quitação das suas Faturas:*\n\n${itemsList}\n🏁 *Previsão de Término Final*: **${fin.projection.finishMonthFormatted}** (daqui a ${fin.projection.monthsUntilFree} meses).\n\n💡 *Impacto*: A partir de ${fin.projection.finishMonthFormatted}, suas parcelas zeram e **${formatBRL(fin.totalLimitUsed)}** de limite estará 100% livre!`,
      action: 'QUERY_PROJECTION'
    };
  }

  // 2. QUERY: Fatura e Limite do Cartão
  if (
    lower.includes('fatura') ||
    lower.includes('limite') ||
    lower.includes('cartao') ||
    lower.includes('cartão') ||
    lower.includes('cartões')
  ) {
    const fin = await calculateFinancials();
    let cardsText = '';
    fin.cards.forEach(c => {
      cardsText += `💳 *${c.name}* (final ${c.last4})\n` +
                   `• Fatura Atual: *${formatBRL(c.currentInvoice)}*\n` +
                   `• Limite Usado: ${formatBRL(c.limitUsed)} de ${formatBRL(c.limitTotal)} (${c.usedPercentage}%)\n` +
                   `• Limite Disponível: *${formatBRL(c.limitAvailable)}*\n` +
                   `• Fechamento: dia ${c.closingDay} | Vencimento: dia ${c.dueDay}\n\n`;
    });

    return {
      reply: `📋 *Resumo dos seus Cartões & Faturas:*\n\n${cardsText}🎯 *Total das Faturas Abertas*: **${formatBRL(fin.totalInvoicesCurrent)}**\n🏁 *Término dos parcelamentos*: **${fin.projection.finishMonthFormatted}**`,
      action: 'QUERY_CARDS'
    };
  }

  // 3. QUERY: Saldo e Resumo Geral
  if (
    lower === 'saldo' ||
    lower.includes('qual meu saldo') ||
    lower.includes('extrato') ||
    lower.includes('resumo') ||
    lower.includes('quanto tenho') ||
    lower.includes('quanto gastei')
  ) {
    const fin = await calculateFinancials();
    return {
      reply: `💰 *Resumo Financeiro Geral:*\n\n• Saldo em Conta: *${formatBRL(fin.accountBalance)}*\n• Receitas este mês: *+${formatBRL(fin.currentMonthIncome)}*\n• Despesas este mês: *-${formatBRL(fin.currentMonthExpenses)}*\n• Faturas de Cartão abertas: *${formatBRL(fin.totalInvoicesCurrent)}*\n• Limite livre nos cartões: *${formatBRL(fin.totalLimitAvailable)}*`,
      action: 'QUERY_BALANCE'
    };
  }

  // 4. TRANSACTION: Compra Parcelada (ex: "comprei celular 2400 em 10x no nubank")
  const installmentRegex = /(?:comprei\s+(?:um|uma)?\s*)?([a-zA-ZÀ-ÿ0-9\s'-]+?)\s+(?:de\s+|por\s+)?(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:em\s+|de\s+|parcelado\s+em\s+)?(\d+)\s*x(?:\s*(?:no|pelo|cart[aã]o)?\s*(.*))?/i;
  const matchInst = text.match(installmentRegex);

  if (matchInst && Number(matchInst[3]) > 1) {
    const desc = matchInst[1].replace(/^(comprei|gastei)\s+/i, '').trim();
    const rawTotal = matchInst[2].replace('.', '').replace(',', '.');
    const totalAmount = parseFloat(rawTotal);
    const numInstallments = parseInt(matchInst[3], 10);
    const cardQuery = (matchInst[4] || '').toLowerCase();

    if (!isNaN(totalAmount) && totalAmount > 0 && numInstallments > 1 && desc.length >= 2) {
      let selectedCard = db.cards[0] || { id: 'card-default', name: 'Cartão de Crédito', limitTotal: 5000 };
      if (cardQuery && db.cards.length > 0) {
        const found = db.cards.find(c => c.name.toLowerCase().includes(cardQuery) || cardQuery.includes(c.name.toLowerCase()));
        if (found) selectedCard = found;
      }

      const installmentAmount = Math.round((totalAmount / numInstallments) * 100) / 100;
      const startMonth = currentYM;
      const endMonth = addMonthsToYearMonth(currentYM, numInstallments - 1);

      let category = 'Compras & Parcelamentos';
      const descLower = desc.toLowerCase();
      if (descLower.includes('notebook') || descLower.includes('celular') || descLower.includes('iphone') || descLower.includes('tv') || descLower.includes('computador')) {
        category = 'Eletrônicos & Trabalho';
      } else if (descLower.includes('geladeira') || descLower.includes('fogao') || descLower.includes('cama') || descLower.includes('sofa')) {
        category = 'Casa & Eletrodomésticos';
      } else if (descLower.includes('passagem') || descLower.includes('viagem') || descLower.includes('hotel')) {
        category = 'Viagem & Lazer';
      }

      const newInstallment = {
        id: 'inst-' + Date.now().toString(36),
        cardId: selectedCard.id,
        description: desc.charAt(0).toUpperCase() + desc.slice(1),
        category: category,
        totalAmount: totalAmount,
        installmentAmount: installmentAmount,
        totalInstallments: numInstallments,
        currentInstallment: 1,
        startMonth: startMonth,
        endMonth: endMonth
      };

      await dbAdapter.addInstallment(newInstallment);

      const newTx = {
        id: 'tx-' + Date.now().toString(36),
        description: `${newInstallment.description} (1/${numInstallments})`,
        type: 'EXPENSE',
        amount: installmentAmount,
        category: category,
        paymentMethod: 'CREDIT_CARD',
        cardId: selectedCard.id,
        isInstallment: true,
        installmentId: newInstallment.id,
        date: new Date().toISOString(),
        source: 'WHATSAPP'
      };
      await dbAdapter.addTransaction(newTx);

      const fin = await calculateFinancials();
      const updatedCard = fin.cards.find(c => c.id === selectedCard.id) || selectedCard;

      return {
        reply: `✅ *Compra Parcelada Registrada!*\n\n` +
               `🛍️ *Item*: ${newInstallment.description}\n` +
               `💳 *Cartão*: ${selectedCard.name}\n` +
               `💰 *Valor Total*: ${formatBRL(totalAmount)} em *${numInstallments}x de ${formatBRL(installmentAmount)}*\n` +
               `🧾 *Parcela 1/${numInstallments}*: adicionada à fatura atual\n` +
               `🏁 *Previsão de Quitação*: **${formatYearMonthPT(endMonth)}**\n\n` +
               `📊 *Status do Cartão*: Fatura em *${formatBRL(updatedCard.currentInvoice)}* e Limite livre: *${formatBRL(updatedCard.limitAvailable)}*.`,
        action: 'ADD_INSTALLMENT',
        data: { installment: newInstallment, transaction: newTx }
      };
    }
  }

  // 5. TRANSACTION: Receita (ex: "recebi 4200 de salário", "ganhei 350 de freela")
  const incomeRegex = /^(?:recebi|ganhei|sal[aá]rio|freela|dep[oó]sito|deposito|renda|entrada)\s*(?:de\s+|no valor de\s+)?(?:r\$\s*)?(\d+(?:[.,]\d+)?)(?:\s*(?:de|com|do)?\s*(.*))?$/i;
  const matchIncome = text.match(incomeRegex);

  if (matchIncome) {
    const rawVal = matchIncome[1].replace('.', '').replace(',', '.');
    const val = parseFloat(rawVal);
    const extraDesc = (matchIncome[2] || '').trim();

    if (!isNaN(val) && val > 0) {
      let desc = 'Receita Recebida';
      if (extraDesc) desc = extraDesc.charAt(0).toUpperCase() + extraDesc.slice(1);
      else if (lower.includes('salario') || lower.includes('salário')) desc = 'Salário';
      else if (lower.includes('freela')) desc = 'Freela / Serviços';

      const newTx = {
        id: 'tx-' + Date.now().toString(36),
        description: desc,
        type: 'INCOME',
        amount: val,
        category: 'Renda & Salário',
        paymentMethod: 'PIX',
        cardId: null,
        date: new Date().toISOString(),
        source: 'WHATSAPP'
      };

      await dbAdapter.updateBalance(db.accountBalance + val);
      await dbAdapter.addTransaction(newTx);

      return {
        reply: `💵 *Receita Registrada!*\n\n• Descrição: ${newTx.description}\n• Valor: *+${formatBRL(val)}*\n• Saldo em Conta Atualizado: *${formatBRL(db.accountBalance + val)}*`,
        action: 'ADD_INCOME',
        data: newTx
      };
    }
  }

  // 6. TRANSACTION: Despesa Avulsa (Reconhecimento Estrito com Validação)
  let parsedDesc = null;
  let parsedAmount = 0;
  let parsedMethod = 'DEBIT';
  let paymentDetail = '';
  let selectedCardId = null;

  // Padrão A: Verbo + Valor + Descrição (ex: "gastei 50 no mercado", "paguei 80 de luz", "comprei tenis de 200")
  const matchVerbExpense = text.match(/^(?:gastei|paguei|comprei|despesa|gasto)\s+(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s*(?:com|em|de|no|na)?\s*(.*)$/i);
  // Padrão B: Item + Valor (ex: "almoço 35", "uber 22 no pix", "mercado 150 no credito", "padaria 18,50")
  const matchItemAmount = text.match(/^([a-zA-ZÀ-ÿ0-9\s'-]{2,25})\s+(?:de\s+|por\s+)?(?:r\$\s*)?(\d+(?:[.,]\d+)?)(?:\s*(.*))?$/i);
  // Padrão C: Valor + Item (ex: "50 no uber", "R$ 35 de almoço", "120 no mercado")
  const matchAmountItem = text.match(/^(?:r\$\s*)?(\d+(?:[.,]\d+)?)\s+(?:no|na|com|em|de|para)\s+([a-zA-ZÀ-ÿ0-9\s'-]{2,25})(?:\s*(.*))?$/i);

  if (matchVerbExpense) {
    parsedAmount = parseFloat(matchVerbExpense[1].replace('.', '').replace(',', '.'));
    parsedDesc = (matchVerbExpense[2] || 'Despesa').trim();
    paymentDetail = parsedDesc.toLowerCase();
  } else if (matchItemAmount) {
    parsedDesc = matchItemAmount[1].trim();
    parsedAmount = parseFloat(matchItemAmount[2].replace('.', '').replace(',', '.'));
    paymentDetail = (matchItemAmount[3] || '').trim().toLowerCase();
  } else if (matchAmountItem) {
    parsedAmount = parseFloat(matchAmountItem[1].replace('.', '').replace(',', '.'));
    parsedDesc = matchAmountItem[2].trim();
    paymentDetail = (matchAmountItem[3] || '').trim().toLowerCase();
  }

  // Validação: só cria despesa se houver descrição válida e valor positivo
  if (parsedDesc && !isNaN(parsedAmount) && parsedAmount > 0) {
    if (
      paymentDetail.includes('credito') || 
      paymentDetail.includes('crédito') || 
      paymentDetail.includes('nubank') || 
      paymentDetail.includes('inter') ||
      paymentDetail.includes('cartao') ||
      paymentDetail.includes('cartão')
    ) {
      parsedMethod = 'CREDIT_CARD';
      const card = db.cards.find(c => paymentDetail.includes(c.name.toLowerCase()));
      selectedCardId = card ? card.id : (db.cards[0] ? db.cards[0].id : null);
    } else if (paymentDetail.includes('pix')) {
      parsedMethod = 'PIX';
    } else if (paymentDetail.includes('dinheiro')) {
      parsedMethod = 'CASH';
    } else {
      parsedMethod = 'DEBIT';
    }

    let category = 'Outros';
    const dLower = parsedDesc.toLowerCase();
    if (dLower.includes('almoço') || dLower.includes('almoco') || dLower.includes('jantar') || dLower.includes('lanche') || dLower.includes('restaurante') || dLower.includes('ifood') || dLower.includes('cafe') || dLower.includes('café')) {
      category = 'Alimentação';
    } else if (dLower.includes('mercado') || dLower.includes('feira') || dLower.includes('supermercado') || dLower.includes('padaria') || dLower.includes('acougue') || dLower.includes('açougue')) {
      category = 'Mercado';
    } else if (dLower.includes('uber') || dLower.includes('gasolina') || dLower.includes('combustivel') || dLower.includes('posto') || dLower.includes('99')) {
      category = 'Transporte';
    } else if (dLower.includes('farmacia') || dLower.includes('farmácia') || dLower.includes('remedio') || dLower.includes('remédio')) {
      category = 'Saúde';
    } else if (dLower.includes('luz') || dLower.includes('agua') || dLower.includes('água') || dLower.includes('internet') || dLower.includes('energia')) {
      category = 'Moradia & Contas';
    }

    const newTx = {
      id: 'tx-' + Date.now().toString(36),
      description: parsedDesc.charAt(0).toUpperCase() + parsedDesc.slice(1),
      type: 'EXPENSE',
      amount: parsedAmount,
      category: category,
      paymentMethod: parsedMethod,
      cardId: selectedCardId,
      isInstallment: false,
      date: new Date().toISOString(),
      source: 'WHATSAPP'
    };

    if (parsedMethod !== 'CREDIT_CARD') {
      await dbAdapter.updateBalance(Math.max(0, db.accountBalance - parsedAmount));
    }
    await dbAdapter.addTransaction(newTx);

    const fin = await calculateFinancials();
    let methodFeedback = '';
    if (parsedMethod === 'CREDIT_CARD') {
      const card = db.cards.find(c => c.id === selectedCardId);
      methodFeedback = `• Cartão: ${card ? card.name : 'Cartão de Crédito'}\n• Fatura: *${formatBRL(card ? card.currentInvoice : 0)}*`;
    } else {
      methodFeedback = `• Saldo em Conta: *${formatBRL(fin.accountBalance)}*`;
    }

    return {
      reply: `✅ *Despesa Registrada!*\n\n• Descrição: ${newTx.description}\n• Valor: *-${formatBRL(parsedAmount)}*\n• Categoria: 🏷️ ${category}\n${methodFeedback}`,
      action: 'ADD_EXPENSE',
      data: newTx
    };
  }

  return {
    reply: `👋 Olá! Sou o seu assessor financeiro. Você pode me mandar:\n\n` +
           `• *\"Almoço 35 no débito\"*\n` +
           `• *\"Uber 25 no pix\"*\n` +
           `• *\"Comprei Celular 2400 em 10x no nubank\"*\n` +
           `• *\"Recebi 4200 de salário\"*\n` +
           `• *\"fatura\"* ou *\"limite\"*\n` +
           `• *\"quando acabo a fatura\"*\n` +
           `• *\"saldo\"*`,
    action: 'HELP'
  };
}

// Request Body Parser helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) reject(new Error('Payload too large'));
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({ rawBody: body });
      }
    });
    req.on('error', reject);
  });
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// HTTP Server
const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Auth API: Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { username, password } = body;
      const isValid = await dbAdapter.verifyAuth(username, password);
      if (isValid) {
        const profile = await dbAdapter.getUserProfile();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          user: {
            name: profile.name || 'Marques',
            username: username || profile.username || 'admin',
            role: profile.role || 'Administrador',
            email: profile.email || 'admin@lancei.com.br'
          },
          token: 'auth-' + Date.now().toString(36)
        }));
      } else {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Credenciais inválidas. Verifique seu usuário e senha.' }));
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // Auth API: Change Password
  if (pathname === '/api/auth/change-password' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const { currentPassword, newPassword } = body;
      await dbAdapter.changePassword(currentPassword, newPassword);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Senha atualizada com sucesso!' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // User Profile API: GET & POST
  if (pathname === '/api/user/profile' && req.method === 'GET') {
    try {
      const profile = await dbAdapter.getUserProfile();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, profile }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  if (pathname === '/api/user/profile' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const updated = await dbAdapter.updateUserProfile(body);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, profile: updated, message: 'Perfil atualizado com sucesso!' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // Health check / Keep-Alive route (UptimeRobot / Cron)
  if (pathname === '/health' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // 1. SSE Stream: /api/events
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });
    res.write('retry: 4000\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // Database status: /api/database/status
  if (pathname === '/api/database/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      isSupabase: dbAdapter.isSupabaseConfigured()
    }));
    return;
  }

  // 2. Financial Summary API: /api/financial/summary
  if (pathname === '/api/financial/summary' && req.method === 'GET') {
    const fin = await calculateFinancials();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: fin }));
    return;
  }

  // 3. Invoice Projection API: /api/invoices/projection
  if (pathname === '/api/invoices/projection' && req.method === 'GET') {
    const fin = await calculateFinancials();
    const db = await dbAdapter.getData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      projection: fin.projection,
      cards: fin.cards,
      installments: db.installments || []
    }));
    return;
  }

  // 4. Cards API: /api/cards
  if (pathname === '/api/cards') {
    if (req.method === 'GET') {
      const fin = await calculateFinancials();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, cards: fin.cards }));
      return;
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const newCard = {
          id: 'card-' + Date.now().toString(36),
          name: body.name || 'Novo Cartão',
          brand: body.brand || 'Mastercard',
          last4: body.last4 || '0000',
          color: body.color || 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
          limitTotal: parseFloat(body.limitTotal) || 5000.00,
          closingDay: parseInt(body.closingDay, 10) || 20,
          dueDay: parseInt(body.dueDay, 10) || 28
        };
        await dbAdapter.addCard(newCard);
        const updatedFin = await calculateFinancials();
        broadcastSSE('financial-updated', updatedFin);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, card: newCard }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // 5. Installments API: /api/installments
  if (pathname === '/api/installments' && req.method === 'GET') {
    const db = await dbAdapter.getData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, installments: db.installments || [] }));
    return;
  }

  // 6. Transactions API: /api/transactions
  if (pathname === '/api/transactions') {
    if (req.method === 'GET') {
      const db = await dbAdapter.getData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, transactions: db.transactions || [] }));
      return;
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const amount = parseFloat(body.amount) || 0;
        const newTx = {
          id: 'tx-' + Date.now().toString(36),
          description: body.description || 'Lançamento Manual',
          type: body.type === 'INCOME' ? 'INCOME' : 'EXPENSE',
          amount: amount,
          category: body.category || 'Geral',
          paymentMethod: body.paymentMethod || 'PIX',
          cardId: body.cardId || null,
          isInstallment: false,
          date: body.date || new Date().toISOString(),
          source: 'WEB'
        };

        const db = await dbAdapter.getData();
        if (newTx.type === 'INCOME') {
          await dbAdapter.updateBalance(db.accountBalance + amount);
        } else if (newTx.paymentMethod !== 'CREDIT_CARD') {
          await dbAdapter.updateBalance(Math.max(0, db.accountBalance - amount));
        }

        await dbAdapter.addTransaction(newTx);
        const updatedFin = await calculateFinancials();
        broadcastSSE('financial-updated', updatedFin);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, transaction: newTx }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/transactions/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/transactions/', '');
    await dbAdapter.deleteTransaction(id);
    const updatedFin = await calculateFinancials();
    broadcastSSE('financial-updated', updatedFin);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Transação removida' }));
    return;
  }

  // =========================================================================
  // BUDGETS API: /api/budgets
  // =========================================================================
  if (pathname === '/api/budgets') {
    if (req.method === 'GET') {
      const fin = await calculateFinancials();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, budgets: fin.budgets }));
      return;
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const newBudget = {
          id: 'orc-' + Date.now().toString(36),
          category: body.category || 'Geral',
          monthlyLimit: parseFloat(body.monthlyLimit) || 1000.00,
          spentAmount: parseFloat(body.spentAmount) || 0.00
        };
        await dbAdapter.addBudget(newBudget);
        const updatedFin = await calculateFinancials();
        broadcastSSE('financial-updated', updatedFin);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, budget: newBudget }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/budgets/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/budgets/', '');
    await dbAdapter.deleteBudget(id);
    const updatedFin = await calculateFinancials();
    broadcastSSE('financial-updated', updatedFin);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Orçamento removido' }));
    return;
  }

  // =========================================================================
  // GOALS API: /api/goals
  // =========================================================================
  if (pathname === '/api/goals') {
    if (req.method === 'GET') {
      const db = await dbAdapter.getData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, goals: db.goals || [] }));
      return;
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const newGoal = {
          id: 'goal-' + Date.now().toString(36),
          title: body.title || 'Nova Meta',
          targetAmount: parseFloat(body.targetAmount) || 10000.00,
          currentAmount: parseFloat(body.currentAmount) || 0.00,
          deadlineDate: body.deadlineDate || null
        };
        await dbAdapter.addGoal(newGoal);
        const updatedFin = await calculateFinancials();
        broadcastSSE('financial-updated', updatedFin);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, goal: newGoal }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/goals/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/goals/', '');
    await dbAdapter.deleteGoal(id);
    const updatedFin = await calculateFinancials();
    broadcastSSE('financial-updated', updatedFin);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Meta removida' }));
    return;
  }

  // =========================================================================
  // BILLS API: /api/bills
  // =========================================================================
  if (pathname === '/api/bills') {
    if (req.method === 'GET') {
      const db = await dbAdapter.getData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, bills: db.bills || [] }));
      return;
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const newBill = {
          id: 'bill-' + Date.now().toString(36),
          description: body.description || 'Novo Título',
          amount: parseFloat(body.amount) || 0,
          dueDate: body.dueDate || new Date().toISOString().slice(0, 10),
          type: body.type === 'RECEIVE' ? 'RECEIVE' : 'PAY',
          isPaid: Boolean(body.isPaid)
        };
        await dbAdapter.addBill(newBill);
        const updatedFin = await calculateFinancials();
        broadcastSSE('financial-updated', updatedFin);
        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, bill: newBill }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  if (pathname.startsWith('/api/bills/') && pathname.endsWith('/toggle') && req.method === 'PATCH') {
    try {
      const id = pathname.replace('/api/bills/', '').replace('/toggle', '');
      const body = await parseBody(req);
      await dbAdapter.toggleBill(id, body.isPaid);
      const updatedFin = await calculateFinancials();
      broadcastSSE('financial-updated', updatedFin);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Status alterado' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (pathname === '/api/bills/pay-all' && req.method === 'POST') {
    await dbAdapter.payAllBills();
    const updatedFin = await calculateFinancials();
    broadcastSSE('financial-updated', updatedFin);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Todas as contas pagas' }));
    return;
  }

  if (pathname === '/api/bills/receive-all' && req.method === 'POST') {
    await dbAdapter.receiveAllBills();
    const updatedFin = await calculateFinancials();
    broadcastSSE('financial-updated', updatedFin);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Todas as receitas conciliadas' }));
    return;
  }

  if (pathname.startsWith('/api/bills/') && req.method === 'DELETE') {
    const id = pathname.replace('/api/bills/', '');
    await dbAdapter.deleteBill(id);
    const updatedFin = await calculateFinancials();
    broadcastSSE('financial-updated', updatedFin);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Conta removida' }));
    return;
  }

  // =========================================================================
  // CARD INVOICE SETTLEMENT: /api/cards/:id/pay-invoice
  // =========================================================================
  if (pathname.startsWith('/api/cards/') && pathname.endsWith('/pay-invoice') && req.method === 'POST') {
    try {
      const cardId = pathname.replace('/api/cards/', '').replace('/pay-invoice', '');
      const fin = await calculateFinancials();
      const card = fin.cards.find(c => c.id === cardId);
      if (!card) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Cartão não encontrado' }));
      }

      const invoiceAmount = card.currentInvoice || 0;
      if (invoiceAmount > 0) {
        // Register payment transaction
        const payTx = {
          id: 'tx-pay-inv-' + Date.now().toString(36),
          description: `Pagamento Fatura ${card.name}`,
          type: 'EXPENSE',
          amount: invoiceAmount,
          category: 'Faturas & Cartões',
          paymentMethod: 'DEBIT',
          cardId: null,
          isInstallment: false,
          date: new Date().toISOString(),
          source: 'WEB'
        };

        const db = await dbAdapter.getData();
        await dbAdapter.updateBalance(Math.max(0, db.accountBalance - invoiceAmount));
        await dbAdapter.addTransaction(payTx);
      }

      const updatedFin = await calculateFinancials();
      broadcastSSE('financial-updated', updatedFin);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: `Fatura de ${formatBRL(invoiceAmount)} liquidada com sucesso!` }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // =========================================================================
  // SETTINGS API: /api/settings
  // =========================================================================
  if (pathname === '/api/settings') {
    if (req.method === 'GET') {
      const db = await dbAdapter.getData();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, settings: db.settings }));
      return;
    }
    if (req.method === 'POST') {
      try {
        const body = await parseBody(req);
        const updated = await dbAdapter.updateSettings(body);
        const updatedFin = await calculateFinancials();
        broadcastSSE('financial-updated', updatedFin);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, settings: updated }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
      return;
    }
  }

  // 7. Chat API: /api/chat/message
  if (pathname === '/api/chat/message' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const text = body.message || '';
      if (!text.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Mensagem vazia' }));
      }

      const userMsg = {
        id: 'msg-' + Date.now().toString(36) + '-u',
        sender: 'user',
        text: text,
        timestamp: new Date().toISOString()
      };
      await dbAdapter.addChatMessage(userMsg);

      const parseResult = await parseWhatsAppMessage(text);

      const assistantMsg = {
        id: 'msg-' + Date.now().toString(36) + '-a',
        sender: 'assistant',
        text: parseResult.reply,
        timestamp: new Date().toISOString()
      };
      await dbAdapter.addChatMessage(assistantMsg);

      const updatedFinancials = await calculateFinancials();
      broadcastSSE('financial-updated', updatedFinancials);
      broadcastSSE('chat-message', { user: userMsg, assistant: assistantMsg });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        reply: assistantMsg.text,
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        financials: updatedFinancials
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 8. Chat History: /api/chat/messages
  if (pathname === '/api/chat/messages' && req.method === 'GET') {
    const db = await dbAdapter.getData();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, messages: db.chatHistory || [] }));
    return;
  }

  // 9. WhatsApp Status API
  if (pathname === '/api/whatsapp/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, ...whatsappService.getWhatsAppStatus() }));
    return;
  }

  if (pathname === '/api/whatsapp/connect' && req.method === 'POST') {
    startWhatsAppBot();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Iniciando conexão com WhatsApp' }));
    return;
  }

  if (pathname === '/api/whatsapp/logout' && req.method === 'POST') {
    await whatsappService.logoutWhatsApp();
    broadcastSSE('whatsapp-status-changed', whatsappService.getWhatsAppStatus());
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Sessão WhatsApp desconectada' }));
    return;
  }

  // 10. Fallback Webhook API
  if (pathname === '/api/webhook/whatsapp' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      let incomingText = body.message || (body.text && body.text.message) || '';
      let senderPhone = body.phone || 'WhatsApp';

      if (incomingText) {
        const userMsg = {
          id: 'msg-' + Date.now().toString(36) + '-u',
          sender: 'user',
          text: incomingText,
          phone: senderPhone,
          timestamp: new Date().toISOString()
        };
        await dbAdapter.addChatMessage(userMsg);

        const parseResult = await parseWhatsAppMessage(incomingText);

        const assistantMsg = {
          id: 'msg-' + Date.now().toString(36) + '-a',
          sender: 'assistant',
          text: parseResult.reply,
          timestamp: new Date().toISOString()
        };
        await dbAdapter.addChatMessage(assistantMsg);

        const updatedFin = await calculateFinancials();
        broadcastSSE('financial-updated', updatedFin);
        broadcastSSE('chat-message', { user: userMsg, assistant: assistantMsg });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, responseMessage: parseResult.reply }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
      }
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Static files
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Acesso Negado');
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      const fallbackIndex = path.join(PUBLIC_DIR, 'index.html');
      if (fs.existsSync(fallbackIndex)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(fallbackIndex).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Não encontrado');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });
});

function startWhatsAppBot() {
  whatsappService.connectToWhatsApp(
    async (text, senderJid, isFromMe) => {
      const parseResult = await parseWhatsAppMessage(text);
      if (parseResult.action === 'IGNORED_PROMO') {
        return null;
      }

      const userMsg = {
        id: 'msg-' + Date.now().toString(36) + '-u',
        sender: 'user',
        text: text,
        phone: senderJid,
        timestamp: new Date().toISOString()
      };
      await dbAdapter.addChatMessage(userMsg);

      const assistantMsg = {
        id: 'msg-' + Date.now().toString(36) + '-a',
        sender: 'assistant',
        text: parseResult.reply,
        timestamp: new Date().toISOString()
      };
      await dbAdapter.addChatMessage(assistantMsg);

      const updatedFin = await calculateFinancials();
      broadcastSSE('financial-updated', updatedFin);
      broadcastSSE('chat-message', { user: userMsg, assistant: assistantMsg });

      return parseResult.reply;
    },
    (statusObj) => {
      broadcastSSE('whatsapp-status-changed', statusObj);
    }
  );
}

server.listen(PORT, () => {
  console.log(`[Meu Assessor Financeiro] Rodando em: http://localhost:${PORT}`);
  console.log(`[Database] Modo: ${dbAdapter.isSupabaseConfigured() ? 'Supabase Nuvem' : 'Local (JSON)'}`);

  if (whatsappService.hasSavedSession()) {
    console.log('[WhatsApp Service] Sessão salva detectada. Conectando automaticamente...');
    startWhatsAppBot();
  }
});
