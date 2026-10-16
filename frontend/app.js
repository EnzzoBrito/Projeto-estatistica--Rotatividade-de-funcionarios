const state = {
  options: null,
  filters: {
    department: 'all',
    jobRole: 'all',
    maritalStatus: 'all',
    overTime: 'all',
    jobLevel: 'all',
    ageMin: 18,
    ageMax: 60,
  },
  cachedFilterData: null,
  hypothesesData: null,
  regressionData: null,
  activeBreakdownCol: 'overTime',
  dataPage: 0,
  pageSize: 25,
  charts: {},
};

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupFilterControls();
  setupSimulatorControls();
  setupImpactControls();
  setupCustomHypothesisTool();
  setupDataPagination();


  loadInitialData();
});


function setupNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document
        .querySelectorAll('.tab-pane')
        .forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) {
        targetPane.classList.add('active');
      }


      setTimeout(() => {
        Object.values(state.charts).forEach((chart) => {
          if (chart && typeof chart.resize === 'function') {
            chart.resize();
          }
        });
      }, 50);
    });
  });
}

async function loadInitialData() {
  try {

    const statusRes = await fetch('/api/status');
    if (statusRes.ok) {
      document.getElementById('backend-status-text').textContent =
        'Backend Conectado (1.470 registros)';
    }


    const optRes = await fetch('/api/options');
    state.options = await optRes.json();
    populateDropdownOptions();


    await applyFilters();

    loadHypotheses();

    loadRegressionModel();

    calculatePrediction();

    calculateImpactSimulation(1.0);

    loadDataPreview();

  } catch (err) {
    console.error('Erro ao conectar com backend:', err);
    document.getElementById('backend-status-text').textContent =
      'Erro de Conexão';
    document.getElementById('backend-status-text').style.color = '#f43f5e';
  }
}


function populateDropdownOptions() {
  if (!state.options) return;

  const depSelect = document.getElementById('filter-department');
  state.options.departments.forEach((dep) => {
    const opt = document.createElement('option');
    opt.value = dep;
    opt.textContent = dep;
    depSelect.appendChild(opt);
  });

  const roleSelect = document.getElementById('filter-jobrole');
  state.options.jobRoles.forEach((role) => {
    const opt = document.createElement('option');
    opt.value = role;
    opt.textContent = role;
    roleSelect.appendChild(opt);
  });

  const marSelect = document.getElementById('filter-marital');
  state.options.maritalStatuses.forEach((ms) => {
    const opt = document.createElement('option');
    opt.value = ms;
    opt.textContent = ms;
    marSelect.appendChild(opt);
  });

  const ageMin = document.getElementById('filter-age-min');
  const ageMax = document.getElementById('filter-age-max');
  ageMin.min = state.options.ageMin;
  ageMin.max = state.options.ageMax;
  ageMin.value = state.options.ageMin;
  ageMax.min = state.options.ageMin;
  ageMax.max = state.options.ageMax;
  ageMax.value = state.options.ageMax;
  updateAgeLabel();
}

function setupFilterControls() {
  const debouncedApply = debounce(() => applyFilters(), 300);

  document
    .getElementById('filter-department')
    .addEventListener('change', (e) => {
      state.filters.department = e.target.value;
      applyFilters();
    });

  document.getElementById('filter-overtime').addEventListener('change', (e) => {
    state.filters.overTime = e.target.value;
    applyFilters();
  });

  document.getElementById('filter-marital').addEventListener('change', (e) => {
    state.filters.maritalStatus = e.target.value;
    applyFilters();
  });

  document.getElementById('filter-joblevel').addEventListener('change', (e) => {
    state.filters.jobLevel = e.target.value;
    applyFilters();
  });

  document.getElementById('filter-jobrole').addEventListener('change', (e) => {
    state.filters.jobRole = e.target.value;
    applyFilters();
  });

  const ageMin = document.getElementById('filter-age-min');
  const ageMax = document.getElementById('filter-age-max');

  ageMin.addEventListener('input', () => {
    if (parseInt(ageMin.value) > parseInt(ageMax.value)) {
      ageMin.value = ageMax.value;
    }
    state.filters.ageMin = parseInt(ageMin.value);
    updateAgeLabel();
    debouncedApply();
  });

  ageMax.addEventListener('input', () => {
    if (parseInt(ageMax.value) < parseInt(ageMin.value)) {
      ageMax.value = ageMin.value;
    }
    state.filters.ageMax = parseInt(ageMax.value);
    updateAgeLabel();
    debouncedApply();
  });

  document
    .getElementById('btn-reset-filters')
    .addEventListener('click', resetFilters);

  document
    .getElementById('select-category-breakdown')
    .addEventListener('change', (e) => {
      state.activeBreakdownCol = e.target.value;
      if (state.cachedFilterData) {
        renderCategoryBreakdownChart(state.cachedFilterData);
      }
    });
}

function updateAgeLabel() {
  const min = document.getElementById('filter-age-min').value;
  const max = document.getElementById('filter-age-max').value;
  document.getElementById('age-range-label').textContent = `${min} - ${max}`;
}

function resetFilters() {
  state.filters = {
    department: 'all',
    jobRole: 'all',
    maritalStatus: 'all',
    overTime: 'all',
    jobLevel: 'all',
    ageMin: state.options ? state.options.ageMin : 18,
    ageMax: state.options ? state.options.ageMax : 60,
  };

  document.getElementById('filter-department').value = 'all';
  document.getElementById('filter-overtime').value = 'all';
  document.getElementById('filter-marital').value = 'all';
  document.getElementById('filter-joblevel').value = 'all';
  document.getElementById('filter-jobrole').value = 'all';
  document.getElementById('filter-age-min').value = state.filters.ageMin;
  document.getElementById('filter-age-max').value = state.filters.ageMax;
  updateAgeLabel();

  applyFilters();
}

async function applyFilters() {
  try {
    const res = await fetch('/api/filter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.filters),
    });
    const data = await res.json();
    state.cachedFilterData = data;

    updateKPIs(data.kpis);
    renderCategoryBreakdownChart(data);
    renderIncomeDistChart(data.distributions.monthlyIncome);
    renderAgeIncomeScatter(data);
    renderCorrelationTable(data.correlation);
  } catch (err) {
    console.error('Erro ao aplicar filtros:', err);
  }
}

function updateKPIs(kpis) {
  if (!kpis) return;
  document.getElementById('kpi-total-n').textContent =
    kpis.totalCount.toLocaleString('pt-BR');
  document.getElementById('kpi-attrition-count').textContent =
    kpis.attritionCount.toLocaleString('pt-BR');
  document.getElementById('kpi-attrition-rate').textContent =
    `${kpis.attritionRatePct.toFixed(2)}%`;
  document.getElementById('kpi-wilson-ci').textContent =
    `IC 95% Wilson: [${kpis.attritionCiLowPct.toFixed(2)}%, ${kpis.attritionCiHighPct.toFixed(2)}%]`;
  document.getElementById('kpi-mean-income').textContent =
    `R$ ${Math.round(kpis.meanIncome).toLocaleString('pt-BR')}`;
  document.getElementById('kpi-median-income').textContent =
    `R$ ${Math.round(kpis.medianIncome).toLocaleString('pt-BR')}`;
  document.getElementById('kpi-mean-age').textContent =
    `${kpis.meanAge.toFixed(1)} anos`;
  document.getElementById('kpi-median-age').textContent =
    `${kpis.medianAge.toFixed(1)} anos`;
}


function renderCategoryBreakdownChart(data) {
  const ctx = document.getElementById('chart-cat-breakdown');
  if (!ctx) return;

  const breakdownKey = state.activeBreakdownCol;
  const items = data.breakdowns[breakdownKey] || [];
  const baseline = data.kpis.baselineRatePct;

  const labels = items.map((i) => i.category);
  const rates = items.map((i) => i.attritionRate);
  const counts = items.map((i) => i.count);
  const attrCounts = items.map((i) => i.attritionCount);

  if (state.charts.catBreakdown) {
    state.charts.catBreakdown.destroy();
  }

  state.charts.catBreakdown = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Taxa de Rotatividade (%)',
          data: rates,
          backgroundColor: rates.map((r) =>
            r > baseline
              ? 'rgba(244, 63, 94, 0.75)'
              : 'rgba(99, 102, 241, 0.75)',
          ),
          borderColor: rates.map((r) =>
            r > baseline ? '#f43f5e' : '#6366f1',
          ),
          borderWidth: 1.5,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const idx = ctx.dataIndex;
              const it = items[idx];
              return [
                `Taxa: ${it.attritionRate.toFixed(2)}%`,
                `Casos: ${it.attritionCount} de ${it.count} funcionários`,
                `IC 95% Wilson: [${it.ciLow.toFixed(1)}%, ${it.ciHigh.toFixed(1)}%]`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: 'Taxa de Rotatividade (%)',
            color: '#94a3b8',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#cbd5e1', maxRotation: 30, minRotation: 0 },
        },
      },
    },
    plugins: [
      {
        id: 'baselineLine',
        afterDraw: (chart) => {
          const {
            ctx,
            chartArea: { left, right },
            scales: { y },
          } = chart;
          const yPos = y.getPixelForValue(baseline);
          ctx.save();
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 6]);
          ctx.beginPath();
          ctx.moveTo(left, yPos);
          ctx.lineTo(right, yPos);
          ctx.stroke();

          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px JetBrains Mono';
          ctx.fillText(`Média Global: ${baseline.toFixed(1)}%`, right - 130, yPos - 8);
          ctx.restore();
        },
      },
    ],
  });
}


function renderIncomeDistChart(incStats) {
  const ctx = document.getElementById('chart-income-dist');
  if (!ctx || !incStats) return;

  const labels = ['Quem Ficou (Não)', 'Quem Saiu (Sim)'];
  const medians = [incStats.no.median, incStats.yes.median];
  const means = [incStats.no.mean, incStats.yes.mean];
  const q1s = [incStats.no.q1, incStats.yes.q1];
  const q3s = [incStats.no.q3, incStats.yes.q3];

  if (state.charts.incomeDist) {
    state.charts.incomeDist.destroy();
  }

  state.charts.incomeDist = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Renda Mediana (R$)',
          data: medians,
          backgroundColor: ['rgba(16, 185, 129, 0.75)', 'rgba(244, 63, 94, 0.75)'],
          borderColor: ['#10b981', '#f43f5e'],
          borderWidth: 1.5,
          borderRadius: 6,
        },
        {
          label: 'Renda Média (R$)',
          data: means,
          backgroundColor: 'rgba(99, 102, 241, 0.45)',
          borderColor: '#6366f1',
          borderWidth: 1.5,
          borderRadius: 6,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans' } },
        },
        tooltip: {
          callbacks: {
            afterBody: (ctx) => {
              const idx = ctx[0].dataIndex;
              const s = idx === 0 ? incStats.no : incStats.yes;
              return [
                `Q1 (25%): R$ ${s.q1.toLocaleString('pt-BR')}`,
                `Q3 (75%): R$ ${s.q3.toLocaleString('pt-BR')}`,
                `Desvio Padrão: R$ ${s.std.toLocaleString('pt-BR')}`,
                `N: ${s.count} colaboradores`,
              ];
            },
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Renda Mensal (R$)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: {
            color: '#94a3b8',
            callback: (v) => `R$ ${v.toLocaleString('pt-BR')}`,
          },
        },
        x: {
          grid: { display: false },
          ticks: { color: '#cbd5e1' },
        },
      },
    },
  });
}


async function renderAgeIncomeScatter(data) {
  const ctx = document.getElementById('chart-age-income-scatter');
  if (!ctx) return;


  try {
    const res = await fetch('/api/data-preview?limit=150');
    const json = await res.json();
    const rows = json.data || [];

    const stayPts = rows
      .filter((r) => r.Attrition === 'No')
      .map((r) => ({ x: r.Age, y: r.MonthlyIncome }));
    const leavePts = rows
      .filter((r) => r.Attrition === 'Yes')
      .map((r) => ({ x: r.Age, y: r.MonthlyIncome }));

    if (state.charts.ageIncomeScatter) {
      state.charts.ageIncomeScatter.destroy();
    }

    state.charts.ageIncomeScatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Permaneceu (Não)',
            data: stayPts,
            backgroundColor: 'rgba(16, 185, 129, 0.55)',
            borderColor: '#10b981',
            borderWidth: 1,
            pointRadius: 4,
          },
          {
            label: 'Saiu da Empresa (Sim)',
            data: leavePts,
            backgroundColor: 'rgba(244, 63, 94, 0.75)',
            borderColor: '#f43f5e',
            borderWidth: 1.5,
            pointRadius: 5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: '#cbd5e1', font: { family: 'Plus Jakarta Sans' } },
          },
          tooltip: {
            callbacks: {
              label: (ctx) =>
                `Idade: ${ctx.parsed.x} anos | Renda: R$ ${ctx.parsed.y.toLocaleString('pt-BR')}`,
            },
          },
        },
        scales: {
          x: {
            title: { display: true, text: 'Idade (Anos)', color: '#94a3b8' },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: { color: '#94a3b8' },
          },
          y: {
            title: {
              display: true,
              text: 'Renda Mensal (R$)',
              color: '#94a3b8',
            },
            grid: { color: 'rgba(255, 255, 255, 0.06)' },
            ticks: {
              color: '#94a3b8',
              callback: (v) => `R$ ${v.toLocaleString('pt-BR')}`,
            },
          },
        },
      },
    });
  } catch (err) {
    console.error('Erro ao carregar scatter:', err);
  }
}


function renderCorrelationTable(corr) {
  const table = document.getElementById('table-correlation');
  if (!table || !corr) return;

  const cols = Object.keys(corr);
  if (cols.length === 0) return;

  const abbrMap = {
    MonthlyIncome: 'Renda',
    Age: 'Idade',
    JobLevel: 'Nível',
    TotalWorkingYears: 'Carreira',
    YearsAtCompany: 'Empresa',
    YearsSinceLastPromotion: 'Promoção',
    DistanceFromHome: 'Distância',
    AttritionFlag: 'Saída',
  };

  let html = '<thead><tr><th>Variável</th>';
  cols.forEach((c) => {
    html += `<th>${abbrMap[c] || c}</th>`;
  });
  html += '</tr></thead><tbody>';

  cols.forEach((row) => {
    html += `<tr><td style="text-align: left; font-weight: 600;">${abbrMap[row] || row}</td>`;
    cols.forEach((col) => {
      const val = corr[row][col];
      let bg = 'transparent';
      let color = '#f8fafc';
      if (row === col) {
        bg = 'rgba(255, 255, 255, 0.08)';
        color = '#94a3b8';
      } else if (val > 0.5) {
        bg = `rgba(99, 102, 241, ${Math.min(0.8, val)})`;
      } else if (val > 0.2) {
        bg = `rgba(99, 102, 241, ${Math.min(0.4, val)})`;
      } else if (val < -0.15) {
        bg = `rgba(244, 63, 94, ${Math.min(0.6, Math.abs(val))})`;
      }
      html += `<td style="background-color: ${bg}; color: ${color};">${val.toFixed(2)}</td>`;
    });
    html += '</tr>';
  });
  html += '</tbody>';

  table.innerHTML = html;
}


async function loadHypotheses() {
  try {
    const res = await fetch('/api/hypotheses');
    const data = await res.json();
    state.hypothesesData = data;


    const h1 = data.h1_overtime;
    document.getElementById('h1-p1').textContent = `${(h1.p1 * 100).toFixed(2)}%`;
    document.getElementById('h1-p2').textContent = `${(h1.p2 * 100).toFixed(2)}%`;
    document.getElementById('h1-diff').textContent = `${(h1.diferenca * 100).toFixed(2)} p.p.`;
    document.getElementById('h1-z').textContent = h1.z_stat.toFixed(3);
    document.getElementById('h1-chi2').textContent = `${h1.chi2_stat.toFixed(2)} (gl=1)`;
    document.getElementById('h1-p').textContent =
      h1.p_valor_z < 0.0001 ? '< 0.0001' : h1.p_valor_z.toFixed(4);
    document.getElementById('h1-ci').textContent =
      `IC 95% da Diferença: [${(h1.ic_95_diferenca[0] * 100).toFixed(2)} p.p., ${(h1.ic_95_diferenca[1] * 100).toFixed(2)} p.p.]`;


    const h2 = data.h2_income;
    document.getElementById('h2-m1').textContent = `R$ ${h2.welch.media_1.toLocaleString('pt-BR')}`;
    document.getElementById('h2-m2').textContent = `R$ ${h2.welch.media_2.toLocaleString('pt-BR')}`;
    document.getElementById('h2-diff').textContent = `R$ ${h2.welch.dif_medias.toLocaleString('pt-BR')}`;
    document.getElementById('h2-t').textContent = h2.welch.t.toFixed(3);
    document.getElementById('h2-gl').textContent = h2.welch.gl.toFixed(1);
    document.getElementById('h2-p').textContent =
      h2.welch.p_valor < 0.0001 ? '< 0.0001' : h2.welch.p_valor.toFixed(4);
    document.getElementById('h2-mw-p').textContent =
      h2.welch.mannwhitney_p < 0.0001 ? '< 0.0001' : h2.welch.mannwhitney_p.toFixed(4);
    document.getElementById('h2-ci').textContent =
      `IC 95% (Welch): [R$ ${h2.welch.ic_inf.toLocaleString('pt-BR')}, R$ ${h2.welch.ic_sup.toLocaleString('pt-BR')}]`;


    const h3 = data.h3_age;
    document.getElementById('h3-m1').textContent = `${h3.welch.media_1.toFixed(1)} anos`;
    document.getElementById('h3-m2').textContent = `${h3.welch.media_2.toFixed(1)} anos`;
    document.getElementById('h3-diff').textContent = `${h3.welch.dif_medias.toFixed(2)} anos`;
    document.getElementById('h3-t').textContent = h3.welch.t.toFixed(3);
    document.getElementById('h3-gl').textContent = h3.welch.gl.toFixed(1);
    document.getElementById('h3-p').textContent =
      h3.welch.p_valor < 0.0001 ? '< 0.0001' : h3.welch.p_valor.toFixed(4);
    document.getElementById('h3-ci').textContent =
      `IC 95% (Welch): [${h3.welch.ic_inf.toFixed(2)} anos, ${h3.welch.ic_sup.toFixed(2)} anos]`;


    const h4 = data.h4_marital;
    document.getElementById('h4-chi2').textContent = h4.chi2_stat.toFixed(2);
    document.getElementById('h4-gl').textContent = h4.gl;
    document.getElementById('h4-cramer').textContent = h4.cramer_v.toFixed(3);
    document.getElementById('h4-p').textContent =
      h4.p_valor < 0.0001 ? '< 0.0001' : h4.p_valor.toFixed(4);
    document.getElementById('h4-exp').textContent = h4.frequencia_esperada_minima.toFixed(1);


    const h5 = data.h5_income_gap;
    document.getElementById('h5-m1').textContent = `R$ ${h5.welch_attrition.media_1.toFixed(1)}`;
    document.getElementById('h5-m2').textContent = `R$ ${h5.welch_attrition.media_2.toFixed(1)}`;
    document.getElementById('h5-diff').textContent = `R$ ${h5.welch_attrition.dif_medias.toFixed(1)}`;
    document.getElementById('h5-t').textContent = h5.welch_attrition.t.toFixed(3);
    document.getElementById('h5-gl').textContent = h5.welch_attrition.gl.toFixed(1);
    document.getElementById('h5-p').textContent = h5.welch_attrition.p_valor.toFixed(4);
    document.getElementById('h5-ci').textContent =
      `IC 95%: [R$ ${h5.welch_attrition.ic_inf.toFixed(1)}, R$ ${h5.welch_attrition.ic_sup.toFixed(1)}] (Cruza o zero: p = ${h5.welch_attrition.p_valor.toFixed(3)})`;

    renderForestPlot(data);
  } catch (err) {
    console.error('Erro ao carregar hipóteses:', err);
  }
}


function renderForestPlot(hyps) {
  const ctx = document.getElementById('chart-ci-forest');
  if (!ctx || !hyps) return;

  const h1 = hyps.h1_overtime;
  const h2 = hyps.h2_income;
  const h3 = hyps.h3_age;
  const h5 = hyps.h5_income_gap;


  const items = [
    {
      label: 'H1: Dif. Proporções Hora Extra (%)',
      point: h1.diferenca * 100,
      low: h1.ic_95_diferenca[0] * 100,
      high: h1.ic_95_diferenca[1] * 100,
      unit: 'p.p.',
    },
    {
      label: 'H3: Dif. Idade (Saiu - Ficou) (anos)',
      point: h3.welch.dif_medias,
      low: h3.welch.ic_inf,
      high: h3.welch.ic_sup,
      unit: 'anos',
    },
    {
      label: 'H5: Dif. Resíduo Salarial Gap (R$/100)',
      point: h5.welch_attrition.dif_medias / 100,
      low: h5.welch_attrition.ic_inf / 100,
      high: h5.welch_attrition.ic_sup / 100,
      unit: 'R$/100',
    },
  ];

  if (state.charts.ciForest) {
    state.charts.ciForest.destroy();
  }

  state.charts.ciForest = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: items.map((i) => i.label),
      datasets: [
        {
          label: 'Intervalo de Confiança 95% [Inf, Sup]',
          data: items.map((i) => [i.low, i.high]),
          backgroundColor: items.map((i) =>
            i.low <= 0 && i.high >= 0
              ? 'rgba(148, 163, 184, 0.4)'
              : 'rgba(99, 102, 241, 0.4)',
          ),
          borderColor: items.map((i) =>
            i.low <= 0 && i.high >= 0 ? '#94a3b8' : '#6366f1',
          ),
          borderWidth: 1.5,
          borderRadius: 4,
          borderSkipped: false,
        },
      ],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const it = items[ctx.dataIndex];
              return [
                `Estimativa Pontual: ${it.point.toFixed(2)} ${it.unit}`,
                `IC 95%: [${it.low.toFixed(2)}, ${it.high.toFixed(2)}] ${it.unit}`,
                it.low <= 0 && it.high >= 0
                  ? 'Cruza o zero (Não rejeita H0)'
                  : 'Distante do zero (Rejeita H0)',
              ];
            },
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Magnitude da Diferença Amostral e Margens do IC 95%',
            color: '#94a3b8',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
        y: {
          grid: { display: false },
          ticks: { color: '#cbd5e1' },
        },
      },
    },
    plugins: [
      {
        id: 'zeroLine',
        afterDraw: (chart) => {
          const {
            ctx,
            chartArea: { top, bottom },
            scales: { x },
          } = chart;
          const xZero = x.getPixelForValue(0);
          ctx.save();
          ctx.strokeStyle = '#f43f5e';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(xZero, top);
          ctx.lineTo(xZero, bottom);
          ctx.stroke();

          ctx.fillStyle = '#f43f5e';
          ctx.font = 'bold 11px JetBrains Mono';
          ctx.fillText('H₀: &Delta; = 0', xZero + 5, top + 15);
          ctx.restore();
        },
      },
    ],
  });
}


function setupCustomHypothesisTool() {
  const btn = document.getElementById('btn-run-custom-test');
  const select = document.getElementById('select-custom-var');
  const resultsBox = document.getElementById('custom-test-results');

  btn.addEventListener('click', async () => {
    const varName = select.value;
    try {
      const res = await fetch('/api/custom-hypothesis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variable: varName }),
      });
      const data = await res.json();
      resultsBox.style.display = 'block';

      if (data.tipo === 'numerico_welch') {
        resultsBox.innerHTML = `
          <div style="font-size: 0.95rem; font-weight: 700; color: #a5b4fc; margin-bottom: 0.5rem;">
            Teste t de Welch: ${data.variavel} (Saiu vs Ficou)
          </div>
          <div>Média Saiu: ${data.media_1} (n = ${data.n1}) | Média Ficou: ${data.media_2} (n = ${data.n2})</div>
          <div>Diferença de Médias: ${data.dif_medias} | Estatística t: ${data.t} | Graus de Liberdade (Satterthwaite): ${data.gl}</div>
          <div><strong>p-valor (Welch): ${data.p_valor < 0.0001 ? '< 0.0001' : data.p_valor.toFixed(5)}</strong> | p-valor (Mann-Whitney): ${data.mannwhitney_p < 0.0001 ? '< 0.0001' : data.mannwhitney_p.toFixed(5)}</div>
          <div style="margin-top: 0.35rem; color: #06b6d4;">Intervalo de Confiança 95% para a Diferença: [${data.ic_inf}, ${data.ic_sup}]</div>
          <div style="margin-top: 0.35rem; font-weight: 700; color: ${data.p_valor < 0.05 ? '#10b981' : '#f59e0b'};">
            ${data.p_valor < 0.05 ? 'Rejeita H₀ (p < 0,05) — Diferença estatisticamente significativa' : 'Não rejeita H₀ (p ≥ 0,05) — Sem evidência de diferença'}
          </div>
        `;
      } else {
        resultsBox.innerHTML = `
          <div style="font-size: 0.95rem; font-weight: 700; color: #a5b4fc; margin-bottom: 0.5rem;">
            Teste Qui-Quadrado de Independência: ${data.variavel} &times; Rotatividade
          </div>
          <div>Estatística &chi;²: ${data.chi2_stat} | Graus de Liberdade: ${data.gl}</div>
          <div><strong>p-valor: ${data.p_valor < 0.0001 ? '< 0.0001' : data.p_valor.toFixed(5)}</strong> | V de Cramér (Tamanho do Efeito): ${data.cramer_v}</div>
          <div>Menor Frequência Esperada na Tabela: ${data.frequencia_esperada_minima}</div>
          <div style="margin-top: 0.35rem; font-weight: 700; color: ${data.p_valor < 0.05 ? '#10b981' : '#f59e0b'};">
            ${data.p_valor < 0.05 ? 'Rejeita H₀ (p < 0,05) — Associação estatisticamente significativa' : 'Não rejeita H₀ (p ≥ 0,05) — Variáveis estatisticamente independentes'}
          </div>
        `;
      }
    } catch (err) {
      console.error('Erro no teste customizado:', err);
    }
  });
}


async function loadRegressionModel() {
  try {
    const res = await fetch('/api/regression/model');
    const data = await res.json();
    state.regressionData = data;


    document.getElementById('reg-r2-tr').textContent =
      data.metricas.r2_treino.toFixed(4);
    document.getElementById('reg-r2-adj').textContent =
      data.metricas.r2_ajustado_treino.toFixed(4);
    document.getElementById('reg-r2-te').textContent =
      data.metricas.r2_teste.toFixed(4);
    document.getElementById('reg-cv-mean').textContent =
      data.metricas.cv_r2_medio.toFixed(4);
    document.getElementById('reg-rmse').textContent =
      `R$ ${data.metricas.rmse_teste.toFixed(2)}`;
    document.getElementById('reg-mae').textContent =
      `R$ ${data.metricas.mae_teste.toFixed(2)}`;
    document.getElementById('reg-f-stat').textContent =
      `F = ${data.metricas.f_stat.toFixed(1)}`;
    document.getElementById('reg-gl-res').textContent = data.gl_residual;


    const bp = data.pressupostos.breusch_pagan;
    document.getElementById('diag-bp-stat').textContent =
      `LM = ${bp.lm_stat.toFixed(2)} | p = ${bp.p_valor < 0.0001 ? '< 0.0001' : bp.p_valor.toFixed(4)}`;
    const sw = data.pressupostos.shapiro_wilk;
    document.getElementById('diag-sw-stat').textContent =
      `W = ${sw.stat.toFixed(4)} | p = ${sw.p_valor < 0.0001 ? '< 0.0001' : sw.p_valor.toFixed(4)}`;
    document.getElementById('diag-vif-stat').textContent =
      `VIF Máximo = ${data.pressupostos.vif_max.toFixed(2)}`;


    document.getElementById('cmp-r2-orig').textContent =
      data.metricas.r2_teste.toFixed(4);
    document.getElementById('cmp-r2-log').textContent =
      data.metricas.r2_log_teste.toFixed(4);


    const tbody = document.querySelector('#table-reg-coefs tbody');
    tbody.innerHTML = '';
    data.coeficientes.forEach((row) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 600;">${row.parametro}</td>
        <td>${row.coef.toFixed(4)}</td>
        <td>${row.erro_padrao.toFixed(4)}</td>
        <td>${row.t_stat.toFixed(4)}</td>
        <td style="font-weight: 600; color: ${row.p_valor < 0.05 ? '#10b981' : '#f59e0b'};">
          ${row.p_valor < 0.0001 ? '< 0.0001' : row.p_valor.toFixed(4)}
        </td>
        <td>${row.ic_inf.toFixed(4)}</td>
        <td>${row.ic_sup.toFixed(4)}</td>
        <td>${row.vif}</td>
      `;
      tbody.appendChild(tr);
    });



    renderFittedVsResChart(data.graficos.residuos_ajustados);
    renderQQPlotChart(data.graficos.qq_plot);
    renderActualVsPredChart(data.graficos.real_vs_previsto);
  } catch (err) {
    console.error('Erro ao carregar modelo de regressão:', err);
  }
}


function renderFittedVsResChart(pts) {
  const ctx = document.getElementById('chart-res-fitted');
  if (!ctx || !pts) return;

  if (state.charts.resFitted) {
    state.charts.resFitted.destroy();
  }

  state.charts.resFitted = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Resíduos Ordinários',
          data: pts.map((p) => ({ x: p.fitted, y: p.residual })),
          backgroundColor: 'rgba(99, 102, 241, 0.55)',
          borderColor: '#6366f1',
          pointRadius: 3.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `Ajustado: R$ ${ctx.parsed.x.toLocaleString('pt-BR')} | Resíduo: R$ ${ctx.parsed.y.toLocaleString('pt-BR')}`,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Valores Ajustados (Renda Prevista Ŷ)',
            color: '#94a3b8',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
        y: {
          title: { display: true, text: 'Resíduos (e = y - Ŷ)', color: '#94a3b8' },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
      },
    },
    plugins: [
      {
        id: 'zeroLineY',
        afterDraw: (chart) => {
          const {
            ctx,
            chartArea: { left, right },
            scales: { y },
          } = chart;
          const yZero = y.getPixelForValue(0);
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(left, yZero);
          ctx.lineTo(right, yZero);
          ctx.stroke();
          ctx.restore();
        },
      },
    ],
  });
}


function renderQQPlotChart(pts) {
  const ctx = document.getElementById('chart-qq-plot');
  if (!ctx || !pts) return;

  if (state.charts.qqPlot) {
    state.charts.qqPlot.destroy();
  }

  const samplePts = pts.map((p) => ({ x: p.theoretical, y: p.sample }));

  state.charts.qqPlot = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Quantis Padronizados',
          data: samplePts,
          backgroundColor: 'rgba(6, 182, 212, 0.65)',
          borderColor: '#06b6d4',
          pointRadius: 3.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `Quantil Teórico: ${ctx.parsed.x.toFixed(2)} | Resíduo Padronizado: ${ctx.parsed.y.toFixed(2)}`,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Quantis Teóricos N(0,1)',
            color: '#94a3b8',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
        y: {
          title: {
            display: true,
            text: 'Resíduos Amostrais Padronizados',
            color: '#94a3b8',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
      },
    },
    plugins: [
      {
        id: 'qqDiagLine',
        afterDraw: (chart) => {
          const {
            ctx,
            chartArea: { left, right },
            scales: { x, y },
          } = chart;
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x.getPixelForValue(-3), y.getPixelForValue(-3));
          ctx.lineTo(x.getPixelForValue(3), y.getPixelForValue(3));
          ctx.stroke();
          ctx.restore();
        },
      },
    ],
  });
}


function renderActualVsPredChart(pts) {
  const ctx = document.getElementById('chart-actual-pred');
  if (!ctx || !pts) return;

  if (state.charts.actualPred) {
    state.charts.actualPred.destroy();
  }

  const samplePts = pts.map((p) => ({ x: p.actual, y: p.predicted }));

  state.charts.actualPred = new Chart(ctx, {
    type: 'scatter',
    data: {
      datasets: [
        {
          label: 'Previsões em Teste',
          data: samplePts,
          backgroundColor: 'rgba(168, 85, 247, 0.65)',
          borderColor: '#a855f7',
          pointRadius: 3.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              `Real: R$ ${ctx.parsed.x.toLocaleString('pt-BR')} | Previsto: R$ ${ctx.parsed.y.toLocaleString('pt-BR')}`,
          },
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Renda Real Observada (R$)',
            color: '#94a3b8',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
        y: {
          title: {
            display: true,
            text: 'Renda Prevista pelo Modelo Ŷ (R$)',
            color: '#94a3b8',
          },
          grid: { color: 'rgba(255, 255, 255, 0.06)' },
          ticks: { color: '#94a3b8' },
        },
      },
    },
    plugins: [
      {
        id: 'identityLine',
        afterDraw: (chart) => {
          const {
            ctx,
            chartArea: { left, bottom, top, right },
            scales: { x, y },
          } = chart;
          ctx.save();
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(x.getPixelForValue(1000), y.getPixelForValue(1000));
          ctx.lineTo(x.getPixelForValue(20000), y.getPixelForValue(20000));
          ctx.stroke();
          ctx.restore();
        },
      },
    ],
  });
}


function setupSimulatorControls() {
  const inputs = [
    'sim-joblevel',
    'sim-age',
    'sim-totalworking',
    'sim-yearscompany',
    'sim-yearspromotion',
  ];

  inputs.forEach((id) => {
    const el = document.getElementById(id);
    el.addEventListener('input', () => {
      updateSimLabels();
      calculatePrediction();
    });
  });

  document
    .getElementById('sim-actualincome')
    .addEventListener('input', debounce(() => calculatePrediction(), 300));
  document
    .getElementById('btn-calc-sim')
    .addEventListener('click', calculatePrediction);
}

function updateSimLabels() {
  document.getElementById('sim-joblevel-val').textContent =
    document.getElementById('sim-joblevel').value;
  document.getElementById('sim-age-val').textContent =
    `${document.getElementById('sim-age').value} anos`;
  document.getElementById('sim-totalworking-val').textContent =
    `${document.getElementById('sim-totalworking').value} anos`;
  document.getElementById('sim-yearscompany-val').textContent =
    `${document.getElementById('sim-yearscompany').value} anos`;
  document.getElementById('sim-yearspromotion-val').textContent =
    `${document.getElementById('sim-yearspromotion').value} anos`;
}

async function calculatePrediction() {
  const payload = {
    JobLevel: parseInt(document.getElementById('sim-joblevel').value),
    Age: parseInt(document.getElementById('sim-age').value),
    TotalWorkingYears: parseInt(document.getElementById('sim-totalworking').value),
    YearsAtCompany: parseInt(document.getElementById('sim-yearscompany').value),
    YearsSinceLastPromotion: parseInt(document.getElementById('sim-yearspromotion').value),
  };

  const actualInput = document.getElementById('sim-actualincome').value;
  if (actualInput && !isNaN(parseFloat(actualInput))) {
    payload.ActualIncome = parseFloat(actualInput);
  }

  try {
    const res = await fetch('/api/regression/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    document.getElementById('sim-out-predicted').textContent =
      `R$ ${Math.round(data.renda_prevista).toLocaleString('pt-BR')}`;
    document.getElementById('sim-out-mean-ci').textContent =
      `[R$ ${Math.round(data.intervalo_confianca_media_95[0]).toLocaleString('pt-BR')}, R$ ${Math.round(data.intervalo_confianca_media_95[1]).toLocaleString('pt-BR')}]`;
    document.getElementById('sim-out-pred-ci').textContent =
      `[R$ ${Math.round(data.intervalo_predicao_95[0]).toLocaleString('pt-BR')}, R$ ${Math.round(data.intervalo_predicao_95[1]).toLocaleString('pt-BR')}]`;

    document.getElementById('sim-out-leverage').textContent =
      data.leverage_h00.toFixed(6);
    document.getElementById('sim-out-se-pred').textContent =
      `R$ ${data.erro_padrao_predicao.toFixed(2)}`;

    const gapBox = document.getElementById('sim-gap-container');
    if (data.income_gap !== null && data.income_gap !== undefined) {
      gapBox.style.display = 'block';
      const statusBadge = document.getElementById('sim-gap-status');
      const isAbove = data.income_gap >= 0;
      statusBadge.textContent = isAbove
        ? 'Salário Acima do Previsto'
        : 'Salário Abaixo do Previsto';
      statusBadge.className = `badge-status ${isAbove ? 'above' : 'below'}`;

      document.getElementById('sim-gap-value').textContent =
        `R$ ${data.income_gap > 0 ? '+' : ''}${Math.round(data.income_gap).toLocaleString('pt-BR')}`;
      document.getElementById('sim-gap-explanation').textContent =
        `O colaborador recebe R$ ${Math.abs(Math.round(data.income_gap)).toLocaleString('pt-BR')} ${isAbove ? 'a mais' : 'a menos'} do que a expectativa estatística para sua senioridade e tempo de carreira.`;
    } else {
      gapBox.style.display = 'none';
    }
  } catch (err) {
    console.error('Erro na previsão:', err);
  }
}


function setupImpactControls() {
  const slider = document.getElementById('impact-slider');
  slider.addEventListener('input', () => {
    const pct = parseInt(slider.value);
    document.getElementById('impact-slider-val').textContent =
      `${pct}% (${pct === 100 ? 'Redução Total da Taxa Excedente' : 'Intervenção Parcial'})`;
    calculateImpactSimulation(pct / 100);
  });
}

async function calculateImpactSimulation(reduction) {
  try {
    const res = await fetch('/api/simulation/impact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reductionPct: reduction }),
    });
    const data = await res.json();

    document.getElementById('impact-avoided-point').textContent =
      `${data.saidas_evitadas_estimativa_pontual.toFixed(1)} colaboradores`;
    document.getElementById('impact-pct-total').textContent =
      `Corresponde a ${data.proporcao_do_total_de_saidas_evitadas_pct.toFixed(1)}% de todas as saídas da organização`;
    document.getElementById('impact-ci-range').textContent =
      `[${data.intervalo_confianca_95_saidas_evitadas[0].toFixed(1)} a ${data.intervalo_confianca_95_saidas_evitadas[1].toFixed(1)} saídas evitadas]`;
  } catch (err) {
    console.error('Erro na simulação de impacto:', err);
  }
}


function setupDataPagination() {
  const prevBtn = document.getElementById('btn-prev-page');
  const nextBtn = document.getElementById('btn-next-page');

  prevBtn.addEventListener('click', () => {
    if (state.dataPage > 0) {
      state.dataPage--;
      loadDataPreview();
    }
  });

  nextBtn.addEventListener('click', () => {
    state.dataPage++;
    loadDataPreview();
  });
}

async function loadDataPreview() {
  const offset = state.dataPage * state.pageSize;
  try {
    const res = await fetch(
      `/api/data-preview?limit=${state.pageSize}&offset=${offset}`,
    );
    const json = await res.json();

    const tbody = document.querySelector('#table-raw-data tbody');
    tbody.innerHTML = '';

    json.data.forEach((r) => {
      const tr = document.createElement('tr');
      const gapColor = r.IncomeGap < 0 ? '#f43f5e' : '#10b981';
      tr.innerHTML = `
        <td>${r.Age}</td>
        <td><strong style="color: ${r.Attrition === 'Yes' ? '#f43f5e' : '#10b981'}">${r.Attrition}</strong></td>
        <td>${r.Department}</td>
        <td>${r.JobRole}</td>
        <td>Nível ${r.JobLevel}</td>
        <td>R$ ${r.MonthlyIncome.toLocaleString('pt-BR')}</td>
        <td>${r.OverTime}</td>
        <td>${r.YearsAtCompany}</td>
        <td>${r.TotalWorkingYears}</td>
        <td style="color: ${gapColor}; font-weight: 600;">R$ ${r.IncomeGap > 0 ? '+' : ''}${Math.round(r.IncomeGap).toLocaleString('pt-BR')}</td>
      `;
      tbody.appendChild(tr);
    });

    const start = offset + 1;
    const end = Math.min(offset + state.pageSize, json.total);
    document.getElementById('data-count-info').textContent =
      `Exibindo registros ${start} a ${end} de ${json.total.toLocaleString('pt-BR')}`;
    document.getElementById('pagination-label').textContent =
      `Página ${state.dataPage + 1}`;

    document.getElementById('btn-prev-page').disabled = state.dataPage === 0;
    document.getElementById('btn-next-page').disabled = end >= json.total;
  } catch (err) {
    console.error('Erro ao carregar tabela de dados:', err);
  }
}


function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
