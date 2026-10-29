const fs = require('fs');
const path = require('path');
const db = require('../db');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = (SUPABASE_URL && SUPABASE_KEY) ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

// 1. CARDS DEFINITIONS
const CARDS_TO_ENSURE = [
  {
    id: 'card-mercado',
    name: 'Cartão Mercado Pago',
    brand: 'Visa',
    last4: '1024',
    color: 'linear-gradient(135deg, #009ee3 0%, #007eb5 100%)',
    limitTotal: 5000.00,
    closingDay: 20,
    dueDay: 28
  },
  {
    id: 'card-picpay',
    name: 'Cartão PicPay Card',
    brand: 'Mastercard',
    last4: '4912',
    color: 'linear-gradient(135deg, #11c76f 0%, #0b8043 100%)',
    limitTotal: 6000.00,
    closingDay: 18,
    dueDay: 25
  },
  {
    id: 'card-inter',
    name: 'Cartão Inter',
    brand: 'Mastercard',
    last4: '3190',
    color: 'linear-gradient(135deg, #ff7a00 0%, #b84f00 100%)',
    limitTotal: 12000.00,
    closingDay: 15,
    dueDay: 22
  },
  {
    id: 'card-neon',
    name: 'Cartão Neon',
    brand: 'Visa',
    last4: '7733',
    color: 'linear-gradient(135deg, #00e5ff 0%, #0099cc 100%)',
    limitTotal: 4000.00,
    closingDay: 12,
    dueDay: 20
  },
  {
    id: 'card-nubank-grazy',
    name: 'Cartão Nubank (Grazy)',
    brand: 'Mastercard',
    last4: '5678',
    color: 'linear-gradient(135deg, #a855f7 0%, #7e22ce 100%)',
    limitTotal: 5000.00,
    closingDay: 7,
    dueDay: 14
  },
  {
    id: 'card-nubank',
    name: 'NuBank',
    brand: 'Mastercard',
    last4: '8842',
    color: 'linear-gradient(135deg, #820ad1 0%, #4c0677 100%)',
    limitTotal: 8500.00,
    closingDay: 24,
    dueDay: 3
  },
  {
    id: 'card-outras',
    name: 'Outras Contas / Carnês',
    brand: 'Diversos',
    last4: '0000',
    color: 'linear-gradient(135deg, #64748b 0%, #334155 100%)',
    limitTotal: 3000.00,
    closingDay: 10,
    dueDay: 15
  }
];

function getCardId(name) {
  if (!name) return 'card-outras';
  const clean = name.trim().toLowerCase();
  if (clean.includes('grazy')) return 'card-nubank-grazy';
  if (clean.includes('nubank')) return 'card-nubank';
  if (clean.includes('mercado')) return 'card-mercado';
  if (clean.includes('picpay')) return 'card-picpay';
  if (clean.includes('inter')) return 'card-inter';
  if (clean.includes('neon')) return 'card-neon';
  return 'card-outras';
}

async function run() {
  console.log('====================================================');
  console.log('🚀 INICIANDO SINCRONIZAÇÃO TOTAL DA PLANILHA V4');
  console.log('====================================================\n');

  // 0. Limpar tabelas para inserção 100% limpa e sem resíduos
  console.log('🧹 [0/4] Limpando tabelas no Supabase para garantir unicidade e dados idênticos à planilha...');
  if (supabase) {
    try {
      await supabase.from('transactions').delete().neq('id', '___safe_keep___');
      await supabase.from('installments').delete().neq('id', '___safe_keep___');
      await supabase.from('bills').delete().neq('id', '___safe_keep___');
      await supabase.from('cards').delete().neq('id', '___safe_keep___');
      await supabase.from('budgets').delete().neq('id', '___safe_keep___');
      await supabase.from('goals').delete().neq('id', '___safe_keep___');
      console.log('  ✓ Banco de dados Supabase resetado com sucesso.');
    } catch (e) {
      console.warn('  Aviso durante limpeza:', e.message);
    }
  }

  // 1. Inserir Cartões
  console.log('\n💳 [1/4] Cadastrando e sincronizando os 7 Cartões de Crédito...');
  for (const card of CARDS_TO_ENSURE) {
    await db.addCard(card);
    console.log(`  ✓ Cartão: ${card.name} (${card.id}) - Limite: R$ ${card.limitTotal.toFixed(2)}`);
  }

  // Carregar dados extraídos diretamente do Excel
  const rawDataPath = path.join(__dirname, '../data/spreadsheet_data.json');
  const rawData = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
  const despesasRaw = rawData.despesas;
  const cartaoRaw = rawData.cartao;

  // 2. Importar Despesas Fixas e Recorrentes
  console.log('\n📋 [2/4] Importando Despesas Fixas e Recorrentes (Sheet 1)...');
  let totalFixas = 0;

  for (let i = 0; i < despesasRaw.length; i++) {
    const item = despesasRaw[i];
    const desc = item['Descrição'] || item['Descrio'] || 'Despesa Fixa';
    const cat = item['Categoria'] || 'Conta Fixa';
    const valor = parseFloat(item['Valor (R$)']) || 0;
    const resp = (item['Responsável'] || item['Responsvel'] || 'Marcos').trim();
    totalFixas += valor;

    const fullDesc = `${desc} (${resp})`;
    const dayStr = String(i + 1).padStart(2, '0');

    // Transação de Novembro/2026 (Competência da planilha)
    await db.addTransaction({
      id: `tx-fixa-nov-${i + 1}`,
      description: fullDesc,
      type: 'EXPENSE',
      amount: valor,
      category: cat,
      paymentMethod: 'PIX',
      cardId: null,
      isInstallment: false,
      date: `2026-11-${dayStr}T12:00:00.000Z`,
      source: 'PLANILHA',
      account: resp,
      isPaid: false
    });

    // Transação de Outubro/2026 (Histórico mês anterior)
    await db.addTransaction({
      id: `tx-fixa-oct-${i + 1}`,
      description: fullDesc,
      type: 'EXPENSE',
      amount: valor,
      category: cat,
      paymentMethod: 'PIX',
      cardId: null,
      isInstallment: false,
      date: `2026-10-${dayStr}T12:00:00.000Z`,
      source: 'PLANILHA',
      account: resp,
      isPaid: true
    });

    // Conta a Pagar (Bill) de Novembro/2026
    await db.addBill({
      id: `bill-fixa-nov-${i + 1}`,
      description: fullDesc,
      amount: valor,
      dueDate: `2026-11-${dayStr}`,
      type: 'PAY',
      isPaid: false
    });

    console.log(`  ✓ [${i + 1}/${despesasRaw.length}] ${fullDesc} - R$ ${valor.toFixed(2)} [${cat}]`);
  }
  console.log(`  👉 Total Despesas Fixas: R$ ${totalFixas.toFixed(2)} / mês`);

  // 3. Importar Parcelamentos de Cartão
  console.log('\n💳 [3/4] Importando 41 Compras Parceladas de Cartão (Sheet 2)...');
  const cardTotalsNov = {};

  for (let i = 0; i < cartaoRaw.length; i++) {
    const item = cartaoRaw[i];
    const cardStr = item['Cartão'] || item['Carto'] || '';
    const cardId = getCardId(cardStr);
    const desc = item['Descrição'] || item['Descrio'] || 'Compra no Cartão';
    const resp = (item['Responsável'] || item['Responsvel'] || 'Marcos').trim();
    const valParc = parseFloat(item['Valor da Parcela (R$)']) || 0;
    const parcAtual = parseInt(item['Parcela Atual (nº)'] || item['Parcela Atual (n)'], 10) || 1;
    const totalParc = parseInt(item['Total de Parcelas'], 10) || 1;
    const startMonth = (item['Mês de Início (calc.)'] || item['Ms de Incio (calc.)'] || '2026-10').slice(0, 7);
    const endMonth = (item['Mês Final (calc.)'] || item['Ms Final (calc.)'] || '2026-10').slice(0, 7);
    const totalAmount = Math.round((valParc * totalParc) * 100) / 100;

    const fullDesc = `${desc} (${resp})`;
    const instId = `inst-v4-${i + 1}`;

    cardTotalsNov[cardId] = (cardTotalsNov[cardId] || 0) + valParc;

    // Inserir Parcelamento
    await db.addInstallment({
      id: instId,
      cardId: cardId,
      description: fullDesc,
      category: 'Compras Parceladas',
      totalAmount: totalAmount,
      installmentAmount: valParc,
      totalInstallments: totalParc,
      currentInstallment: parcAtual,
      startMonth: startMonth,
      endMonth: endMonth
    });

    const [sY, sM] = startMonth.split('-').map(Number);

    // Transação de Novembro/2026 (Competência da planilha)
    await db.addTransaction({
      id: `tx-parc-nov-${instId}`,
      description: `${desc} (Parc. ${parcAtual}/${totalParc} - ${resp})`,
      type: 'EXPENSE',
      amount: valParc,
      category: 'Cartão de Crédito',
      paymentMethod: 'CREDIT_CARD',
      cardId: cardId,
      isInstallment: true,
      installmentId: instId,
      date: '2026-11-12T12:00:00.000Z',
      source: 'PLANILHA',
      account: resp,
      isPaid: false
    });

    // Se estava ativo em Outubro/2026, registrar também no histórico de outubro
    const octYM = '2026-10';
    if (octYM >= startMonth && octYM <= endMonth) {
      const octParcNum = (2026 * 12 + 10) - (sY * 12 + sM) + 1;
      await db.addTransaction({
        id: `tx-parc-oct-${instId}`,
        description: `${desc} (Parc. ${octParcNum}/${totalParc} - ${resp})`,
        type: 'EXPENSE',
        amount: valParc,
        category: 'Cartão de Crédito',
        paymentMethod: 'CREDIT_CARD',
        cardId: cardId,
        isInstallment: true,
        installmentId: instId,
        date: '2026-10-25T12:00:00.000Z',
        source: 'PLANILHA',
        account: resp,
        isPaid: true
      });
    }

    console.log(`  ✓ [${i + 1}/${cartaoRaw.length}] [${cardId}] ${fullDesc} - Parc. ${parcAtual}/${totalParc} de R$ ${valParc.toFixed(2)} (${startMonth} a ${endMonth})`);
  }

  // 4. Configurar Orçamentos e Metas Baseados na Planilha
  console.log('\n💰 [4/4] Definindo Tetos Orçamentários e Configurações...');
  const totalCartoes = Object.values(cardTotalsNov).reduce((a, b) => a + b, 0);

  await db.addBudget({ id: 'orc-1', category: 'Conta Fixa', monthlyLimit: 3000.00, spentAmount: 1427.00 });
  await db.addBudget({ id: 'orc-2', category: 'Moradia/Investimento', monthlyLimit: 1600.00, spentAmount: 1535.00 });
  await db.addBudget({ id: 'orc-3', category: 'Cartão de Crédito', monthlyLimit: 4500.00, spentAmount: totalCartoes });

  await db.addGoal({ id: 'goal-1', title: 'Aporte Imobiliário (Casa & Terreno)', targetAmount: 50000.00, currentAmount: 40500.00, deadlineDate: '2027-12-31' });
  await db.addGoal({ id: 'goal-2', title: 'Reserva de Emergência', targetAmount: 20000.00, currentAmount: 18322.00, deadlineDate: '2027-06-30' });

  console.log('\n====================================================');
  console.log('🎉 TOTALIZAÇÃO EXATA DOS VALORES DA PLANILHA');
  console.log('====================================================');
  console.log('FATURAS DE CARTÃO (COMPETÊNCIA NOVEMBRO/2026):');
  for (const [cid, val] of Object.entries(cardTotalsNov)) {
    console.log(`  • ${cid}: R$ ${val.toFixed(2)}`);
  }
  console.log(`  👉 TOTAL FATURAS: R$ ${totalCartoes.toFixed(2)} (Esperado: R$ 3773.90)`);
  console.log(`  👉 TOTAL DESPESAS FIXAS: R$ ${totalFixas.toFixed(2)} (Esperado: R$ 2962.00)`);
  console.log(`  👉 SOMA TOTAL GERAL: R$ ${(totalCartoes + totalFixas).toFixed(2)} (Esperado: R$ 6735.90)`);

  process.exit(0);
}

run().catch(err => {
  console.error('❌ Erro durante importação:', err);
  process.exit(1);
});
