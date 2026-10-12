# Meu Assessor • Gestão Financeira, Cartões & WhatsApp

Sistema financeiro inteligente inspirado no **Meu Assessor**, com registro de despesas e receitas diretamente por conversa de WhatsApp (via Webhook), gestão de cartões de crédito, controle de limites e **projeção preditiva de término das faturas**.

---

## 🌟 Principais Funcionalidades

### 1. 💳 Cartões de Crédito, Limites e Faturas
- **Visual Realista de Cartões**: Exibição dos cartões cadastrados (ex.: *Nubank Ultravioleta*, *Inter Black*) com chip, últimos dígitos e dados essenciais.
- **Controle de Limites em Tempo Real**:
  - Limite Total do Cartão
  - Limite Comprometido e Limite Disponível
  - Barra de progresso visual com alertas de segurança (verde, amarelo e vermelho).
- **Fatura Aberta do Mês**: Soma das compras avulsas no cartão + parcelas dos parcelamentos ativos incidentes no mês.
- **Datas de Ciclo**: Melhor dia de compra (fechamento) e dia de vencimento.

---

### 2. 📉 Projeção de Término da Fatura (Parcelamentos Futuros)
- **Cálculo Preditivo Automático**: O sistema analisa todas as compras parceladas contratadas e projeta o valor exato da fatura para os próximos 18 meses.
- **Previsão de Quitação Final**:
  > *"🏁 Suas faturas decorrentes dos parcelamentos atuais serão totalmente quitadas em **Julho de 2027** (em 10 meses), liberando 100% do seu limite comprometido."*
- **Gráfico Interativo Mês a Mês**: Colunas visuais mostrando a queda progressiva da fatura à medida que os parcelamentos são encerrados (com modal detalhado ao clicar em qualquer mês).
- **Tabela de Compras Parceladas**: Acompanhamento de cada item (ex.: *MacBook Air, Geladeira, Smartphone*), parcela atual (ex.: `5/12`), valor da parcela, valor total e mês final de término.

---

### 3. 💬 Registro Direto via WhatsApp (Webhook & Simulador)
Envie mensagens naturais no WhatsApp e a inteligência do sistema categoriza e registra tudo:

- **Compras Parceladas no Cartão**:
  > *"Comprei notebook 3600 em 10x no nubank"*  
  > ➡️ Cadastra o parcelamento de 10x de R$ 360,00, lança a parcela na fatura atual, atualiza o limite do cartão e recalcula a data de término das faturas.
- **Despesas Avulsas**:
  > *"Almoço 45 no débito"* ou *"Uber 28 no crédito"*  
  > ➡️ Deduz do saldo em conta ou adiciona à fatura do cartão com categorização automática.
- **Receitas**:
  > *"Recebi 4500 de salário"* ou *"Pix de 600 do freela"*  
  > ➡️ Adiciona crédito ao saldo em conta.
- **Consultas Inteligentes**:
  > *"quando acabo de pagar a fatura?"* ➡️ Informa quais parcelas faltam e a data final prevista.  
  > *"fatura"* ou *"limite"* ➡️ Mostra o resumo detalhado dos cartões.  
  > *"saldo"* ➡️ Mostra o saldo geral em conta corrente e balanço do mês.

---

### 4. 📊 Dashboard & Extrato Completo
- **Cards de Indicadores**: Saldo em Conta, Receitas do Mês, Despesas do Mês e Total em Faturas.
- **Extrato Detalhado**: Histórico de transações com selo de origem (🟢 WhatsApp ou 💻 Web), filtros e ações.
- **Simulador de WhatsApp Integrado**: Interface idêntica ao WhatsApp Web na própria aplicação para testar o assistente na hora sem precisar de número pago no primeiro instante.
- **Endpoint Webhook Real**: `POST /api/webhook/whatsapp` compatível com Evolution API, Z-API, Baileys e Meta Cloud API.

---

## 🚀 Como Executar

### 1. Iniciar o Servidor
```bash
npm start
```
O servidor iniciará em `http://localhost:3000`.

### 2. Acessar o Sistema
Abra no navegador:
```
http://localhost:3000
```

### 3. Testar o Webhook do WhatsApp via Terminal (cURL)
```bash
curl -X POST "http://localhost:3000/api/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -d '{"message": "quando acabo a fatura?"}'
```

---

## 📂 Estrutura de Arquivos

```
Sistema financeiro/
├── data/
│   └── database.json          # Banco de dados local (saldo, cartões, parcelamentos, extrato e chat)
├── public/
│   ├── css/
│   │   ├── tokens.css         # Design system e variáveis de cores dark mode
│   │   ├── layout.css         # Layout estrutural e componentes
│   │   └── dashboard.css      # Estilização dos cartões bancários, projeção e chat WhatsApp
│   ├── js/
│   │   └── dashboard.js       # Motor da interface, projeção de faturas, gráficos e chat
│   └── index.html             # Interface completa do Meu Assessor
├── server.js                  # Servidor Node com Webhook WhatsApp, NLP Parser e Projeções
├── package.json
└── README.md
```
