const db = require('../db');

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

const INSTALLMENT_ITEMS = [
  // 1
  {
    cardId: 'card-outras',
    cardName: 'Outras Contas',
    description: 'Projetor',
    installmentAmount: 100.00,
    currentInstallment: 4,
    totalInstallments: 6,
    startMonth: '2026-05',
    endMonth: '2026-10',
    status: 'Ativo',
    responsible: 'Marcos'
  },
  // 2
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Mercado Livre',
    installmentAmount: 11.00,
    currentInstallment: 2,
    totalInstallments: 4,
    startMonth: '2026-07',
    endMonth: '2026-10',
    status: 'Ativo',
    responsible: 'Marcos'
  },
  // 3
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Mercado Livre (Aparelho Jantar)',
    installmentAmount: 34.53,
    currentInstallment: 4,
    totalInstallments: 11,
    startMonth: '2026-03',
    endMonth: '2027-01',
    status: 'Ativo',
    responsible: 'Sogra'
  },
  // 4
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Mercado Livre',
    installmentAmount: 16.46,
    currentInstallment: 5,
    totalInstallments: 6,
    startMonth: '2026-01',
    endMonth: '2026-06',
    status: 'Quitado',
    responsible: 'Marcos'
  },
  // 5
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Mercado Livre',
    installmentAmount: 62.99,
    currentInstallment: 5,
    totalInstallments: 10,
    startMonth: '2026-01',
    endMonth: '2026-10',
    status: 'Ativo',
    responsible: 'Marcos'
  },
  // 6
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Meli+',
    installmentAmount: 9.90,
    currentInstallment: 1,
    totalInstallments: 1,
    startMonth: '2026-08',
    endMonth: '2026-08',
    status: 'Quitado',
    responsible: 'Marcos'
  },
  // 7
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Mercado Livre',
    installmentAmount: 31.23,
    currentInstallment: 7,
    totalInstallments: 8,
    startMonth: '2025-09',
    endMonth: '2026-04',
    status: 'Quitado',
    responsible: 'Marcos'
  },
  // 8
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Mercado Livre',
    installmentAmount: 26.24,
    currentInstallment: 8,
    totalInstallments: 8,
    startMonth: '2025-08',
    endMonth: '2026-03',
    status: 'Quitado',
    responsible: 'Marcos'
  },
  // 9
  {
    cardId: 'card-mercado',
    cardName: 'Cartão Mercado',
    description: 'Mercado Livre',
    installmentAmount: 58.78,
    currentInstallment: 11,
    totalInstallments: 18,
    startMonth: '2025-02',
    endMonth: '2026-07',
    status: 'Quitado',
    responsible: 'Marcos'
  },
  // 10
  {
    cardId: 'card-inter',
    cardName: 'Cartão Inter',
    description: 'JIM COM GRAZIELLY DO LIMOEIRO PE',
    installmentAmount: 150.00,
    currentInstallment: 3,
    totalInstallments: 10,
    startMonth: '2026-05',
    endMonth: '2027-02',
    status: 'Ativo',
    responsible: 'Marcos'
  },
  // 11
  {
    cardId: 'card-inter',
    cardName: 'Cartão Inter',
    description: 'Pix Cred Parcelado',
    installmentAmount: 333.41,
    currentInstallment: 2,
    totalInstallments: 3,
    startMonth: '2026-08',
    endMonth: '2026-10',
    status: 'Ativo',
    responsible: 'Nelson'
  },
  // 12
  {
    cardId: 'card-inter',
    cardName: 'Cartão Inter',
    description: 'MP ELPIDIOBICICLETAS LIMOEIRO PE',
    installmentAmount: 178.00,
    currentInstallment: 4,
    totalInstallments: 10,
    startMonth: '2026-04',
    endMonth: '2027-01',
    status: 'Ativo',
    responsible: 'Mãe'
  },
  // 13
  {
    cardId: 'card-inter',
    cardName: 'Cartão Inter',
    description: 'MOURA CELL LIMOEIRO PE',
    installmentAmount: 110.36,
    currentInstallment: 4,
    totalInstallments: 10,
    startMonth: '2026-03',
    endMonth: '2026-12',
    status: 'Ativo',
    responsible: 'Mãe'
  },
  // 14
  {
    cardId: 'card-inter',
    cardName: 'Cartão Inter',
    description: 'JOSE VARIEDADES LIMOEIRO PE',
    installmentAmount: 385.00,
    currentInstallment: 5,
    totalInstallments: 10,
    startMonth: '2026-02',
    endMonth: '2026-11',
    status: 'Ativo',
    responsible: 'Mãe'
  },
  // 15
  {
    cardId: 'card-picpay',
    cardName: 'Cartão PicPay',
    description: 'Jim.com* Davidparc02/08',
    installmentAmount: 125.00,
    currentInstallment: 3,
    totalInstallments: 8,
    startMonth: '2026-05',
    endMonth: '2026-12',
    status: 'Ativo',
    responsible: 'Wagner'
  },
  // 16
  {
    cardId: 'card-picpay',
    cardName: 'Cartão PicPay',
    description: 'Robertomarques',
    installmentAmount: 200.08,
    currentInstallment: 5,
    totalInstallments: 12,
    startMonth: '2026-01',
    endMonth: '2026-12',
    status: 'Ativo',
    responsible: 'Junior'
  },
  // 17
  {
    cardId: 'card-picpay',
    cardName: 'Cartão PicPay',
    description: 'Mp *lojatubrax',
    installmentAmount: 145.50,
    currentInstallment: 5,
    totalInstallments: 10,
    startMonth: '2026-01',
    endMonth: '2026-10',
    status: 'Ativo',
    responsible: 'Marcos'
  },
  // 18
  {
    cardId: 'card-picpay',
    cardName: 'Cartão PicPay',
    description: 'Mlp*magalu-bri',
    installmentAmount: 71.14,
    currentInstallment: 5,
    totalInstallments: 6,
    startMonth: '2026-01',
    endMonth: '2026-06',
    status: 'Quitado',
    responsible: 'Grazy/Marcos'
  },
  // 19
  {
    cardId: 'card-picpay',
    cardName: 'Cartão PicPay',
    description: 'Paulosergiosoaparc',
    installmentAmount: 238.00,
    currentInstallment: 1,
    totalInstallments: 10,
    startMonth: '2026-09',
    endMonth: '2027-06',
    status: 'Ativo',
    responsible: 'Grazy/Marcos'
  },
  // 20
  {
    cardId: 'card-neon',
    cardName: 'Cartão Neon',
    description: 'MERCADO*MERCADOL',
    installmentAmount: 92.33,
    currentInstallment: 10,
    totalInstallments: 12,
    startMonth: '2025-03',
    endMonth: '2026-02',
    status: 'Quitado',
    responsible: 'Marcos'
  },
  // 21
  {
    cardId: 'card-nubank',
    cardName: 'NU Bank',
    description: 'Shopee',
    installmentAmount: 68.59,
    currentInstallment: 1,
    totalInstallments: 1,
    startMonth: '2025-10',
    endMonth: '2025-10',
    status: 'Quitado',
    responsible: 'Marcos'
  }
];

async function run() {
  console.log('[Script] Conectando e registrando cartões e parcelamentos...');
  const currentDb = await db.getData();
  const existingCardIds = new Set((currentDb.cards || []).map(c => c.id));

  // 1. Garantir cartões
  for (const card of CARDS_TO_ENSURE) {
    if (!existingCardIds.has(card.id)) {
      console.log(`[Card] Cadastrando cartão: ${card.name} (${card.id})`);
      await db.addCard(card);
    }
  }

  // 2. Cadastrar parcelamentos
  const currentYM = '2026-10';
  let activeThisMonthCount = 0;
  let activeThisMonthTotal = 0;

  for (let i = 0; i < INSTALLMENT_ITEMS.length; i++) {
    const item = INSTALLMENT_ITEMS[i];
    const instId = `inst-planilha-${i + 1}`;
    const totalAmount = Math.round((item.installmentAmount * item.totalInstallments) * 100) / 100;

    const instPayload = {
      id: instId,
      cardId: item.cardId,
      description: `${item.description} (${item.responsible})`,
      category: 'Compras Parceladas',
      totalAmount: totalAmount,
      installmentAmount: item.installmentAmount,
      totalInstallments: item.totalInstallments,
      currentInstallment: item.currentInstallment,
      startMonth: item.startMonth,
      endMonth: item.endMonth
    };

    await db.addInstallment(instPayload);
    console.log(`✓ [${i + 1}/${INSTALLMENT_ITEMS.length}] Parcelamento: ${instPayload.description} - ${item.currentInstallment}/${item.totalInstallments}x de R$ ${item.installmentAmount.toFixed(2)} [${item.status}]`);

    // 3. Se ativo neste mês (2026-10), registrar transação da parcela
    const isActiveThisMonth = currentYM >= item.startMonth && currentYM <= item.endMonth;
    if (isActiveThisMonth) {
      activeThisMonthCount++;
      activeThisMonthTotal += item.installmentAmount;

      const txPayload = {
        id: `tx-parc-${instId}`,
        description: `${item.description} (Parc. ${item.currentInstallment}/${item.totalInstallments} - ${item.responsible})`,
        type: 'EXPENSE',
        amount: item.installmentAmount,
        category: 'Cartão de Crédito',
        paymentMethod: 'CREDIT_CARD',
        cardId: item.cardId,
        isInstallment: true,
        installmentId: instId,
        date: '2026-10-25T12:00:00.000Z',
        source: 'PLANILHA',
        account: item.responsible,
        isPaid: true
      };
      await db.addTransaction(txPayload);
    }
  }

  console.log(`\n🎉 Processamento concluído!`);
  console.log(`Total de Parcelamentos cadastrados: ${INSTALLMENT_ITEMS.length}`);
  console.log(`Parcelas ativas em Outubro/2026: ${activeThisMonthCount}`);
  console.log(`Valor das parcelas deste mês: R$ ${activeThisMonthTotal.toFixed(2)}`);

  process.exit(0);
}

run().catch(err => {
  console.error('Erro na execução:', err);
  process.exit(1);
});
