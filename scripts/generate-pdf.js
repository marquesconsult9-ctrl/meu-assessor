const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const HTML_FILE = path.join(__dirname, '..', 'Manual_Logica_do_Sistema.html');
const PDF_FILE = path.join(__dirname, '..', 'Manual_Logica_do_Sistema.pdf');

const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Manual de Arquitetura & Lógica Operacional • Meu Assessor</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');

    :root {
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --primary-light: #eff6ff;
      --secondary: #0f172a;
      --accent: #10b981;
      --accent-dark: #059669;
      --warning: #f59e0b;
      --danger: #ef4444;
      --purple: #8b5cf6;
      --text: #1e293b;
      --text-muted: #64748b;
      --text-light: #94a3b8;
      --border: #e2e8f0;
      --bg-light: #f8fafc;
      --bg-card: #ffffff;
      --radius: 8px;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: var(--text);
      background-color: #ffffff;
      line-height: 1.55;
      font-size: 10.5pt;
    }

    /* Print & Page Setup */
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 14mm 14mm;
      @bottom-right {
        content: counter(page);
        font-size: 8.5pt;
        color: #94a3b8;
      }
    }

    .page-break {
      page-break-before: always;
      break-before: page;
    }

    .avoid-break {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* Cover Page */
    .cover-page {
      min-height: 92vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 30px 10px;
    }

    .cover-badge {
      display: inline-block;
      padding: 6px 14px;
      background: var(--primary-light);
      color: var(--primary-dark);
      font-size: 8.5pt;
      font-weight: 700;
      letter-spacing: 1px;
      text-transform: uppercase;
      border-radius: 20px;
      border: 1px solid #bfdbfe;
      margin-bottom: 20px;
    }

    .cover-title {
      font-size: 32pt;
      font-weight: 800;
      color: var(--secondary);
      line-height: 1.15;
      margin-bottom: 16px;
    }

    .cover-title span {
      color: var(--primary);
    }

    .cover-subtitle {
      font-size: 13pt;
      color: var(--text-muted);
      font-weight: 400;
      max-width: 620px;
      line-height: 1.5;
    }

    .cover-meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 16px;
      padding: 20px;
      background: var(--bg-light);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      margin-top: 30px;
    }

    .meta-item {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 4px;
    }

    .meta-val {
      font-size: 10.5pt;
      font-weight: 600;
      color: var(--secondary);
    }

    /* Headings */
    h1 {
      font-size: 17pt;
      font-weight: 800;
      color: var(--secondary);
      border-bottom: 2px solid var(--primary);
      padding-bottom: 5px;
      margin-top: 14px;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h1 .sec-number {
      background: var(--primary);
      color: white;
      font-size: 10.5pt;
      width: 24px;
      height: 24px;
      border-radius: 5px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }

    h2 {
      font-size: 12pt;
      font-weight: 700;
      color: var(--secondary);
      margin-top: 12px;
      margin-bottom: 6px;
      border-left: 3px solid var(--primary);
      padding-left: 8px;
    }

    h3 {
      font-size: 10.5pt;
      font-weight: 600;
      color: #334155;
      margin-top: 10px;
      margin-bottom: 4px;
    }

    p {
      margin-bottom: 8px;
      color: #334155;
      text-align: justify;
    }

    /* Lists */
    ul, ol {
      margin-left: 18px;
      margin-bottom: 8px;
    }

    li {
      margin-bottom: 3px;
      color: #334155;
    }

    /* Tables */
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 8.5pt;
    }

    th, td {
      padding: 6px 8px;
      text-align: left;
      border: 1px solid var(--border);
    }

    th {
      background: var(--bg-light);
      font-weight: 600;
      color: var(--secondary);
      text-transform: uppercase;
      font-size: 7pt;
      letter-spacing: 0.5px;
    }

    tr:nth-child(even) td {
      background: #fafbfc;
    }

    /* Cards & Containers */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 10px 12px;
      margin: 8px 0;
    }

    .card-primary {
      border-left: 3px solid var(--primary);
      background: #f8fafc;
    }

    .card-accent {
      border-left: 3px solid var(--accent);
      background: #f0fdf4;
    }

    .card-warning {
      border-left: 3px solid var(--warning);
      background: #fffbeb;
    }

    /* Grid Layouts */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin: 10px 0;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 10px 0;
    }

    .kpi-box {
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 8px 10px;
      background: var(--bg-light);
    }

    .kpi-title {
      font-size: 7.5pt;
      text-transform: uppercase;
      color: var(--text-muted);
      font-weight: 600;
      margin-bottom: 2px;
    }

    .kpi-value {
      font-size: 11.5pt;
      font-weight: 700;
      color: var(--secondary);
    }

    .kpi-sub {
      font-size: 7pt;
      color: var(--text-muted);
      margin-top: 1px;
    }

    /* Code Blocks */
    code, pre {
      font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
    }

    code {
      background: #f1f5f9;
      color: #0f172a;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 8pt;
    }

    /* Flow diagram box */
    .flow-step {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      margin-bottom: 8px;
    }

    .step-circle {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--primary);
      color: white;
      font-weight: 700;
      font-size: 8.5pt;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .step-content {
      flex: 1;
    }

    .step-content strong {
      display: block;
      color: var(--secondary);
      font-size: 9.5pt;
      margin-bottom: 1px;
    }

    .tag {
      display: inline-block;
      font-size: 6.5pt;
      font-weight: 600;
      padding: 2px 5px;
      border-radius: 6px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tag-blue { background: #dbeafe; color: #1e40af; }
    .tag-green { background: #d1fae5; color: #065f46; }
    .tag-purple { background: #ede9fe; color: #5b21b6; }
    .tag-orange { background: #ffedd5; color: #9a3412; }

    .formula-box {
      background: #f8fafc;
      border: 1px solid #cbd5e1;
      border-radius: var(--radius);
      padding: 8px 12px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      color: #0f172a;
      margin: 8px 0;
      border-left: 3px solid var(--purple);
    }
  </style>
</head>
<body>

  <!-- =========================================================================
       CAPA DO DOCUMENTO
       ========================================================================= -->
  <div class="cover-page">
    <div>
      <div class="cover-badge">Documentação Técnica Executiva</div>
      <h1 class="cover-title">Manual de Arquitetura &<br><span>Lógica do Sistema</span></h1>
      <p class="cover-subtitle">
        Detalhamento aprofundado dos motores de cálculo preditivo, conciliação contábil, automação via WhatsApp 24/7 e persistência de dados.
      </p>
    </div>

    <div>
      <div class="card card-primary" style="margin-bottom: 20px;">
        <h3 style="margin-top:0; color: var(--primary-dark);">🎯 Escopo Deste Documento</h3>
        <p style="font-size: 9.5pt; margin-bottom: 0;">
          Este manual apresenta as fundações lógicas, regras de negócio matemáticas e integrações que sustentam a operação da plataforma <strong>Meu Assessor (Lançei)</strong>. Abrange desde os fluxos de sincronismo entre Supabase e armazenamento local JSON, até o algoritmo de projeção de quitação em 18 meses e o pipeline de processamento em linguagem natural.
        </p>
      </div>

      <div class="cover-meta-grid">
        <div class="meta-item">
          <span class="meta-label">Sistema</span>
          <span class="meta-val">Meu Assessor Financeiro (Lançei)</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Versão da Plataforma</span>
          <span class="meta-val">1.0 Enterprise Edition</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Arquitetura de Banco</span>
          <span class="meta-val">Supabase PostgreSQL + Fallback Local JSON</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Data de Emissão</span>
          <span class="meta-val">Outubro de 2026</span>
        </div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- =========================================================================
       SEÇÃO 1: VISÃO GERAL & ARQUITETURA DE SISTEMAS
       ========================================================================= -->
  <h1><span class="sec-number">1</span> Visão Geral & Arquitetura Geral</h1>

  <p>
    O <strong>Meu Assessor Financeiro</strong> é uma plataforma moderna de engenharia financeira e controladoria patrimonial projetada para eliminar o atrito operacional no registro, consolidação e projeção de finanças pessoais e de pequenos negócios.
  </p>

  <p>
    A solução opera em tempo real integrando uma interface rica orientada a dados (SPA em Vanilla HTML5/CSS3) com um ecossistema autônomo acionado via <strong>WhatsApp corporativo</strong>, <strong>Webhooks bancários</strong> e <strong>Server-Sent Events (SSE)</strong>.
  </p>

  <div class="grid-3">
    <div class="kpi-box">
      <div class="kpi-title">Camada Backend</div>
      <div class="kpi-value">Node.js Vanilla HTTP</div>
      <div class="kpi-sub">Latência ultrabaixa & SSE nativo</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">Camada de Dados</div>
      <div class="kpi-value">PostgreSQL + JSON</div>
      <div class="kpi-sub">Alta disponibilidade com failover</div>
    </div>
    <div class="kpi-box">
      <div class="kpi-title">Assistente 24/7</div>
      <div class="kpi-value">WhatsApp Baileys</div>
      <div class="kpi-sub">NLP com extração de entidades</div>
    </div>
  </div>

  <h2>1.1 Diagrama Conceitual da Arquitetura</h2>
  <p>
    A arquitetura é dividida em quatro camadas interdependentes que garantem performance, resiliência a falhas de rede e facilidade de operação:
  </p>

  <div class="card avoid-break">
    <div class="flow-step">
      <div class="step-circle">1</div>
      <div class="step-content">
        <strong>Interface de Usuário (Frontend SPA)</strong>
        Dashboard executivo responsivo com renderização de gráficos vetoriais SVG nativos, painel de projeção de faturas, calendário de vencimentos e streaming de atualizações via SSE.
      </div>
    </div>
    <div class="flow-step">
      <div class="step-circle">2</div>
      <div class="step-content">
        <strong>Núcleo de Aplicação (Server Engine - server.js)</strong>
        Roteador HTTP puro sem dependência de frameworks lentos. Centraliza as APIs REST, broadcast de SSE para clientes conectados e executa os cálculos preditivos de quitação.
      </div>
    </div>
    <div class="flow-step">
      <div class="step-circle">3</div>
      <div class="step-content">
        <strong>Serviço de Mensageria & NLP (whatsapp-service.js)</strong>
        Socket Baileys com persistência de sessão de autenticação multi-arquivos (<code>auth_info_baileys</code>). Parser regex e semântico capaz de interpretar comprovantes, compras parceladas e consultas conversacionais.
      </div>
    </div>
    <div class="flow-step">
      <div class="step-circle">4</div>
      <div class="step-content">
        <strong>Adaptador Universal de Dados (db.js)</strong>
        Abstração de acesso a dados com suporte transparente a Supabase PostgreSQL na nuvem (com Row Level Security) e fallback imediato para JSON local em caso de ausência de rede.
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- =========================================================================
       SEÇÃO 2: MODELAGEM DE DADOS & PERSISTÊNCIA HÍBRIDA
       ========================================================================= -->
  <h1><span class="sec-number">2</span> Modelagem de Dados & Persistência Híbrida</h1>

  <p>
    O sistema utiliza uma abordagem pioneira de <strong>Armazenamento Híbrido Resiliente</strong>. Ele se comunica prioritariamente com o cluster PostgreSQL no Supabase Cloud. Caso a chave de API não esteja configurada ou o serviço de nuvem fique inatingível, a aplicação chaveia automaticamente para o banco local no arquivo <code>data/database.json</code>, mantendo a experiência inalterada.
  </p>

  <h2>2.1 Dicionário de Entidades Principais</h2>
  <table class="avoid-break">
    <thead>
      <tr>
        <th style="width: 20%;">Tabela</th>
        <th style="width: 26%;">Chave / Relacionamentos</th>
        <th>Descrição & Papel no Negócio</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>financial_settings</code></td>
        <td><code>id (PK) = 'main'</code></td>
        <td>Guarda os saldos consolidados (Conta Corrente, Reserva de Emergência, Investimentos) e preferências de notificações/alertas.</td>
      </tr>
      <tr>
        <td><code>cards</code></td>
        <td><code>id (PK)</code></td>
        <td>Contém o cadastro dos cartões de crédito: nome, bandeira, últimos 4 dígitos, limite total, dia de fechamento e dia de vencimento.</td>
      </tr>
      <tr>
        <td><code>installments</code></td>
        <td><code>id (PK)<br>card_id (FK -> cards.id)</code></td>
        <td>Compras parceladas ativas. Armazena o valor total, valor da parcela, número total de parcelas, mês inicial (<code>start_month</code>) e mês final (<code>end_month</code>).</td>
      </tr>
      <tr>
        <td><code>transactions</code></td>
        <td><code>id (PK)<br>card_id (FK -> cards.id)<br>installment_id (FK)</code></td>
        <td>Livro razão de lançamentos financeiros. Categoriza entradas (<code>INCOME</code>) e saídas (<code>EXPENSE</code>), método de pagamento (PIX, Crédito, Débito, Dinheiro) e responsável.</td>
      </tr>
      <tr>
        <td><code>bills</code></td>
        <td><code>id (PK)</code></td>
        <td>Contas de curto prazo a pagar (<code>PAY</code>) ou a receber (<code>RECEIVE</code>) com data de vencimento e flag booleano de liquidação (<code>is_paid</code>).</td>
      </tr>
      <tr>
        <td><code>budgets</code></td>
        <td><code>id (PK)</code></td>
        <td>Tetos orçamentários mensais definidos por categoria de custo (ex: Operacional, Software, Alimentação).</td>
      </tr>
      <tr>
        <td><code>goals</code></td>
        <td><code>id (PK)</code></td>
        <td>Metas patrimoniais estratégicas com valor alvo (<code>target_amount</code>), valor acumulado e data limite prevista.</td>
      </tr>
      <tr>
        <td><code>chat_history</code></td>
        <td><code>id (PK)</code></td>
        <td>Log de conversações bidirecionais transacionadas com o assistente do WhatsApp.</td>
      </tr>
    </tbody>
  </table>

  <div class="card card-primary avoid-break">
    <h3 style="margin-top:0;">2.2 Mecanismo de Integridade Referencial</h3>
    <ul style="margin-bottom:0;">
      <li>
        <strong>Exclusão de Cartões:</strong> Ao deletar um cartão, os parcelamentos e transações vinculadas mantêm seus registros, convertendo a chave estrangeira <code>card_id</code> para <code>NULL</code> (<code>ON DELETE SET NULL</code>), evitando perda de histórico contábil.
      </li>
      <li>
        <strong>Exclusão de Parcelamento:</strong> Ao excluir uma compra parcelada da tabela <code>installments</code>, todas as transações de parcelas mensais geradas automaticamente são removidas em cascata (<code>ON DELETE CASCADE</code>).
      </li>
    </ul>
  </div>

  <div class="page-break"></div>

  <!-- =========================================================================
       SEÇÃO 3: REGRAS DE NEGÓCIO E LÓGICA MATEMÁTICA
       ========================================================================= -->
  <h1><span class="sec-number">3</span> Lógica Matemática & Algoritmos Financeiros</h1>

  <p>
    A inteligência central do sistema reside na função <code>calculateFinancials()</code> em <code>server.js</code>. Essa rotina consolida todos os dados brutos e gera métricas de liquidez e projeções preditivas.
  </p>

  <h2>3.1 Fatura Mensal do Cartão de Crédito</h2>
  <p>
    A fatura de um determinado cartão no mês corrente (<em>Mês Atual</em>) é calculada pela união de duas fontes de gastos:
  </p>

  <div class="formula-box">
    Fatura Atual = Compras Avulsas do Mês + Parcelas Vigentes no Mês
  </div>

  <ul>
    <li>
      <strong>Compras Avulsas:</strong> Todas as transações do tipo <code>EXPENSE</code> com <code>isInstallment = false</code>, associadas ao cartão e com data dentro do mês corrente (<code>tx.date.startsWith(currentYM)</code>).
    </li>
    <li>
      <strong>Parcelas Vigentes:</strong> A soma do valor da parcela de todas as compras parceladas cujo intervalo temporal englobe o mês atual:
      <code>startMonth &le; currentYearMonth &le; endMonth</code>.
    </li>
  </ul>

  <h2>3.2 Dívida Total Remanescente & Limite Comprometido</h2>
  <p>
    Diferente de sistemas tradicionais que apenas olham a fatura do mês, o <em>Meu Assessor</em> calcula com precisão matemática o <strong>comprometimento futuro de limite</strong> de cada cartão:
  </p>

  <div class="formula-box">
    Parcelas Restantes = max(0, min(TotalParcelas, (Y_fim * 12 + M_fim) - (Y_atual * 12 + M_atual) + 1))<br>
    Dívida Remanescente = &sum; (Parcelas Restantes &times; Valor da Parcela)<br>
    Limite Usado = min(Limite Total, Compras Avulsas + Dívida Remanescente)<br>
    Limite Disponível = max(0, Limite Total - Limite Usado)
  </div>

  <div class="card card-accent avoid-break">
    <h3 style="margin-top:0; color: var(--accent-dark);">💡 Exemplo Prático de Quitação</h3>
    <p style="font-size: 9.5pt; margin-bottom: 0;">
      Se um usuário compra um notebook por R$ 6.000,00 em 10x de R$ 600,00 no Nubank com limite de R$ 10.000,00:
      <br>
      • <strong>Mês 1:</strong> O limite utilizado é R$ 6.000,00 e o limite livre é R$ 4.000,00. A fatura do mês é R$ 600,00.
      <br>
      • <strong>Ao longo do tempo:</strong> Conforme cada mês é pago, R$ 600,00 são liberados de volta ao limite disponível até a liquidação completa da 10ª parcela.
    </p>
  </div>

  <h2>3.3 Algoritmo de Projeção Preditiva de 18 Meses</h2>
  <p>
    O sistema projeta a linha do tempo financeira dos próximos 18 meses consecutivos (<em>t = 0 até 17 meses</em>). Para cada mês futuro ($M_t$):
  </p>
  <ol>
    <li>Calcula o somatório de todas as parcelas ativas naquele horizonte temporal.</li>
    <li>Gera a lista discriminada de produtos e itens que compõem o valor previsto.</li>
    <li>Identifica o <code>latestEndMonth</code> (a data do último vencimento programado no sistema).</li>
    <li>
      Calcula a métrica <code>monthsUntilFree</code>:
      <div class="formula-box" style="margin: 6px 0;">
        Meses Para Liberdade = (Y_ultimo * 12 + M_ultimo) - (Y_atual * 12 + M_atual) + 1
      </div>
    </li>
    <li>Exibe a data exata em que 100% dos limites estarão desonerados de qualquer carnê.</li>
  </ol>

  <div class="page-break"></div>

  <!-- =========================================================================
       SEÇÃO 4: ASSISTENTE WHATSAPP & PROCESSAMENTO DE LINGUAGEM NATURAL
       ========================================================================= -->
  <h1><span class="sec-number">4</span> Assistente WhatsApp & Parser NLP</h1>

  <p>
    O módulo <code>whatsapp-service.js</code> conecta o sistema diretamente ao protocolo do WhatsApp usando a biblioteca Baileys, viabilizando o gerenciamento financeiro conversacional direto pelo smartphone.
  </p>

  <h2>4.1 Ciclo de Conexão & Sessão Persistente</h2>
  <div class="grid-2 avoid-break">
    <div class="card">
      <h3 style="margin-top:0;">Geração do QR Code</h3>
      <p style="font-size: 9pt;">
        Ao clicar em "Gerar QR Code", o serviço inicializa um socket temporário e emite um evento com o Payload Base64 do QR Code, permitindo o pareamento seguro do aparelho via "Aparelhos Conectados".
      </p>
    </div>
    <div class="card">
      <h3 style="margin-top:0;">Persistência Multi-Arquivos</h3>
      <p style="font-size: 9pt;">
        As chaves criptográficas da sessão são salvas no diretório <code>data/auth_info_baileys/</code>. Quando o servidor reinicia, ele detecta a sessão existente e reconecta instantaneamente de forma autônoma.
      </p>
    </div>
  </div>

  <h2>4.2 Camada de Proteção: Anti-Loop & Anti-Spam</h2>
  <p>
    Ambientes corporativos e grupos de WhatsApp frequentemente recebem mensagens indesejadas. O sistema conta com filtros rigorosos para garantir que nenhuma movimentação espúria seja lançada:
  </p>
  <ul>
    <li>
      <strong>Filtro de Anúncios e Links (GUARD 0):</strong> Mensagens que contenham links (<code>http://</code>, <code>https://</code>, <code>meli.la</code>) ou palavras-chave promocionais (<em>cupom, oferta, promoção, estoque, compre aqui</em>) são imediatamente descartadas com a ação <code>IGNORED_PROMO</code>.
    </li>
    <li>
      <strong>Prevenção de Eco (Anti-Loop):</strong> Identificadores de mensagens enviadas pelo próprio robô (<code>sentByBotMessageIds</code>) são armazenados em memória e ignorados para prevenir loops recursivos infinitos.
    </li>
  </ul>

  <h2>4.3 Padrões de Linguagem Natural Suportados</h2>
  <table class="avoid-break">
    <thead>
      <tr>
        <th style="width: 22%;">Comando / Exemplo</th>
        <th style="width: 28%;">Entidades Extraídas</th>
        <th>Comportamento do Sistema</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><code>"comprei celular 2400 em 10x no nubank"</code></td>
        <td>
          <span class="tag tag-blue">Item: Celular</span><br>
          <span class="tag tag-purple">Valor: 2.400,00</span><br>
          <span class="tag tag-orange">10x R$ 240,00</span><br>
          <span class="tag tag-green">Cartão: Nubank</span>
        </td>
        <td>
          Cria o parcelamento em <code>installments</code> (10 meses), lança a 1ª parcela em <code>transactions</code>, compromete o limite do Nubank e responde com a data prevista de término da fatura.
        </td>
      </tr>
      <tr>
        <td><code>"recebi 4500 de salário"</code> ou <code>"freela 800"</code></td>
        <td>
          <span class="tag tag-green">Tipo: INCOME</span><br>
          <span class="tag tag-blue">Categoria: Renda/Salário</span>
        </td>
        <td>
          Credita o valor imediatamente no Saldo Geral da Conta (<code>account_balance</code>), gera a transação de entrada e confirma o novo saldo disponível.
        </td>
      </tr>
      <tr>
        <td><code>"almoço 38 no pix"</code> ou <code>"gastei 150 mercado"</code></td>
        <td>
          <span class="tag tag-orange">Tipo: EXPENSE</span><br>
          <span class="tag tag-purple">Método: PIX / Débito</span>
        </td>
        <td>
          Lança a despesa à vista em <code>transactions</code>, debita o saldo da conta corrente e notifica a interface web via SSE.
        </td>
      </tr>
      <tr>
        <td><code>"quando acaba minha fatura?"</code></td>
        <td>
          <span class="tag tag-blue">Query: Projeção</span>
        </td>
        <td>
          Calcula a simulação preditiva e envia a lista de itens parcelados restantes, número de meses faltantes e data final de quitação.
        </td>
      </tr>
      <tr>
        <td><code>"qual meu saldo?"</code></td>
        <td>
          <span class="tag tag-green">Query: Resumo</span>
        </td>
        <td>
          Gera relatório instantâneo com saldo bancário, receitas e despesas acumuladas no mês vigente e limite livre em cartões.
        </td>
      </tr>
    </tbody>
  </table>

  <div class="page-break"></div>

  <!-- =========================================================================
       SEÇÃO 5: MOTOR DE WORKFLOWS & WEBHOOKS (FINFLOW ENGINE)
       ========================================================================= -->
  <h1><span class="sec-number">5</span> Motor de Workflows & Webhooks (FinFlow Engine)</h1>

  <p>
    Além da operação manual e via WhatsApp, o sistema incorpora o motor de fluxos <strong>FinFlow Engine</strong> (baseado no arquivo <code>data/workflow.json</code> e na interface visual em <code>public/js/canvas.js</code>), permitindo automações baseadas em eventos externos.
  </p>

  <h2>5.1 Nós do Fluxo Operacional</h2>
  <div class="card avoid-break">
    <div class="flow-step">
      <div class="step-circle" style="background: var(--purple);">A</div>
      <div class="step-content">
        <strong>Nó Gatilho: Webhook Financeiro (Trigger)</strong>
        <p style="font-size: 9pt; margin-bottom: 2px;">
          Escuta requisições HTTP POST no endpoint <code>/api/webhook/whatsapp</code> com validação de autenticação Bearer Token (<code>secret_fin_token_2026</code>). Processa eventos de pagamentos instantâneos (ex: <code>pix.recebido</code>).
        </p>
      </div>
    </div>
    <div class="flow-step">
      <div class="step-circle" style="background: var(--warning);">B</div>
      <div class="step-content">
        <strong>Nó Condicional (Router / Filter)</strong>
        <p style="font-size: 9pt; margin-bottom: 2px;">
          Avalia regras lógicas configuráveis sobre o payload recebido (ex: <code>payload.valor &ge; 50.00</code>). Encaminha o fluxo para ramificações distintas com base no cumprimento da condição.
        </p>
      </div>
    </div>
    <div class="flow-step">
      <div class="step-circle" style="background: var(--accent);">C</div>
      <div class="step-content">
        <strong>Nó de Ação: Conciliação Financeira</strong>
        <p style="font-size: 9pt; margin-bottom: 2px;">
          Lança automaticamente a transação de crédito ou liquidação na conta bancária corporativa de destino, definindo a categoria contábil e a liquidação automática (<code>autoCompensar = true</code>).
        </p>
      </div>
    </div>
    <div class="flow-step">
      <div class="step-circle" style="background: var(--primary);">D</div>
      <div class="step-content">
        <strong>Nós Complementares: Notificação & Emissão Fiscal</strong>
        <p style="font-size: 9pt; margin-bottom: 2px;">
          Envia mensagens formatadas para canais de equipe (WhatsApp / Slack) e aciona módulos de emissão de recibo ou NFS-e de serviços com alíquota parametrizada.
        </p>
      </div>
    </div>
  </div>

  <h2>5.2 Comunicação em Tempo Real via Server-Sent Events (SSE)</h2>
  <p>
    Todas as ações realizadas por webhooks, mensagens de WhatsApp ou alterações manuais no banco de dados disparam a função interna <code>broadcastSSE(type, data)</code>.
  </p>
  <p>
    Os navegadores conectados ao sistema mantêm um canal SSE aberto permanente em <code>GET /api/events</code>. No instante em que uma transação ocorre:
  </p>
  <ul>
    <li>O evento <code>financial-updated</code> envia as novas métricas e refaz os gráficos da tela instantaneamente, sem necessidade de recarregar a página (F5).</li>
    <li>O evento <code>chat-message</code> atualiza a janela de chat ao vivo do painel.</li>
    <li>O evento <code>whatsapp-status-changed</code> sinaliza conexão, desconexão ou novo QR code em tempo real.</li>
  </ul>

  <div class="page-break"></div>

  <!-- =========================================================================
       SEÇÃO 6: SEGURANÇA, CONTAS A PAGAR & BACKUP
       ========================================================================= -->
  <h1><span class="sec-number">6</span> Contas, Segurança & Governança de Backups</h1>

  <h2>6.1 Gestão de Contas a Pagar e Receber (Bills)</h2>
  <p>
    A tabela <code>bills</code> gerencia a solvência financeira de curto e médio prazo:
  </p>
  <ul>
    <li>
      <strong>Status de Liquidação:</strong> Cada conta possui o atributo <code>is_paid</code>. Ao ser marcada como paga/recebida, o sistema realiza a compensação direta do saldo.
    </li>
    <li>
      <strong>Ações em Lote:</strong> O sistema implementa as operações <code>payAllBills()</code> e <code>receiveAllBills()</code> para quitação ou recebimento em massa de todos os compromissos pendentes com um único clique.
    </li>
  </ul>

  <h2>6.2 Segurança & Row Level Security (RLS)</h2>
  <p>
    No Supabase PostgreSQL, todas as tabelas contam com políticas de <strong>Row Level Security (RLS)</strong> ativadas. Isso impede acessos diretos não autorizados e assegura que somente a chave da aplicação devidamente parametrizada no <code>.env</code> consiga realizar operações de consulta e mutação.
  </p>

  <h2>6.3 Estratégia de Salvaguarda de Dados (Backups Automatizados)</h2>
  <p>
    O projeto dispõe de rotinas automatizadas para garantir que nenhum histórico financeiro seja perdido durante operações de manutenção:
  </p>

  <div class="card card-warning avoid-break">
    <h3 style="margin-top:0; color: #92400e;">📁 Estrutura do Diretório de Backups (<code>/backups</code>)</h3>
    <p style="font-size: 9pt;">
      • <strong>JSON Integral:</strong> Exporta todas as tabelas, inclusive históricos volumosos de chat com paginação automática que ultrapassa o limite padrão de 1.000 linhas da API.
      <br>
      • <strong>Script de Restauração SQL:</strong> Gera automaticamente um arquivo <code>.sql</code> com comandos <code>INSERT INTO</code> idempotentes (com <code>ON CONFLICT DO NOTHING</code>).
      <br>
      • <strong>Script de Restauração em 1 Comando:</strong> Executando <code>node scripts/restore-backup.js</code>, o sistema restaura integralmente a base na nuvem e o arquivo local em segundos.
    </p>
  </div>

  <div class="avoid-break" style="margin-top: 14px;">
    <h2>6.4 Resumo de Comandos Operacionais</h2>
    <table>
      <thead>
        <tr>
          <th style="width: 35%;">Comando</th>
          <th>Finalidade</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><code>npm start</code> ou <code>iniciar.bat</code></td>
          <td>Inicia o servidor Node.js na porta 3000 e abre a interface no navegador padrão.</td>
        </tr>
        <tr>
          <td><code>node scripts/backup-and-clean.js</code></td>
          <td>Gera backup completo de todas as tabelas e limpa a base de dados para novo ciclo de uso.</td>
        </tr>
        <tr>
          <td><code>node scripts/restore-backup.js</code></td>
          <td>Restaura todos os registros salvos do backup mais recente para o Supabase e JSON local.</td>
        </tr>
        <tr>
          <td><code>node scripts/generate-pdf.js</code></td>
          <td>Compila este manual e atualiza o arquivo PDF executivo.</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div style="margin-top: 30px; padding: 14px; border-top: 1px solid var(--border); text-align: center; font-size: 8pt; color: var(--text-muted);">
    <strong>Meu Assessor Financeiro • Manual de Arquitetura & Lógica do Sistema</strong><br>
    Documento gerado para auditoria técnica, governança operacional e treinamento de equipes • 2026
  </div>

</body>
</html>
`;

// Save HTML file
fs.writeFileSync(HTML_FILE, htmlContent, 'utf8');
console.log('✔ Arquivo HTML gerado em:', HTML_FILE);

// Look for browser executable
const candidates = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

let browserPath = candidates.find(p => fs.existsSync(p));

if (!browserPath) {
  console.warn('Nenhum executável do Edge ou Chrome encontrado para exportação direta de PDF.');
  process.exit(0);
}

try {
  const args = [
    '--headless',
    '--disable-gpu',
    '--run-all-compositor-stages-before-draw',
    '--no-pdf-header-footer',
    `--print-to-pdf=${PDF_FILE}`,
    HTML_FILE
  ];

  execFileSync(browserPath, args, { stdio: 'inherit' });

  if (fs.existsSync(PDF_FILE)) {
    const stats = fs.statSync(PDF_FILE);
    console.log(`✔ PDF GERADO COM SUCESSO!`);
    console.log(`📂 Caminho do PDF: ${PDF_FILE}`);
    console.log(`📊 Tamanho do arquivo: ${(stats.size / 1024).toFixed(1)} KB`);
  }
} catch (err) {
  console.error('Erro ao gerar o PDF via browser:', err.message);
}
