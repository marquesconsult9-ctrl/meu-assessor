const db = require('../db');

const expenses = [
  {
    description: 'Financiamento casa (Marcos)',
    category: 'Moradia/Investimento',
    amount: 785.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Terreno (Marcos)',
    category: 'Moradia/Investimento',
    amount: 250.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Mercado (Marcos)',
    category: 'Conta Fixa',
    amount: 800.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Energia (Marcos)',
    category: 'Conta Fixa',
    amount: 150.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Água (Marcos)',
    category: 'Conta Fixa',
    amount: 60.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Internet (Marcos)',
    category: 'Conta Fixa',
    amount: 70.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'MEI (Marcos)',
    category: 'Conta Fixa',
    amount: 87.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Academia (Marcos)',
    category: 'Conta Fixa',
    amount: 100.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Gasolina (Marcos)',
    category: 'Conta Fixa',
    amount: 250.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Tim (Marcos)',
    category: 'Conta Fixa',
    amount: 60.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Marcos'
  },
  {
    description: 'Terreno (Grazy)',
    category: 'Moradia/Investimento',
    amount: 250.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Grazy'
  },
  {
    description: 'Academia (Grazy)',
    category: 'Conta Fixa',
    amount: 100.00,
    paid: true,
    monthStr: '2026-10-25',
    responsible: 'Grazy'
  }
];

async function run() {
  console.log(`[Script] Iniciando registro de ${expenses.length} despesas...`);
  const now = Date.now();

  for (let i = 0; i < expenses.length; i++) {
    const item = expenses[i];
    const txId = `tx-oct-${now}-${i + 1}`;
    const billId = `bill-oct-${now}-${i + 1}`;

    // 1. Transaction
    const tx = {
      id: txId,
      description: item.description,
      type: 'EXPENSE',
      amount: item.amount,
      category: item.category,
      paymentMethod: 'PIX',
      cardId: null,
      isInstallment: false,
      date: `${item.monthStr}T12:00:00.000Z`,
      source: 'PLANILHA',
      account: item.responsible,
      isPaid: item.paid
    };
    await db.addTransaction(tx);

    // 2. Bill (Conta a Pagar)
    const bill = {
      id: billId,
      description: item.description,
      amount: item.amount,
      dueDate: item.monthStr,
      type: 'PAY',
      isPaid: item.paid
    };
    await db.addBill(bill);

    console.log(`✓ [${i + 1}/${expenses.length}] Registrado: ${item.description} - R$ ${item.amount.toFixed(2)} (${item.category})`);
  }

  // Verificar totais
  const data = await db.getData();
  const totalTx = data.transactions.reduce((sum, t) => sum + (t.type === 'EXPENSE' ? t.amount : 0), 0);
  console.log(`\n🎉 Registro concluído com sucesso!`);
  console.log(`Total de Transações: ${data.transactions.length}`);
  console.log(`Total de Contas a Pagar (Bills): ${data.bills.length}`);
  console.log(`Soma Total das Saídas: R$ ${totalTx.toFixed(2)}`);
  process.exit(0);
}

run().catch(err => {
  console.error('Erro no registro:', err);
  process.exit(1);
});
