# 💈 BarberGold SaaS

> **Plataforma Mobile-First de Controle Financeiro, CRM e Gestão de Recorrência para Barbearias**

O **BarberGold** é um aplicativo web progressivo (PWA) de alto padrão, desenvolvido com um design luxuoso adotando a estética **Modern Dark & Gold** (Glassmorfismo). A aplicação foi pensada especificamente para rodar em dispositivos móveis como um app nativo, integrando um modelo de assinatura comercial síncrono (SaaS) completo.

---

## 📸 Identidade Visual & Design System

A interface do BarberGold foi desenhada para impressionar no primeiro contato, utilizando conceitos modernos de design:
* **Paleta de Cores**: Tons cinzas e carvão ultra-escuros (`#0a0a0c`) contrastando com gradientes de **Ouro Metálico vibrante** (`#d4af37`).
* **Glassmorfismo**: Cartões translúcidos com bordas douradas finas, desfoque de fundo (`backdrop-filter`) e sombreados profundos.
* **Micro-animações**: Transições de abas fluidas, efeitos de hover premium e alertas pulsantes em vermelho para capturar a atenção imediata.

---

## 🚀 Funcionalidades Principais

### 1. Painel Financeiro (Dashboard)
* **Gráficos Dinâmicos**: Histórico de receita em linha interativo utilizando a biblioteca Chart.js.
* **Métricas Reativas**: Faturamento bruto, comissões de barbeiros estimadas e volume de cortes reativos a filtros temporais (Diário, Semanal e Mensal).
* **Alertas CRM Integrados**: Notificações no topo do dashboard indicando o número de clientes ausentes há mais de 30 dias.

### 2. Agenda Digital & Lançamentos
* **Múltiplos Serviços por Atendimento**: Checklist dinâmico de serviços que substitui o dropdown padrão.
* **Soma Dinâmica com Valor Editável**: Soma automática do valor sugerido dos serviços selecionados, mantendo o campo 100% editável para permitir descontos ou combos manuais.
* **Distribuição de Popularidade Proporcional**: Se um combo com desconto é lançado, o BarberGold divide a receita proporcionalmente entre os serviços na aba de popularidade.

### 3. CRM Inteligente & Retenção WhatsApp
* **Indicadores de Recorrência (30 dias)**:
  * 🟢 **Em Dia**: Cliente realizou atendimento nos últimos 20 dias.
  * 🟡 **Atenção**: Cliente não visita a barbearia entre 21 e 30 dias.
  * 🔴 **Ausente/Sumido**: Cliente ausente há mais de 30 dias.
* **Recall Ativo via WhatsApp**: Perfis com status em vermelho exibem uma caixa de ação que abre uma conversa direta no WhatsApp com uma mensagem altamente amigável pré-preenchida contendo o nome do cliente.

### 4. Portal SaaS Comercial & Licenciamento (R$ 39,90/mês)
* **Tela de Bloqueio em Tela Cheia (Auth Gate)**: Bloqueia totalmente o acesso ao app até que o login ou cadastro seja efetuado.
* **Banco de Dados Multi-Tenant Isolado**: Toda a informação de clientes, comissões e agenda é isolada no LocalStorage pelo e-mail da barbearia (`barbergold_db_{email}`), prevenindo qualquer mistura ou vazamento de dados.
* **Aba de Assinatura Completa**: Exibe status da licença (Trial vs Premium Ativo vs Vencida), e-mail do proprietário e data de renovação.
* **Gateway Pix Copia e Cola**: Caixa de pagamento integrada para copiar o Pix da mensalidade de R$ 39,90 e botão para simulação e liberação automática de 30 dias de acesso premium.
* **Suspensão Rígida (Inadimplência)**: Se a assinatura expirar, tentativas de navegar para qualquer aba são bloqueadas, forçando o usuário a regularizar o pagamento.
* **Botão de Teste (Simulador de Bloqueio)**: Botão na aba de Ajustes que permite ao desenvolvedor ou administrador simular a expiração imediata do plano SaaS localmente para demonstração comercial.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5** & **CSS3 (Vanilla)**: Layout semântico com flexbox, grids, media queries avançadas e variáveis nativas.
* **Vanilla JavaScript (ES6)**: Lógica reativa, gerenciamento de estado e persistência local.
* **CDNs Integrados**:
  * [Lucide Icons](https://lucide.dev/) para ícones minimalistas e modernos.
  * [Chart.js](https://www.chartjs.org/) para a renderização de gráficos.
  * [Supabase JS Client](https://supabase.com/) pronto para sincronização de banco de dados na nuvem em produção.

---

## 💻 Instalação & Execução Local

Como o aplicativo é 100% estático e client-side, você pode executá-lo de forma imediata localmente.

### Passo 1: Clone o Repositório
```bash
git clone https://github.com/SEU_USUARIO/barbergold-saas.git
cd barbergold-saas
```

### Passo 2: Inicie o Servidor Estático
Com o Node.js instalado, você pode usar o `http-server` para rodar o app livre de caches locais de desenvolvimento:
```bash
npx http-server -p 8085 -c-1 -o
```
*O app será aberto automaticamente em `http://localhost:8085`.*

---

## ⚙️ Configurações do Administrador (SaaS)

No arquivo [app.js](file:///C:/Users/arthu/.gemini/antigravity/scratch/barbergold/app.js), você possui duas seções cruciais de configuração no topo do código:

### 1. Configurar Chave Pix para Receber Mensalidades
Substitua o código na linha 13 pelo Pix Copia e Cola gerado na sua conta bancária comercial:
```javascript
const PLATFORM_PIX_CODE = "00020126330014br.gov.bcb.pix...";
```

### 2. Sincronização Cloud (Supabase Ready)
Para salvar os dados em nuvem em vez de apenas no LocalStorage do aparelho do cliente, preencha as variáveis de credenciais Supabase:
```javascript
const SUPABASE_URL = "SUA_URL_DO_SUPABASE"; 
const SUPABASE_ANON_KEY = "SUA_CHAVE_ANON_DO_SUPABASE"; 
```
*Se deixadas em branco, o sistema executa automaticamente em **Modo Demo SaaS local**, salvando as credenciais e barbearias de teste no LocalStorage.*

---

## 📄 Licença

Este projeto é de uso pessoal e comercial sob a licença de software livre. Desenvolvido para transformar a gestão financeira de barbearias em uma experiência de alta tecnologia e luxo.
