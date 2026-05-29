/* ==========================================================================
   BARBERGOLD - LÓGICA PRINCIPAL (STATE MANAGEMENT & INTERFACES)
   ========================================================================== */

// --- CONFIGURAÇÃO SUPABASE SAAS (MENSALIDADE DE R$ 39,90) ---
// Quando as credenciais abaixo estiverem vazias, o app entra automaticamente em "MODO DEMO SAAS".
// O Modo Demo simula logins, cadastros de barbearias, concessão de 7 dias de trial e tela de bloqueio localmente!
const SUPABASE_URL = ""; 
const SUPABASE_ANON_KEY = ""; 

// --- CONFIGURAÇÃO DE RECEBIMENTO DO SAAS (MENSALIDADE R$ 39,90) ---
// Substitua o código abaixo pelo seu próprio código "Pix Copia e Cola" para receber direto em sua conta bancária:
const PLATFORM_PIX_CODE = "00020126330014br.gov.bcb.pix011170079756409520400005303986540539.905802BR5925Arthur Vitor Santos Sobra6009Sao Paulo62290525REC6A19E889E87DE6027116736304E787";

let supabaseClient = null;
let isSaaSDemoMode = true;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        isSaaSDemoMode = false;
        console.log("BarberGold SaaS: Conectado ao Supabase Cloud.");
    } catch (e) {
        console.error("Erro ao inicializar Supabase. Executando em Modo Demo.", e);
    }
} else {
    console.log("BarberGold SaaS: Executando em Modo Demo Local (Sem Chaves Supabase).");
}

// --- 1. ESTADO GLOBAL DA APLICAÇÃO ---
let state = {
    barbers: [],
    services: [],
    clients: [],
    appointments: []
};

// Estado da Sessão SaaS Comercial
let saasSession = null; // { email, shopName, status: 'trial'|'active'|'past_due', expiresAt }

// Configurações de Recorrência de CRM de Clientes
const RECURRENCE_LIMIT_DAYS = 30;
const ATTENTION_LIMIT_DAYS = 20;

// Navegação de data na página de Atendimentos
let currentSelectedDate = new Date();

// Instância global do gráfico
let revenueChartInstance = null;

// --- 2. DADOS DE EXEMPLO (MOCK DATA INICIAL) ---
const INITIAL_MOCK_DATA = {
    barbers: [
        { id: "b1", name: "Bruno Costa", commission: 50 },
        { id: "b2", name: "Carlos Souza", commission: 45 },
        { id: "b3", name: "Arthur Diniz", commission: 50 }
    ],
    services: [
        { id: "s1", name: "Corte Masculino", price: 40.00 },
        { id: "s2", name: "Barba Terapia", price: 30.00 },
        { id: "s3", name: "Combo Cabelo + Barba", price: 60.00 },
        { id: "s4", name: "Sobrancelha Navalha", price: 15.00 }
    ],
    clients: [
        { id: "c1", name: "Roberto Silva", phone: "5511999999999", preferredBarberId: "b1", createdAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "c2", name: "Lucas Ferreira", phone: "5511988888888", preferredBarberId: "b2", createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "c3", name: "André Santos", phone: "5511977777777", preferredBarberId: "b1", createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "c4", name: "Marcos Oliveira", phone: "5511966666666", preferredBarberId: "b3", createdAt: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "c5", name: "Júlio César", phone: "5511955555555", preferredBarberId: "b3", createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString() },
        { id: "c6", name: "Felipe Melo", phone: "5511944444444", preferredBarberId: "b2", createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
    ],
    appointments: []
};

// Gerador de histórico realista para os últimos 35 dias
function generateMockHistory() {
    const appointments = [];
    const clients = INITIAL_MOCK_DATA.clients;
    const barbers = INITIAL_MOCK_DATA.barbers;
    const services = INITIAL_MOCK_DATA.services;
    
    // Distribuição de cortes nos últimos 35 dias
    // Gerar alguns atendimentos realistas
    let apptIdCounter = 1;
    const now = new Date();

    // 1. Clientes "Sumidos" (último corte há mais de 30 dias)
    // Marcos Oliveira (c4) - cortou há 42 dias
    appointments.push(createMockAppt(`a_${apptIdCounter++}`, "c4", "b3", "s3", 42)); // Combo 
    
    // André Santos (c3) - cortou há 32 dias
    appointments.push(createMockAppt(`a_${apptIdCounter++}`, "c3", "b1", "s1", 32)); // Corte

    // 2. Clientes em "Atenção" (entre 20 e 30 dias)
    // Lucas Ferreira (c2) - cortou há 24 dias
    appointments.push(createMockAppt(`a_${apptIdCounter++}`, "c2", "b2", "s1", 24)); // Corte

    // 3. Clientes "Em Dia" (nos últimos 20 dias)
    // Roberto Silva (c1) - cortou há 8 dias e também há 35 dias
    appointments.push(createMockAppt(`a_${apptIdCounter++}`, "c1", "b1", "s3", 8));
    appointments.push(createMockAppt(`a_${apptIdCounter++}`, "c1", "b1", "s1", 35));
    
    // Júlio César (c5) - cortou há 10 dias
    appointments.push(createMockAppt(`a_${apptIdCounter++}`, "c5", "b3", "s1", 10));
    
    // Felipe Melo (c6) - cortou há 4 dias
    appointments.push(createMockAppt(`a_${apptIdCounter++}`, "c6", "b2", "s2", 4));

    // 4. Atendimentos avulsos de clientes passados/antigos para preencher o faturamento dos dias anteriores
    for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
        // Pular alguns dias para simular folga (ex: domingos/segundas)
        const dateObj = new Date(now.getTime() - dayOffset * 24 * 60 * 60 * 1000);
        const dayOfWeek = dateObj.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 1) continue; // Sem cortes dom/seg
        
        // Número de cortes no dia (2 a 5 cortes)
        const dailyCutsCount = Math.floor(Math.random() * 4) + 2;
        for (let j = 0; j < dailyCutsCount; j++) {
            const randomClient = clients[Math.floor(Math.random() * clients.length)];
            const randomBarber = barbers[Math.floor(Math.random() * barbers.length)];
            const randomService = services[Math.floor(Math.random() * services.length)];
            
            // Não duplicar cortes dos mesmos clientes principais muito próximos
            appointments.push(createMockAppt(`a_${apptIdCounter++}`, randomClient.id, randomBarber.id, randomService.id, dayOffset));
        }
    }

    // Ordenar atendimentos por data (crescente)
    appointments.sort((a, b) => new Date(a.date) - new Date(b.date));
    return appointments;
}

function createMockAppt(id, clientId, barberId, serviceId, dayOffset) {
    const service = INITIAL_MOCK_DATA.services.find(s => s.id === serviceId);
    const barber = INITIAL_MOCK_DATA.barbers.find(b => b.id === barberId);
    
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - dayOffset);
    // Definir horário comercial aleatório (9h às 19h)
    targetDate.setHours(9 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 4) * 15, 0, 0);

    const price = service.price;
    const commissionAmount = parseFloat(((price * barber.commission) / 100).toFixed(2));

    return {
        id,
        clientId,
        barberId,
        serviceId,
        serviceName: service.name,
        price,
        date: targetDate.toISOString(),
        commissionAmount
    };
}

// --- 3. PERSISTÊNCIA & INICIALIZAÇÃO SAAS ---
function loadData() {
    if (!saasSession) return;
    
    // Cada barbearia tem seu próprio banco de dados isolado no LocalStorage pelo seu email!
    const userDbKey = `barbergold_db_${saasSession.email}`;
    const savedData = localStorage.getItem(userDbKey);
    
    if (savedData) {
        try {
            state = JSON.parse(savedData);
        } catch (e) {
            console.error("Erro ao carregar dados locais, reiniciando...", e);
            initDefaultData();
        }
    } else {
        initDefaultData();
    }
}

function saveData() {
    if (!saasSession) return;
    const userDbKey = `barbergold_db_${saasSession.email}`;
    localStorage.setItem(userDbKey, JSON.stringify(state));
    
    // Se o Supabase estiver ativo, sincroniza em tempo real com o servidor na nuvem
    if (supabaseClient) {
        syncToCloud();
    }
}

function initDefaultData() {
    state.barbers = [...INITIAL_MOCK_DATA.barbers];
    state.services = [...INITIAL_MOCK_DATA.services];
    state.clients = [...INITIAL_MOCK_DATA.clients];
    state.appointments = generateMockHistory();
    saveData();
}

// Sincronização na nuvem (Simulado ou Real Supabase)
function syncToCloud() {
    if (isSaaSDemoMode) return;
    // Aqui estaria a chamada real de UPSERT do Supabase para sincronizar as tabelas online:
    // supabase.from('barber_data').upsert({ user_id: supabase.auth.user().id, data: state })
    console.log("BarberGold Cloud: Sincronizando dados locais com o Supabase...");
}

// --- 4. DATA HELPERS ---
function getClientCRMStatus(clientId) {
    const clientAppts = state.appointments.filter(a => a.clientId === clientId);
    if (clientAppts.length === 0) {
        return { status: "missing", text: "Sem Visitas", days: 999, class: "badge-red" };
    }
    
    // Achar data do atendimento mais recente
    const dates = clientAppts.map(a => new Date(a.date).getTime());
    const lastVisitTime = Math.max(...dates);
    const diffTime = Date.now() - lastVisitTime;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > RECURRENCE_LIMIT_DAYS) {
        return { status: "missing", text: "Sumido", days: diffDays, class: "badge-red" };
    } else if (diffDays > ATTENTION_LIMIT_DAYS) {
        return { status: "warning", text: "Atenção", days: diffDays, class: "badge-yellow" };
    } else {
        return { status: "active", text: "Em Dia", days: diffDays, class: "badge-green" };
    }
}

function getStartOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
}

function getStartOfWeek() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Segunda como início
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

function getStartOfMonth() {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
}

// --- 5. NAVEGAÇÃO SPA ---
document.querySelectorAll(".nav-item").forEach(button => {
    button.addEventListener("click", (e) => {
        const targetTabId = button.getAttribute("data-target");
        
        // Se a barbearia estiver expirada, bloqueia o clique nas outras abas
        if (saasSession) {
            const expirationTime = new Date(saasSession.expiresAt).getTime();
            const isExpired = Date.now() > expirationTime;
            const isPastDue = saasSession.status === "past_due";
            
            if ((isExpired || isPastDue) && targetTabId !== "page-subscription") {
                alert("Acesso Restrito! A mensalidade da sua barbearia está vencida. Efetue o pagamento Pix na aba Assinatura para liberar o sistema.");
                
                // Forçar seleção e renderização da aba Assinatura
                document.querySelectorAll(".nav-item").forEach(btn => {
                    if (btn.getAttribute("data-target") === "page-subscription") btn.classList.add("active");
                    else btn.classList.remove("active");
                });
                document.querySelectorAll(".page-tab").forEach(page => {
                    if (page.id === "page-subscription") page.classList.add("active");
                    else page.classList.remove("active");
                });
                renderSubscriptionTab();
                return;
            }
        }

        // Ativar nav-item
        document.querySelectorAll(".nav-item").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        
        // Ativar tab page
        document.querySelectorAll(".page-tab").forEach(page => page.classList.remove("active"));
        const targetPage = document.getElementById(targetTabId);
        targetPage.classList.add("active");

        // Rolar para o topo
        window.scrollTo(0, 0);

        // Lógica de renderização específica
        if (targetTabId === "page-dashboard") {
            renderDashboard();
        } else if (targetTabId === "page-appointments") {
            renderAppointments();
        } else if (targetTabId === "page-clients") {
            renderClients();
        } else if (targetTabId === "page-subscription") {
            renderSubscriptionTab();
        } else if (targetTabId === "page-settings") {
            renderSettings();
        }
    });
});

// --- 6. RENDERIZADOR: TELA PAINEL (DASHBOARD) ---
let currentPeriod = "daily";

document.querySelectorAll("[data-period]").forEach(btn => {
    btn.addEventListener("click", (e) => {
        document.querySelectorAll("[data-period]").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentPeriod = btn.getAttribute("data-period");
        renderDashboard();
    });
});

function renderDashboard() {
    const now = new Date();
    let filteredAppts = [];
    let prevPeriodAppts = []; // Para cálculo de tendências
    let periodTitle = "";

    // 1. Filtrar atendimentos por período
    if (currentPeriod === "daily") {
        const todayStart = getStartOfToday().getTime();
        filteredAppts = state.appointments.filter(a => new Date(a.date).getTime() >= todayStart);
        
        // Ontem (período anterior)
        const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
        prevPeriodAppts = state.appointments.filter(a => {
            const time = new Date(a.date).getTime();
            return time >= yesterdayStart && time < todayStart;
        });
        periodTitle = "Hoje comparado a ontem";
    } else if (currentPeriod === "weekly") {
        const weekStart = getStartOfWeek().getTime();
        filteredAppts = state.appointments.filter(a => new Date(a.date).getTime() >= weekStart);
        
        // Semana passada
        const lastWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
        prevPeriodAppts = state.appointments.filter(a => {
            const time = new Date(a.date).getTime();
            return time >= lastWeekStart && time < weekStart;
        });
        periodTitle = "Esta semana vs semana anterior";
    } else if (currentPeriod === "monthly") {
        const monthStart = getStartOfMonth().getTime();
        filteredAppts = state.appointments.filter(a => new Date(a.date).getTime() >= monthStart);
        
        // Mês passado
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
        prevPeriodAppts = state.appointments.filter(a => {
            const time = new Date(a.date).getTime();
            return time >= lastMonthStart && time < monthStart;
        });
        periodTitle = "Este mês vs mês anterior";
    }

    // 2. Calcular Métricas
    const revenue = filteredAppts.reduce((sum, a) => sum + a.price, 0);
    const servicesCount = filteredAppts.length;
    const commissions = filteredAppts.reduce((sum, a) => sum + a.commissionAmount, 0);

    const prevRevenue = prevPeriodAppts.reduce((sum, a) => sum + a.price, 0);
    const prevServicesCount = prevPeriodAppts.length;

    // Atualizar UI de Métricas
    document.getElementById("metric-revenue").textContent = formatCurrency(revenue);
    document.getElementById("metric-services").textContent = servicesCount;
    document.getElementById("metric-commission").textContent = formatCurrency(commissions);

    // Calcular Tendências
    renderTrend("metric-revenue-change", revenue, prevRevenue, "receita");
    renderTrend("metric-services-change", servicesCount, prevServicesCount, "cortes");

    // 3. Atualizar Alertas de CRM (Clientes Sumidos)
    const missingClients = state.clients.filter(c => getClientCRMStatus(c.id).status === "missing");
    const crmWidget = document.getElementById("crm-missing-widget");
    
    if (missingClients.length > 0) {
        crmWidget.style.display = "block";
        document.getElementById("crm-missing-count").textContent = `${missingClients.length} clientes cadastrados não cortam há 30+ dias!`;
    } else {
        crmWidget.style.display = "none";
    }

    // Ação do Widget CRM
    document.getElementById("btn-go-to-missing").onclick = () => {
        const clientNavBtn = document.querySelector('[data-target="page-clients"]');
        clientNavBtn.click();
        
        // Ativar filtro "Sumidos"
        const missingChip = document.querySelector('[data-filter="missing"]');
        if (missingChip) missingChip.click();
    };

    // 4. Renderizar Gráfico
    renderRevenueChart(currentPeriod);

    // 5. Renderizar Serviços Populares
    renderPopularServices(filteredAppts);
}

function formatCurrency(val) {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);
}

function renderTrend(elementId, current, previous, type) {
    const el = document.getElementById(elementId);
    if (previous === 0) {
        el.className = "metric-trend up";
        el.innerHTML = `<i data-lucide="trending-up" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> Novo Período`;
        lucide.createIcons();
        return;
    }

    const percent = Math.round(((current - previous) / previous) * 100);
    
    if (percent >= 0) {
        el.className = "metric-trend up";
        el.innerHTML = `<i data-lucide="trending-up" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> +${percent}% vs anterior`;
    } else {
        el.className = "metric-trend down";
        el.innerHTML = `<i data-lucide="trending-down" style="width:12px;height:12px;display:inline-block;vertical-align:middle;margin-right:2px;"></i> ${percent}% vs anterior`;
    }
    lucide.createIcons();
}

function renderPopularServices(appts) {
    const listEl = document.getElementById("popular-services-list");
    if (appts.length === 0) {
        listEl.innerHTML = `<div class="empty-state">Nenhum atendimento no período.</div>`;
        return;
    }

    // Agrupar e somar por serviço individual
    const popularMap = {};
    appts.forEach(a => {
        // Obter os IDs de serviços individuais (novo formato) ou gerar do serviço legado
        const serviceIds = a.serviceIds || (a.serviceId ? [a.serviceId] : []);
        
        serviceIds.forEach(sId => {
            const service = state.services.find(s => s.id === sId);
            if (service) {
                if (!popularMap[service.name]) {
                    popularMap[service.name] = { count: 0, total: 0 };
                }
                popularMap[service.name].count++;
                
                // Divisão proporcional do valor cobrado
                let proportionPrice = service.price;
                if (a.serviceIds && a.serviceIds.length > 1) {
                    const totalSuggested = a.serviceIds.reduce((sum, id) => {
                        const s = state.services.find(item => item.id === id);
                        return sum + (s ? s.price : 0);
                    }, 0);
                    if (totalSuggested > 0) {
                        proportionPrice = (service.price / totalSuggested) * a.price;
                    }
                } else {
                    proportionPrice = a.price; // Lançamento único recebe o valor integral pago
                }
                
                popularMap[service.name].total += parseFloat(proportionPrice.toFixed(2));
            }
        });
    });

    // Ordenar por volume de vendas
    const sorted = Object.keys(popularMap)
        .map(key => ({ name: key, ...popularMap[key] }))
        .sort((a, b) => b.count - a.count);

    listEl.innerHTML = sorted.map(item => `
        <div class="popular-item">
            <div class="pop-service-info">
                <span class="pop-service-name">${item.name}</span>
                <span class="pop-service-count">${item.count} vezes realizado</span>
            </div>
            <span class="pop-service-amount">${formatCurrency(item.total)}</span>
        </div>
    `).join("");
}

// --- 7. LOGIC DE GRÁFICOS (CHART.JS) ---
function renderRevenueChart(period) {
    const ctx = document.getElementById("revenueChart").getContext("2d");
    
    // Destruir gráfico existente se houver
    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    let labels = [];
    let data = [];
    const now = new Date();

    if (period === "daily") {
        // Agrupar faturamento de hoje por faixas de horário (08h às 20h)
        labels = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00"];
        data = Array(7).fill(0);
        
        const todayStart = getStartOfToday().getTime();
        const todayAppts = state.appointments.filter(a => new Date(a.date).getTime() >= todayStart);

        todayAppts.forEach(a => {
            const hour = new Date(a.date).getHours();
            if (hour < 9) data[0] += a.price;
            else if (hour < 11) data[1] += a.price;
            else if (hour < 13) data[2] += a.price;
            else if (hour < 15) data[3] += a.price;
            else if (hour < 17) data[4] += a.price;
            else if (hour < 19) data[5] += a.price;
            else data[6] += a.price;
        });

    } else if (period === "weekly") {
        // Mostrar faturamento dos últimos 7 dias
        labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
        data = Array(7).fill(0);
        
        const weekStart = getStartOfWeek();
        
        // Mapear atendimentos
        state.appointments.forEach(a => {
            const aDate = new Date(a.date);
            const diffTime = aDate.getTime() - weekStart.getTime();
            if (diffTime >= 0 && diffTime < 7 * 24 * 60 * 60 * 1000) {
                let dayIndex = aDate.getDay() - 1; // 0 = Segunda, 5 = Sábado
                if (dayIndex === -1) dayIndex = 6; // Domingo
                data[dayIndex] += a.price;
            }
        });

    } else if (period === "monthly") {
        // Mostrar faturamento acumulado por semana do mês atual
        labels = ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"];
        data = Array(5).fill(0);
        
        const monthStart = getStartOfMonth();
        
        state.appointments.forEach(a => {
            const aDate = new Date(a.date);
            if (aDate.getMonth() === now.getMonth() && aDate.getFullYear() === now.getFullYear()) {
                const dayOfMonth = aDate.getDate();
                const weekIndex = Math.min(4, Math.floor((dayOfMonth - 1) / 7));
                data[weekIndex] += a.price;
            }
        });
    }

    // Criar gradiente dourado premium
    const goldGradient = ctx.createLinearGradient(0, 0, 0, 180);
    goldGradient.addColorStop(0, "rgba(212, 175, 55, 0.4)");
    goldGradient.addColorStop(1, "rgba(20, 20, 23, 0.0)");

    // Instanciar Chart.js
    revenueChartInstance = new Chart(ctx, {
        type: "line",
        data: {
            labels: labels,
            datasets: [{
                label: "Faturamento",
                data: data,
                borderColor: "#d4af37",
                borderWidth: 2,
                backgroundColor: goldGradient,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: "#f3e092",
                pointBorderColor: "#aa8010",
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: "rgba(20, 20, 23, 0.9)",
                    titleFont: { family: "Outfit", size: 12 },
                    bodyFont: { family: "Inter", size: 12 },
                    borderColor: "rgba(212, 175, 55, 0.3)",
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `Receita: ${formatCurrency(context.raw)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: "#9e9e9f", font: { family: "Inter", size: 10 } }
                },
                y: {
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: {
                        color: "#9e9e9f",
                        font: { family: "Inter", size: 10 },
                        callback: function(value) { return "R$ " + value; }
                    }
                }
            }
        }
    });
}

// --- 8. RENDERIZADOR: TELA ATENDIMENTOS ---
// Funções de navegação da data
document.getElementById("btn-prev-day").addEventListener("click", () => {
    currentSelectedDate.setDate(currentSelectedDate.getDate() - 1);
    renderAppointments();
});

document.getElementById("btn-next-day").addEventListener("click", () => {
    currentSelectedDate.setDate(currentSelectedDate.getDate() + 1);
    renderAppointments();
});

function renderAppointments() {
    // 1. Mostrar Data Corrente
    const dateDisplay = document.getElementById("date-display");
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    if (currentSelectedDate.toDateString() === today.toDateString()) {
        dateDisplay.textContent = "Hoje, " + currentSelectedDate.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    } else if (currentSelectedDate.toDateString() === yesterday.toDateString()) {
        dateDisplay.textContent = "Ontem, " + currentSelectedDate.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
    } else {
        dateDisplay.textContent = currentSelectedDate.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" });
    }

    // 2. Filtrar atendimentos do dia
    const startOfDay = new Date(currentSelectedDate.getTime());
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(currentSelectedDate.getTime());
    endOfDay.setHours(23, 59, 59, 999);

    const dayAppts = state.appointments.filter(a => {
        const time = new Date(a.date).getTime();
        return time >= startOfDay.getTime() && time <= endOfDay.getTime();
    });

    const container = document.getElementById("appointments-container");

    if (dayAppts.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="scissors" class="large-empty-icon"></i>
                <p>Nenhum serviço registrado neste dia.</p>
                <button class="btn-secondary" id="btn-quick-add" style="margin-top: 12px;">Registrar Primeiro</button>
            </div>
        `;
        lucide.createIcons();
        document.getElementById("btn-quick-add").onclick = () => openAppointmentModal();
        return;
    }

    // Ordenar por hora decrescente
    dayAppts.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = dayAppts.map(appt => {
        const client = state.clients.find(c => c.id === appt.clientId) || { name: "Cliente Deletado" };
        const barber = state.barbers.find(b => b.id === appt.barberId) || { name: "Sem Barbeiro" };
        const apptTime = new Date(appt.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        return `
            <div class="appointment-item glass-card">
                <div class="appt-client-info">
                    <div class="client-avatar">${client.name.substring(0, 1)}</div>
                    <div class="appt-details">
                        <span class="appt-client-name">${client.name}</span>
                        <span class="appt-service-tag">${appt.serviceName} • às ${apptTime}</span>
                        <span class="appt-barber-tag">Barbeiro: ${barber.name}</span>
                    </div>
                </div>
                <div class="appt-finance">
                    <span class="appt-value">${formatCurrency(appt.price)}</span>
                    <div class="appt-actions" style="display: flex; gap: 8px;">
                        <button class="btn-icon-gold" onclick="editAppointment('${appt.id}')" title="Editar Registro" style="background: transparent; border: none; color: var(--accent); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: var(--transition-quick);">
                            <i data-lucide="edit-3" style="width: 16px; height: 16px;"></i>
                        </button>
                        <button class="btn-icon-danger" onclick="deleteAppointment('${appt.id}')" title="Excluir Registro" style="background: transparent; border: none; color: var(--danger); cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; transition: var(--transition-quick);">
                            <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

function deleteAppointment(id) {
    if (confirm("Tem certeza que deseja excluir este atendimento permanentemente?")) {
        state.appointments = state.appointments.filter(a => a.id !== id);
        saveData();
        renderAppointments();
    }
}

// --- 9. RENDERIZADOR: TELA CLIENTES & CRM ---
let activeCRMFilter = "all";

document.querySelectorAll(".filter-chip").forEach(chip => {
    chip.addEventListener("click", () => {
        document.querySelectorAll(".filter-chip").forEach(c => c.classList.remove("active"));
        chip.classList.add("active");
        activeCRMFilter = chip.getAttribute("data-filter");
        renderClients();
    });
});

document.getElementById("client-search").addEventListener("input", () => {
    renderClients();
});

function renderClients() {
    const searchQuery = document.getElementById("client-search").value.toLowerCase();
    const container = document.getElementById("clients-container");

    // Filtrar por busca
    let filtered = state.clients.filter(c => 
        c.name.toLowerCase().includes(searchQuery) || 
        c.phone.includes(searchQuery)
    );

    // Filtrar por CRM Status
    filtered = filtered.filter(c => {
        const crm = getClientCRMStatus(c.id);
        if (activeCRMFilter === "all") return true;
        return crm.status === activeCRMFilter;
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i data-lucide="users" class="large-empty-icon"></i>
                <p>Nenhum cliente encontrado com os filtros aplicados.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Ordenar alfabeticamente
    filtered.sort((a, b) => a.name.localeCompare(b.name));

    container.innerHTML = filtered.map(client => {
        const crm = getClientCRMStatus(client.id);
        const preferredBarber = state.barbers.find(b => b.id === client.preferredBarberId);
        const prefText = preferredBarber ? ` • Prefere ${preferredBarber.name.split(" ")[0]}` : "";

        return `
            <div class="client-item-card glass-card" onclick="openClientDetailsModal('${client.id}')">
                <div class="client-list-info">
                    <div class="client-avatar">${client.name.substring(0, 1)}</div>
                    <div class="client-list-details">
                        <span class="client-list-name">${client.name}</span>
                        <span class="client-list-phone">${formatPhone(client.phone)}${prefText}</span>
                    </div>
                </div>
                <div class="client-crm-status">
                    <span class="badge-status ${crm.class}">
                        <span class="dot ${crm.status === 'active' ? 'dot-green' : crm.status === 'warning' ? 'dot-yellow' : 'dot-red'}"></span>
                        ${crm.text}
                    </span>
                    <i data-lucide="chevron-right" class="btn-arrow"></i>
                </div>
            </div>
        `;
    }).join("");

    lucide.createIcons();
}

function formatPhone(phone) {
    // Ex: 5511999999999 -> (11) 99999-9999
    if (phone.length === 13) {
        return `(${phone.substring(2, 4)}) ${phone.substring(4, 9)}-${phone.substring(9)}`;
    }
    return phone;
}

// --- 10. DETALHES DO CLIENTE & CRM ACTIONS ---
function openClientDetailsModal(clientId) {
    const client = state.clients.find(c => c.id === clientId);
    if (!client) return;

    const crm = getClientCRMStatus(clientId);
    const clientAppts = state.appointments.filter(a => a.clientId === clientId);
    const totalSpent = clientAppts.reduce((sum, a) => sum + a.price, 0);

    // Preencher modal
    document.getElementById("detail-avatar").textContent = client.name.substring(0, 1);
    document.getElementById("detail-name").textContent = client.name;
    document.getElementById("detail-phone").textContent = formatPhone(client.phone);

    // Badges
    const statusBadge = document.getElementById("detail-status-badge");
    statusBadge.textContent = crm.text;
    statusBadge.className = `badge-status-lg ${crm.class}`;

    const prefBarberBadge = document.getElementById("detail-pref-barber");
    const preferredBarber = state.barbers.find(b => b.id === client.preferredBarberId);
    if (preferredBarber) {
        prefBarberBadge.innerHTML = `<i data-lucide="scissors"></i> Preferido: ${preferredBarber.name.split(" ")[0]}`;
        prefBarberBadge.style.display = "inline-flex";
    } else {
        prefBarberBadge.style.display = "none";
    }

    // Stats
    document.getElementById("detail-total-visits").textContent = clientAppts.length;
    document.getElementById("detail-total-spent").textContent = formatCurrency(totalSpent);

    const lastVisitEl = document.getElementById("detail-last-visit");
    if (clientAppts.length === 0) {
        lastVisitEl.textContent = "Nunca";
    } else {
        lastVisitEl.textContent = crm.days === 0 ? "Hoje" : crm.days === 1 ? "Ontem" : `${crm.days} dias atrás`;
    }

    // Banner de Retenção WhatsApp
    const retentionBox = document.getElementById("crm-retention-container");
    if (crm.status === "missing") {
        retentionBox.style.display = "flex";
        
        // Configurar botão de recall WhatsApp
        const waButton = document.getElementById("btn-wa-recall");
        
        // Mensagem customizada e convidativa
        const clientFirstName = client.name.split(" ")[0];
        const messageText = `Olá ${clientFirstName}! Faz mais de um mês que você não passa aqui na barbearia para dar aquele tapa no visual. 💈 Que tal reservarmos um horário para você esta semana? Abraço!`;
        
        waButton.href = `https://api.whatsapp.com/send?phone=${client.phone}&text=${encodeURIComponent(messageText)}`;
    } else {
        retentionBox.style.display = "none";
    }

    // Renderizar Timeline de Visitas do Cliente
    const timelineContainer = document.getElementById("detail-timeline");
    if (clientAppts.length === 0) {
        timelineContainer.innerHTML = `<div class="empty-state">Sem atendimentos no histórico.</div>`;
    } else {
        // Ordenar decrescente
        clientAppts.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        timelineContainer.innerHTML = clientAppts.map(a => {
            const dateStr = new Date(a.date).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "2-digit" });
            const barber = state.barbers.find(b => b.id === a.barberId) || { name: "Equipe" };
            
            return `
                <div class="timeline-item">
                    <div class="timeline-dot"></div>
                    <div class="timeline-content">
                        <div class="pop-service-info">
                            <span class="timeline-title">${a.serviceName}</span>
                            <span class="timeline-barber">com ${barber.name.split(" ")[0]} • ${dateStr}</span>
                        </div>
                        <span class="timeline-price">${formatCurrency(a.price)}</span>
                    </div>
                </div>
            `;
        }).join("");
    }

    openModal("modal-client-details");
    lucide.createIcons();
}

// --- 11. RENDERIZADOR: TELA AJUSTES & CONFIGURAÇÕES ---
function renderSettings() {
    // 1. Renderizar Barbeiros
    const barbersContainer = document.getElementById("settings-barbers-container");
    barbersContainer.innerHTML = state.barbers.map(barber => {
        // Contar faturamento do barbeiro
        const appts = state.appointments.filter(a => a.barberId === barber.id);
        const commissionEarned = appts.reduce((sum, a) => sum + a.commissionAmount, 0);

        return `
            <div class="settings-item">
                <div class="settings-item-info">
                    <span class="settings-item-title">${barber.name}</span>
                    <span class="settings-item-sub">Comissão: ${barber.commission}% • Recebido: ${formatCurrency(commissionEarned)}</span>
                </div>
                <button class="btn-icon-danger" onclick="deleteBarber('${barber.id}')" title="Excluir Barbeiro">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
    }).join("");

    // 2. Renderizar Serviços
    const servicesContainer = document.getElementById("settings-services-container");
    servicesContainer.innerHTML = state.services.map(service => `
        <div class="settings-item">
            <div class="settings-item-info">
                <span class="settings-item-title">${service.name}</span>
                <span class="settings-item-sub">Preço Sugerido: ${formatCurrency(service.price)}</span>
            </div>
            <button class="btn-icon-danger" onclick="deleteService('${service.id}')" title="Excluir Serviço">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `).join("");

    lucide.createIcons();
}

function deleteBarber(id) {
    if (state.barbers.length <= 1) {
        alert("Você deve ter pelo menos um barbeiro cadastrado!");
        return;
    }
    if (confirm("Deseja mesmo excluir este barbeiro? Os atendimentos vinculados a ele continuarão no sistema, mas não será possível vinculá-lo a novos atendimentos.")) {
        state.barbers = state.barbers.filter(b => b.id !== id);
        saveData();
        renderSettings();
    }
}

function deleteService(id) {
    if (state.services.length <= 1) {
        alert("Você deve ter pelo menos um tipo de serviço cadastrado!");
        return;
    }
    if (confirm("Deseja mesmo excluir este serviço? Atendimentos antigos não serão apagados.")) {
        state.services = state.services.filter(s => s.id !== id);
        saveData();
        renderSettings();
    }
}

// --- 12. GESTÃO DE MODAIS E FORMULÁRIOS ---
function openModal(modalId) {
    document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}

// Fechamento genérico de modais ao clicar no overlay
document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
            closeModal(overlay.id);
        }
    });
});

// A) MODAL: NOVO ATENDIMENTO
function openAppointmentModal() {
    const clientSelect = document.getElementById("appt-client");
    const barberSelect = document.getElementById("appt-barber");
    const servicesContainer = document.getElementById("appt-services-container");

    // Limpar formulário
    document.getElementById("form-appointment").reset();
    document.getElementById("appt-id").value = "";

    // Resetar título e botão do modal
    document.getElementById("modal-appointment-title").textContent = "Registrar Atendimento";
    document.getElementById("btn-save-appt-modal").textContent = "Salvar Registro";

    // Popular Clientes (ordenados)
    const sortedClients = [...state.clients].sort((a, b) => a.name.localeCompare(b.name));
    clientSelect.innerHTML = '<option value="" disabled selected>Selecione o Cliente</option>' + 
        sortedClients.map(c => `<option value="${c.id}">${c.name}</option>`).join("");

    // Popular Barbeiros
    barberSelect.innerHTML = '<option value="" disabled selected>Selecione o Barbeiro</option>' + 
        state.barbers.map(b => `<option value="${b.id}">${b.name}</option>`).join("");

    // Popular checklist de Serviços
    servicesContainer.innerHTML = state.services.map(s => `
        <label class="service-checkbox-label">
            <div class="service-chk-info">
                <input type="checkbox" name="appt-services" value="${s.id}" data-price="${s.price}" data-name="${s.name}">
                <span>${s.name}</span>
            </div>
            <span class="service-chk-price">${formatCurrency(s.price)}</span>
        </label>
    `).join("");

    // Adicionar escuta de cliques nas checkboxes de serviços para somar o valor sugerido dinamicamente
    const checkboxes = servicesContainer.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(cb => {
        cb.addEventListener("change", () => {
            let totalSuggestedPrice = 0;
            checkboxes.forEach(chk => {
                if (chk.checked) {
                    totalSuggestedPrice += parseFloat(chk.dataset.price);
                }
            });
            document.getElementById("appt-price").value = totalSuggestedPrice > 0 ? totalSuggestedPrice.toFixed(2) : "";
        });
    });

    // Data Atual por padrão
    const now = new Date();
    // Corrigir fuso horário para input datetime-local
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById("appt-date").value = `${year}-${month}-${day}T${hours}:${minutes}`;

    openModal("modal-appointment");
}

// Auto-fill de barbeiro preferido quando o cliente é alterado
document.getElementById("appt-client").addEventListener("change", (e) => {
    const selectedClientId = e.target.value;
    const client = state.clients.find(c => c.id === selectedClientId);
    if (client && client.preferredBarberId) {
        document.getElementById("appt-barber").value = client.preferredBarberId;
    }
});

// Eventos de clique para abrir
document.getElementById("btn-new-appointment-top").addEventListener("click", () => openAppointmentModal());
document.getElementById("btn-new-appointment-fab").addEventListener("click", () => openAppointmentModal());
document.getElementById("btn-close-appt-modal").addEventListener("click", () => closeModal("modal-appointment"));
document.getElementById("btn-cancel-appt-modal").addEventListener("click", () => closeModal("modal-appointment"));

// Submissão do Atendimento
document.getElementById("form-appointment").addEventListener("submit", (e) => {
    e.preventDefault();

    const apptId = document.getElementById("appt-id").value;
    const clientId = document.getElementById("appt-client").value;
    const barberId = document.getElementById("appt-barber").value;
    const price = parseFloat(document.getElementById("appt-price").value);
    const dateVal = document.getElementById("appt-date").value;

    // Obter todos os serviços selecionados
    const checkedCheckboxes = Array.from(document.querySelectorAll('input[name="appt-services"]:checked'));

    if (!clientId || !barberId || checkedCheckboxes.length === 0 || isNaN(price) || !dateVal) {
        alert("Por favor, selecione o Cliente, o Barbeiro, pelo menos um Serviço e informe o valor!");
        return;
    }

    const serviceIds = checkedCheckboxes.map(chk => chk.value);
    const serviceNames = checkedCheckboxes.map(chk => chk.dataset.name).join(" + ");

    const barber = state.barbers.find(b => b.id === barberId);

    // Calcular comissão
    const commissionAmount = parseFloat(((price * barber.commission) / 100).toFixed(2));

    if (apptId) {
        // MODO EDICAO
        const apptIndex = state.appointments.findIndex(a => a.id === apptId);
        if (apptIndex !== -1) {
            state.appointments[apptIndex].clientId = clientId;
            state.appointments[apptIndex].barberId = barberId;
            state.appointments[apptIndex].serviceIds = serviceIds;
            state.appointments[apptIndex].serviceId = serviceIds[0];
            state.appointments[apptIndex].serviceName = serviceNames;
            state.appointments[apptIndex].price = price;
            state.appointments[apptIndex].date = new Date(dateVal).toISOString();
            state.appointments[apptIndex].commissionAmount = commissionAmount;
        }
    } else {
        // MODO CADASTRO NOVO
        const newAppt = {
            id: "appt_" + Date.now(),
            clientId,
            barberId,
            serviceIds,
            serviceId: serviceIds[0], // Compatibilidade para lançamentos antigos
            serviceName: serviceNames,
            price,
            date: new Date(dateVal).toISOString(),
            commissionAmount
        };
        state.appointments.push(newAppt);
    }

    saveData();
    closeModal("modal-appointment");

    // Sincronizar data para a data do corte para que o usuário possa ver o lançamento!
    currentSelectedDate = new Date(dateVal);
    
    // Atualizar visualizações
    renderAppointments();
    renderDashboard();
});

// Abertura do Modal de Atendimento em Modo Edição
function editAppointment(id) {
    const appt = state.appointments.find(a => a.id === id);
    if (!appt) return;

    // Abrir o modal primeiro para popular os dropdowns e checkboxes padrão
    openAppointmentModal();

    // Sobrescrever com os dados do atendimento selecionado para edição
    document.getElementById("appt-id").value = appt.id;
    document.getElementById("appt-client").value = appt.clientId;
    document.getElementById("appt-barber").value = appt.barberId;
    document.getElementById("appt-price").value = appt.price;

    // Marcar as checkboxes correspondentes aos serviços selecionados
    const servicesContainer = document.getElementById("appt-services-container");
    const checkboxes = servicesContainer.querySelectorAll('input[type="checkbox"]');
    
    // Desmarcar todas primeiro por garantia
    checkboxes.forEach(chk => chk.checked = false);

    // Marcar as que pertencem ao atendimento
    const serviceIds = appt.serviceIds || (appt.serviceId ? [appt.serviceId] : []);
    checkboxes.forEach(chk => {
        if (serviceIds.includes(chk.value)) {
            chk.checked = true;
        }
    });

    // Formatar a data para o input datetime-local
    const apptDate = new Date(appt.date);
    const year = apptDate.getFullYear();
    const month = String(apptDate.getMonth() + 1).padStart(2, '0');
    const day = String(apptDate.getDate()).padStart(2, '0');
    const hours = String(apptDate.getHours()).padStart(2, '0');
    const minutes = String(apptDate.getMinutes()).padStart(2, '0');
    document.getElementById("appt-date").value = `${year}-${month}-${day}T${hours}:${minutes}`;

    // Atualizar título do modal e botão de ação
    document.getElementById("modal-appointment-title").textContent = "Editar Atendimento";
    document.getElementById("btn-save-appt-modal").textContent = "Salvar Alterações";
}

// B) MODAL: NOVO CLIENTE
document.getElementById("btn-new-client").addEventListener("click", () => {
    document.getElementById("form-client").reset();
    
    // Popular barbeiros para o select do preferido
    const prefSelect = document.getElementById("client-preferred-barber");
    prefSelect.innerHTML = '<option value="">Nenhum</option>' + 
        state.barbers.map(b => `<option value="${b.id}">${b.name}</option>`).join("");

    openModal("modal-client");
});

document.getElementById("btn-close-client-modal").addEventListener("click", () => closeModal("modal-client"));
document.getElementById("btn-cancel-client-modal").addEventListener("click", () => closeModal("modal-client"));

document.getElementById("form-client").addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("client-name").value.trim();
    let phone = document.getElementById("client-phone").value.replace(/\D/g, ""); // Apenas números
    const preferredBarberId = document.getElementById("client-preferred-barber").value;

    if (!name || !phone) {
        alert("Preencha o nome e o celular!");
        return;
    }

    // Ajustar número com DDD e DDI brasileiro se necessário
    if (phone.length === 11) {
        phone = "55" + phone; // Inserir código de país
    } else if (phone.length === 9) {
        phone = "5511" + phone; // Inserir DDI e DDD padrão de SP por segurança
    } else if (phone.length < 9) {
        alert("Celular inválido! Digite com o DDD (ex: 11999999999)");
        return;
    }

    const newClient = {
        id: "c_" + Date.now(),
        name,
        phone,
        preferredBarberId: preferredBarberId || null,
        createdAt: new Date().toISOString()
    };

    state.clients.push(newClient);
    saveData();
    closeModal("modal-client");
    renderClients();
});

// C) MODAL: DETALHES DE CLIENTE
document.getElementById("btn-close-details-modal").addEventListener("click", () => closeModal("modal-client-details"));

// D) MODAL: ADICIONAR BARBEIRO
document.getElementById("btn-add-barber").addEventListener("click", () => {
    document.getElementById("form-barber").reset();
    openModal("modal-barber");
});
document.getElementById("btn-close-barber-modal").addEventListener("click", () => closeModal("modal-barber"));
document.getElementById("btn-cancel-barber-modal").addEventListener("click", () => closeModal("modal-barber"));

document.getElementById("form-barber").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("barber-name").value.trim();
    const commission = parseInt(document.getElementById("barber-commission").value);

    if (!name || isNaN(commission)) return;

    state.barbers.push({
        id: "b_" + Date.now(),
        name,
        commission
    });
    saveData();
    closeModal("modal-barber");
    renderSettings();
});

// E) MODAL: ADICIONAR SERVIÇO
document.getElementById("btn-add-service").addEventListener("click", () => {
    document.getElementById("form-service").reset();
    openModal("modal-service");
});
document.getElementById("btn-close-service-modal").addEventListener("click", () => closeModal("modal-service"));
document.getElementById("btn-cancel-service-modal").addEventListener("click", () => closeModal("modal-service"));

document.getElementById("form-service").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("service-name").value.trim();
    const price = parseFloat(document.getElementById("service-price").value);

    if (!name || isNaN(price)) return;

    state.services.push({
        id: "s_" + Date.now(),
        name,
        price
    });
    saveData();
    closeModal("modal-service");
    renderSettings();
});

// --- 13. IMPORTAÇÃO / EXPORTAÇÃO E BACKUP ---
// Exportação JSON
document.getElementById("btn-export-backup").addEventListener("click", () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    
    const dateStr = new Date().toLocaleDateString("pt-BR").replace(/\//g, "-");
    downloadAnchor.setAttribute("download", `barbergold_backup_${dateStr}.json`);
    
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
});

// Importação JSON
document.getElementById("btn-import-backup").addEventListener("change", (e) => {
    const fileReader = new FileReader();
    const file = e.target.files[0];
    if (!file) return;

    fileReader.onload = function(event) {
        try {
            const parsedData = JSON.parse(event.target.result);
            
            // Validação simples do formato
            if (parsedData.barbers && parsedData.services && parsedData.clients && parsedData.appointments) {
                if (confirm("Isso irá substituir todos os dados existentes no aplicativo pelos do arquivo de backup. Deseja continuar?")) {
                    state = parsedData;
                    saveData();
                    alert("Dados importados com sucesso! O aplicativo será recarregado.");
                    location.reload();
                }
            } else {
                alert("O arquivo JSON de backup selecionado é inválido ou está corrompido.");
            }
        } catch (err) {
            alert("Erro ao ler o arquivo selecionado. Verifique se ele é um backup JSON válido.");
        }
    };
    fileReader.readAsText(file);
});

// Reset do Banco de Dados
document.getElementById("btn-reset-db").addEventListener("click", () => {
    if (!saasSession) return;
    if (confirm("⚠️ CUIDADO! Isso irá apagar todos os clientes, barbeiros, atendimentos e configurações cadastrados nesta barbearia de forma permanente. Deseja prosseguir?")) {
        if (confirm("Tem certeza absoluta? Essa ação não pode ser desfeita!")) {
            const userDbKey = `barbergold_db_${saasSession.email}`;
            localStorage.removeItem(userDbKey);
            alert("Banco de dados da barbearia reiniciado.");
            location.reload();
        }
    }
});

// --- 13.1. PORTAL SAAS COMERCIAL (AUTENTICAÇÃO, CONTROLE DE MENSALIDADE & PAYWALL) ---

let isRegisteringSaaS = false;

// Alternar entre Login e Cadastro
document.getElementById("btn-toggle-saas-auth").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisteringSaaS = !isRegisteringSaaS;
    
    const titleEl = document.getElementById("saas-auth-title");
    const subtitleEl = document.getElementById("saas-auth-subtitle");
    const shopNameGroup = document.getElementById("group-saas-shop-name");
    const submitBtn = document.getElementById("btn-saas-auth-submit");
    const toggleText = document.getElementById("saas-toggle-text");
    const toggleBtn = document.getElementById("btn-toggle-saas-auth");

    if (isRegisteringSaaS) {
        titleEl.textContent = "Criar Conta SaaS";
        subtitleEl.textContent = "Cadastre sua barbearia e ganhe 7 dias grátis de acesso ilimitado.";
        shopNameGroup.style.display = "flex";
        document.getElementById("saas-shop-name").required = true;
        submitBtn.textContent = "Criar Conta & Iniciar Teste";
        toggleText.textContent = "Já possui cadastro comercial?";
        toggleBtn.textContent = "Entrar no Painel";
    } else {
        titleEl.textContent = "Acessar Painel";
        subtitleEl.textContent = "Entre com os dados da sua barbearia para continuar.";
        shopNameGroup.style.display = "none";
        document.getElementById("saas-shop-name").required = false;
        submitBtn.textContent = "Entrar no Sistema";
        toggleText.textContent = "Não tem uma conta comercial?";
        toggleBtn.textContent = "Cadastrar Barbearia";
    }
});

// Inicialização de Autenticação SaaS
function initSaaSAuth() {
    // 1. Carregar sessão persistida
    const savedSession = localStorage.getItem("barbergold_saas_session");
    if (savedSession) {
        try {
            saasSession = JSON.parse(savedSession);
            // Sincronizar sessão ativa com banco de contas locais
            syncDemoAccountStatus();
        } catch (e) {
            saasSession = null;
        }
    }

    // 2. Verificar licenciamento / assinatura
    checkSaaSSubscription();
}

// Sincronizar status da sessão com o banco de contas (no Modo Demo)
function syncDemoAccountStatus() {
    if (!isSaaSDemoMode) return;
    const accounts = JSON.parse(localStorage.getItem("barbergold_saas_accounts") || "[]");
    const currentAcc = accounts.find(acc => acc.email === saasSession.email);
    if (currentAcc) {
        saasSession.status = currentAcc.status;
        saasSession.expiresAt = currentAcc.expiresAt;
        saasSession.shopName = currentAcc.shopName;
        localStorage.setItem("barbergold_saas_session", JSON.stringify(saasSession));
    }
}

// Controle e validação de Paywall e Autenticação
function checkSaaSSubscription() {
    const authPage = document.getElementById("saas-auth-page");
    const mainApp = document.querySelector(".app-content");
    const navApp = document.querySelector(".app-navbar");
    const headerApp = document.querySelector(".app-header");

    if (!saasSession) {
        // A) NÃO LOGADO: Exibir tela de login/cadastro comercial em tela cheia
        authPage.classList.add("active");
        if (mainApp) mainApp.style.display = "none";
        if (navApp) navApp.style.display = "none";
        if (headerApp) headerApp.style.display = "none";
        return;
    }

    // Se estiver logado, exibir a estrutura da aplicação e ocultar tela de login
    authPage.classList.remove("active");
    if (mainApp) mainApp.style.display = "block";
    if (navApp) navApp.style.display = "flex";
    if (headerApp) headerApp.style.display = "flex";

    // Verificar se o período expirou (Trial ou Assinatura)
    const expirationTime = new Date(saasSession.expiresAt).getTime();
    const isExpired = Date.now() > expirationTime;
    const isPastDue = saasSession.status === "past_due";

    const paywallAlert = document.getElementById("saas-paywall-alert");

    if (isPastDue || isExpired) {
        // B) ASSINATURA VENCIDA: Exibir aviso do Paywall e travar na aba de Assinatura
        if (paywallAlert) paywallAlert.style.display = "block";
        
        // Garante que o banco de dados do usuário está carregado antes de travar
        loadData();

        // Forçar seleção e renderização da aba Assinatura
        document.querySelectorAll(".nav-item").forEach(btn => {
            if (btn.getAttribute("data-target") === "page-subscription") btn.classList.add("active");
            else btn.classList.remove("active");
        });
        document.querySelectorAll(".page-tab").forEach(page => {
            if (page.id === "page-subscription") page.classList.add("active");
            else page.classList.remove("active");
        });
        
        renderSubscriptionTab();
        lucide.createIcons();
    } else {
        // C) ASSINATURA ATIVA / EM DIA: Liberar acesso ao app!
        if (paywallAlert) paywallAlert.style.display = "none";
        
        // Carregar banco de dados da barbearia conectada
        loadData();
        
        // Renderizar a aba correspondente ativa
        const activeTabBtn = document.querySelector(".nav-item.active");
        const targetTabId = activeTabBtn ? activeTabBtn.getAttribute("data-target") : "page-dashboard";
        
        if (targetTabId === "page-dashboard") {
            renderDashboard();
        } else if (targetTabId === "page-appointments") {
            renderAppointments();
        } else if (targetTabId === "page-clients") {
            renderClients();
        } else if (targetTabId === "page-subscription") {
            renderSubscriptionTab();
        } else if (targetTabId === "page-settings") {
            renderSettings();
        }
        
        lucide.createIcons();
    }
}

// Renderizar os detalhes da aba Assinatura
function renderSubscriptionTab() {
    if (!saasSession) return;

    const planShopName = document.getElementById("saas-plan-shop-name");
    const planStatusBadge = document.getElementById("saas-plan-status-badge");
    const infoEmail = document.getElementById("saas-info-email");
    const infoExpires = document.getElementById("saas-info-expires");

    if (planShopName) planShopName.textContent = saasSession.shopName;
    if (infoEmail) infoEmail.textContent = saasSession.email;

    // Sincronizar o Pix Copia e Cola configurado na plataforma
    const pixInput = document.getElementById("pix-copy-input");
    if (pixInput) {
        pixInput.value = PLATFORM_PIX_CODE;
    }

    const expirationTime = new Date(saasSession.expiresAt).getTime();
    const isExpired = Date.now() > expirationTime;
    const isPastDue = saasSession.status === "past_due";

    if (infoExpires) {
        infoExpires.textContent = new Date(saasSession.expiresAt).toLocaleDateString("pt-BR");
    }

    if (planStatusBadge) {
        if (isPastDue || isExpired) {
            planStatusBadge.className = "badge-status-bar badge-red";
            planStatusBadge.style.backgroundColor = "rgba(255, 69, 58, 0.15)";
            planStatusBadge.style.color = "var(--danger)";
            planStatusBadge.style.border = "1px solid rgba(255, 69, 58, 0.3)";
            planStatusBadge.innerHTML = `<i data-lucide="shield-alert" style="width:12px; height:12px; margin-right:4px;"></i> Vencida`;
        } else if (saasSession.status === "trial") {
            planStatusBadge.className = "badge-status-bar badge-yellow";
            planStatusBadge.style.backgroundColor = "rgba(255, 159, 10, 0.15)";
            planStatusBadge.style.color = "var(--warning)";
            planStatusBadge.style.border = "1px solid rgba(255, 159, 10, 0.3)";
            planStatusBadge.innerHTML = `<i data-lucide="clock" style="width:12px; height:12px; margin-right:4px;"></i> Trial (7 dias)`;
        } else {
            planStatusBadge.className = "badge-status-bar badge-green";
            planStatusBadge.style.backgroundColor = "rgba(48, 209, 88, 0.15)";
            planStatusBadge.style.color = "var(--success)";
            planStatusBadge.style.border = "1px solid rgba(48, 209, 88, 0.3)";
            planStatusBadge.innerHTML = `<i data-lucide="shield-check" style="width:12px; height:12px; margin-right:4px;"></i> Ativa`;
        }
    }
    lucide.createIcons();
}

// Form Submit: Login & Cadastro SaaS comercial
document.getElementById("form-saas-auth").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("saas-email").value.trim().toLowerCase();
    const password = document.getElementById("saas-password").value;
    const shopName = document.getElementById("saas-shop-name").value.trim();

    if (isSaaSDemoMode) {
        // --- FLUXO DE DEMONSTRAÇÃO SAAS LOCAL ---
        const accounts = JSON.parse(localStorage.getItem("barbergold_saas_accounts") || "[]");
        
        if (isRegisteringSaaS) {
            // CADASTRO DEMO
            if (accounts.some(acc => acc.email === email)) {
                alert("Já existe uma barbearia cadastrada com este e-mail!");
                return;
            }

            // Criar conta com 7 dias de Trial Grátis
            const expires = new Date();
            expires.setDate(expires.getDate() + 7);

            const newAccount = {
                email,
                password,
                shopName,
                status: "trial",
                expiresAt: expires.toISOString()
            };

            accounts.push(newAccount);
            localStorage.setItem("barbergold_saas_accounts", JSON.stringify(accounts));
            
            // Logar automaticamente
            saasSession = {
                email,
                shopName,
                status: "trial",
                expiresAt: expires.toISOString()
            };
            localStorage.setItem("barbergold_saas_session", JSON.stringify(saasSession));
            
            alert(`Sua barbearia "${shopName}" foi registrada com sucesso! Você ganhou 7 dias de trial comercial.`);
            
        } else {
            // LOGIN DEMO
            const account = accounts.find(acc => acc.email === email && acc.password === password);
            if (!account) {
                alert("E-mail ou senha incorretos! Crie uma conta ou use dados válidos.");
                return;
            }

            saasSession = {
                email,
                shopName: account.shopName,
                status: account.status,
                expiresAt: account.expiresAt
            };
            localStorage.setItem("barbergold_saas_session", JSON.stringify(saasSession));
        }

        // Validar assinatura e iniciar app
        checkSaaSSubscription();
        renderSaaSInfoInSettings();

    } else {
        // --- CONEXÃO REAL COM O SUPABASE AUTH CLOUD ---
        if (isRegisteringSaaS) {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { shop_name: shopName }
                }
            });
            if (error) {
                alert("Erro ao registrar: " + error.message);
                return;
            }
            alert("Cadastro realizado! Por favor, verifique seu e-mail de confirmação.");
        } else {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                alert("Erro ao entrar: " + error.message);
                return;
            }
            
            saasSession = {
                email,
                shopName: data.user.user_metadata.shop_name || "Minha Barbearia",
                status: "active",
                expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            };
            localStorage.setItem("barbergold_saas_session", JSON.stringify(saasSession));
            checkSaaSSubscription();
            renderSaaSInfoInSettings();
        }
    }
});

// Ações do Paywall / Assinatura
// 1. Copiar Código Pix
document.getElementById("pix-copy-input").addEventListener("click", () => {
    const copyInput = document.getElementById("pix-copy-input");
    copyInput.select();
    copyInput.setSelectionRange(0, 99999); // Mobile
    navigator.clipboard.writeText(copyInput.value);
});

document.getElementById("btn-pix-copy").addEventListener("click", () => {
    const copyInput = document.getElementById("pix-copy-input");
    copyInput.select();
    copyInput.setSelectionRange(0, 99999); // Mobile
    navigator.clipboard.writeText(copyInput.value);

    const btn = document.getElementById("btn-pix-copy");
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="check" style="width: 14px; height: 14px; margin-right: 4px;"></i> Copiado!';
    lucide.createIcons();
    setTimeout(() => {
        btn.innerHTML = originalText;
        lucide.createIcons();
    }, 2000);
});

// 2. Simular Pagamento realizado Pix (Ativar conta R$ 39,90)
document.getElementById("btn-paywall-check").addEventListener("click", () => {
    if (!saasSession) return;
    
    if (isSaaSDemoMode) {
        // MODO DEMO: Simula ativação instantânea por Pix de R$ 39,90
        const accounts = JSON.parse(localStorage.getItem("barbergold_saas_accounts") || "[]");
        const accIndex = accounts.findIndex(acc => acc.email === saasSession.email);
        
        if (accIndex !== -1) {
            const expires = new Date();
            expires.setDate(expires.getDate() + 30); // 30 dias de acesso
            
            accounts[accIndex].status = "active";
            accounts[accIndex].expiresAt = expires.toISOString();
            localStorage.setItem("barbergold_saas_accounts", JSON.stringify(accounts));
            
            saasSession.status = "active";
            saasSession.expiresAt = expires.toISOString();
            localStorage.setItem("barbergold_saas_session", JSON.stringify(saasSession));
            
            alert("✓ Pagamento de R$ 39,90 confirmado via Pix! Sua assinatura BarberGold está ativa por mais 30 dias. Obrigado!");
            
            // Recarregar os dados e revalidar o acesso
            checkSaaSSubscription();
            renderSaaSInfoInSettings();
        }
    } else {
        // Consultaria webhook de faturamento em produção
        alert("Consultando sistema de pagamentos Supabase/Asaas... Se o pagamento já foi compensado, atualize a página.");
    }
});

// 3. Log Out
function saasLogout() {
    if (confirm("Deseja realmente sair da sua conta comercial?")) {
        localStorage.removeItem("barbergold_saas_session");
        saasSession = null;
        state = { barbers: [], services: [], clients: [], appointments: [] };
        
        // Recarregar para voltar ao Auth Gate limpo
        location.reload();
    }
}

// Expiração Manual (Developer Tester nos Ajustes)
function injectDemoExpireButton() {
    if (!isSaaSDemoMode || !saasSession) return;
    
    const dbCard = document.querySelector(".database-actions");
    if (!dbCard) return;

    // Verificar se botão já existe
    if (document.getElementById("btn-demo-expire-saas")) return;

    const expireBtn = document.createElement("button");
    expireBtn.id = "btn-demo-expire-saas";
    expireBtn.className = "btn-danger-outline";
    expireBtn.style.width = "100%";
    expireBtn.style.marginTop = "12px";
    expireBtn.innerHTML = '<i data-lucide="shield-alert"></i> Simular Expiração de Assinatura (SaaS)';
    
    expireBtn.onclick = () => {
        if (confirm("Isso definirá sua assinatura de R$ 39,90 como vencida para testar o bloqueio comercial. Continuar?")) {
            const accounts = JSON.parse(localStorage.getItem("barbergold_saas_accounts") || "[]");
            const accIndex = accounts.findIndex(acc => acc.email === saasSession.email);
            
            if (accIndex !== -1) {
                // Definir como past_due e expirar
                accounts[accIndex].status = "past_due";
                accounts[accIndex].expiresAt = new Date(Date.now() - 1000).toISOString(); // passado
                localStorage.setItem("barbergold_saas_accounts", JSON.stringify(accounts));
                
                alert("Assinatura expirada com sucesso! O aplicativo será bloqueado.");
                location.reload();
            }
        }
    };

    dbCard.appendChild(expireBtn);
    lucide.createIcons();
}

// Injetar informações de conta logada na aba de Configurações
function renderSaaSInfoInSettings() {
    if (!saasSession) return;
    const welcomeSec = document.querySelector("#page-settings .welcome-section");
    if (!welcomeSec) return;

    const existingInfo = document.getElementById("saas-settings-info");
    if (existingInfo) existingInfo.remove();

    const infoDiv = document.createElement("div");
    infoDiv.id = "saas-settings-info";
    infoDiv.className = "glass-card";
    infoDiv.style.padding = "16px";
    infoDiv.style.marginBottom = "20px";
    infoDiv.style.border = "1px solid rgba(212, 175, 55, 0.25)";

    const isTrial = saasSession.status === "trial";
    const expirationTime = new Date(saasSession.expiresAt).getTime();
    const isExpired = Date.now() > expirationTime;
    const isPastDue = saasSession.status === "past_due";
    const dateStr = new Date(saasSession.expiresAt).toLocaleDateString("pt-BR");

    let statusLabel = "🟢 Premium Ativo";
    if (isPastDue || isExpired) {
        statusLabel = "🔴 Mensalidade Vencida";
    } else if (isTrial) {
        statusLabel = "⏳ Período Trial";
    }

    infoDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <strong style="color:var(--accent); font-family:var(--font-heading); font-size:1.1rem;">${saasSession.shopName}</strong>
            <span class="badge-status-bar" id="settings-saas-status" style="font-size:0.7rem; font-weight:700;">
                ${statusLabel}
            </span>
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); display:flex; flex-direction:column; gap:4px;">
            <span>E-mail do Dono: <strong>${saasSession.email}</strong></span>
            <span>Próxima Renovação: <strong>${dateStr}</strong></span>
            <span>Mensalidade: <strong class="gold-text">R$ 39,90/mês</strong></span>
        </div>
        <button class="btn-danger-outline" id="btn-settings-logout" style="width:100%; margin-top:12px; padding:6px; font-size:0.8rem;">
            <i data-lucide="log-out" style="width:12px; height:12px; margin-right:4px;"></i> Desconectar Barbearia
        </button>
    `;

    welcomeSec.after(infoDiv);
    
    // Configurar o clique no botão de logout da página de ajustes
    document.getElementById("btn-settings-logout").addEventListener("click", () => saasLogout());
    
    lucide.createIcons();
    
    // Injetar botão de teste de expiração
    injectDemoExpireButton();
}

// --- 14. INICIALIZAÇÃO GERAL ---
function initApp() {
    // 1. Inicializar autenticação e licenças SaaS comercial
    initSaaSAuth();

    // Se estiver tudo liberado na assinatura, exibe as infos do painel na aba ajustes
    if (saasSession) {
        renderSaaSInfoInSettings();
    }

    // Sempre vincular o botão de logout da aba de assinatura se ele existir no DOM
    const subLogoutBtn = document.getElementById("btn-paywall-logout");
    if (subLogoutBtn) {
        subLogoutBtn.addEventListener("click", () => saasLogout());
    }
}

if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}
