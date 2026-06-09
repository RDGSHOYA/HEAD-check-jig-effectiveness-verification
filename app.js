const HEAD_MASTERS = [
  { partNo: '1000023601', name: 'ASSY,PRINT HEAD SUPPLY WF1 SC3890', cost: 68000 },
  { partNo: '1000026211', name: 'HEAD,INKJET CG2266', cost: 87000 },
  { partNo: '1000028697', name: 'HEAD,INKJET 84A CG2298', cost: 72500 },
  { partNo: '1000029234', name: 'HEAD,INKJET CG2320', cost: 87000 },
  { partNo: '6000005180', name: 'ASSY,HEAD INKJET SV LEF2-300', cost: 27095 },
  { partNo: '6000005213', name: 'ASSY,HEAD INKJET SOL XC-540 SV2', cost: 27095 },
  { partNo: '6000005286', name: 'ASSY,HEAD INKJET SV CG2125', cost: 102974 },
  { partNo: '6000005411', name: 'ASSY,HEAD INKJET SV VS-640', cost: 89565 },
  { partNo: '6000005975', name: 'ASSY,IJ HEAD SOL 200L SV2 VG-640', cost: 28756 },
  { partNo: '6000006702', name: 'ASSY,IJ HEAD SOL 250L SV CG2208', cost: 29024 },
  { partNo: '6000006964', name: 'ASSY,HEAD INKJET SV CG2183', cost: 120560 },
];

const EXCHANGE_MINUTES = 120;
const NO_EXCHANGE_MINUTES = 76;
const REQUIRED_AFTER_CHECK_MINUTES = 156;
const COLORS = ['#2563eb', '#dc2626'];

const state = {
  laborRate: 40,
  inputs: Object.fromEntries(HEAD_MASTERS.map((head) => [head.partNo, { total: 0, unnecessary: 0 }])),
};

const elements = {
  laborRate: document.querySelector('#laborRate'),
  kpis: document.querySelector('#kpis'),
  rankingChart: document.querySelector('#rankingChart'),
  donutChart: document.querySelector('#donutChart'),
  compositionLegend: document.querySelector('#compositionLegend'),
  stackedChart: document.querySelector('#stackedChart'),
  topChart: document.querySelector('#topChart'),
  detailRows: document.querySelector('#detailRows'),
};

function clamp(value, max) {
  const numeric = Math.max(0, Math.floor(Number(value) || 0));
  return typeof max === 'number' ? Math.min(numeric, max) : numeric;
}

function yen(value) {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
    maximumFractionDigits: 0,
  }).format(value);
}

function compactYen(value) {
  const sign = value < 0 ? '-' : '';
  const amount = Math.abs(value);
  if (amount >= 100000000) return `${sign}${(amount / 100000000).toFixed(2)}億円`;
  if (amount >= 10000) return `${sign}${(amount / 10000).toFixed(1)}万円`;
  return yen(value);
}

function percent(value) {
  return `${value.toFixed(1)}%`;
}

function calculate(head) {
  const input = state.inputs[head.partNo];
  const unnecessary = Math.min(input.unnecessary, input.total);
  const required = input.total - unnecessary;
  const partsSavings = head.cost * unnecessary;
  const traditionalLaborCost = EXCHANGE_MINUTES * state.laborRate * input.total;
  const checkedLaborCost =
    NO_EXCHANGE_MINUTES * state.laborRate * unnecessary + REQUIRED_AFTER_CHECK_MINUTES * state.laborRate * required;
  const laborSavings = traditionalLaborCost - checkedLaborCost;
  const totalSavings = partsSavings + laborSavings;
  const baseCost = (head.cost + EXCHANGE_MINUTES * state.laborRate) * input.total;
  const reductionRate = baseCost > 0 ? (totalSavings / baseCost) * 100 : 0;

  return { ...head, total: input.total, unnecessary, required, partsSavings, laborSavings, totalSavings, baseCost, reductionRate };
}

function getRows() {
  return HEAD_MASTERS.map(calculate);
}

function getTotals(rows) {
  const total = rows.reduce(
    (acc, row) => {
      acc.total += row.total;
      acc.unnecessary += row.unnecessary;
      acc.required += row.required;
      acc.partsSavings += row.partsSavings;
      acc.laborSavings += row.laborSavings;
      acc.totalSavings += row.totalSavings;
      acc.baseCost += row.baseCost;
      return acc;
    },
    { total: 0, unnecessary: 0, required: 0, partsSavings: 0, laborSavings: 0, totalSavings: 0, baseCost: 0 },
  );
  total.reductionRate = total.baseCost > 0 ? (total.totalSavings / total.baseCost) * 100 : 0;
  return total;
}

function renderKpis(totals) {
  const kpis = [
    ['総交換件数', `${totals.total.toLocaleString('ja-JP')}件`, 'No'],
    ['交換不要件数', `${totals.unnecessary.toLocaleString('ja-JP')}件`, 'OK'],
    ['チェック後交換件数', `${totals.required.toLocaleString('ja-JP')}件`, 'EX'],
    ['削減部品費', compactYen(totals.partsSavings), '¥'],
    ['工数効果額', compactYen(totals.laborSavings), '工'],
    ['正味効果額', compactYen(totals.totalSavings), '+'],
    ['削減率', percent(totals.reductionRate), '%'],
  ];

  elements.kpis.innerHTML = kpis
    .map(
      ([label, value, icon]) => `
        <article class="kpi-card">
          <div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon}</span></div>
          <div class="kpi-value">${value}</div>
        </article>
      `,
    )
    .join('');
}

function renderRanking(rows) {
  const chartRows = rows.filter((row) => row.totalSavings !== 0).sort((a, b) => b.totalSavings - a.totalSavings);
  if (!chartRows.length) {
    elements.rankingChart.innerHTML = '<div class="empty-state">件数を入力するとランキングを表示します</div>';
    return;
  }

  const max = Math.max(...chartRows.map((row) => Math.abs(row.totalSavings)));
  elements.rankingChart.innerHTML = chartRows
    .map(
      (row) => `
        <div class="bar-row" title="${row.name}: ${yen(row.totalSavings)}">
          <div class="bar-label">${row.name}</div>
          <div class="bar-track"><div class="bar-fill ${row.totalSavings < 0 ? 'negative' : ''}" style="width: ${(Math.abs(row.totalSavings) / max) * 100}%"></div></div>
          <div class="bar-value">${compactYen(row.totalSavings)}</div>
        </div>
      `,
    )
    .join('');
}

function renderDonut(totals) {
  const values = [
    { label: '削減部品費', value: totals.partsSavings, color: COLORS[0] },
    { label: totals.laborSavings >= 0 ? '工数削減額' : '工数増加額', value: Math.abs(totals.laborSavings), color: COLORS[1] },
  ];
  const sum = values.reduce((acc, item) => acc + item.value, 0);

  if (sum === 0) {
    elements.donutChart.innerHTML = '<circle cx="110" cy="110" r="72" fill="none" stroke="#ece8df" stroke-width="30" />';
    elements.compositionLegend.innerHTML = '<div class="empty-state">効果額を入力すると構成比を表示します</div>';
    return;
  }

  const radius = 72;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  const circles = values
    .map((item) => {
      const length = (item.value / sum) * circumference;
      const circle = `
        <circle cx="110" cy="110" r="${radius}" fill="none" stroke="${item.color}" stroke-width="30"
          stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}"
          transform="rotate(-90 110 110)" />
      `;
      offset += length;
      return circle;
    })
    .join('');

  elements.donutChart.innerHTML = `
    <circle cx="110" cy="110" r="${radius}" fill="none" stroke="#ece8df" stroke-width="30" />
    ${circles}
    <text x="110" y="104" text-anchor="middle" font-size="15" font-weight="800" fill="#211f1b">正味効果</text>
    <text x="110" y="128" text-anchor="middle" font-size="17" font-weight="900" fill="${totals.totalSavings < 0 ? '#dc2626' : '#1d4ed8'}">${compactYen(totals.totalSavings)}</text>
  `;
  elements.compositionLegend.innerHTML = values
    .map(
      (item) => `
      <div class="legend-item">
        <span class="swatch" style="background:${item.color}"></span>
        <div><strong>${item.label}</strong><span>${yen(item.value)} / ${percent((item.value / sum) * 100)}</span></div>
      </div>
    `,
    )
    .join('');
}

function renderVerticalCharts(rows) {
  const topFive = rows.filter((row) => row.totalSavings !== 0).sort((a, b) => b.totalSavings - a.totalSavings).slice(0, 5);
  if (!topFive.length) {
    elements.stackedChart.innerHTML = '<div class="empty-state">TOP5を表示するデータがありません</div>';
    elements.topChart.innerHTML = '<div class="empty-state">TOP5を表示するデータがありません</div>';
    return;
  }

  const max = Math.max(...topFive.map((row) => Math.abs(row.totalSavings)));
  elements.stackedChart.innerHTML = topFive
    .map((row) => {
      const height = Math.max(6, (Math.abs(row.totalSavings) / max) * 210);
      const componentTotal = Math.max(row.partsSavings + Math.abs(row.laborSavings), 1);
      const partsHeight = (row.partsSavings / componentTotal) * height;
      const laborHeight = (Math.abs(row.laborSavings) / componentTotal) * height;
      return `
        <div class="vertical-item" title="${row.name}">
          <div class="vertical-bar-wrap">
            <div>
              <div class="vertical-value">${compactYen(row.totalSavings)}</div>
              <div class="vertical-bar" style="height:${height}px">
                <div class="segment-part" style="height:${partsHeight}px"></div>
                <div class="segment-labor ${row.laborSavings < 0 ? 'negative' : ''}" style="height:${laborHeight}px"></div>
              </div>
            </div>
          </div>
          <div class="vertical-label">${row.name}</div>
        </div>
      `;
    })
    .join('');

  elements.topChart.innerHTML = topFive
    .map((row) => {
      const height = Math.max(6, (Math.abs(row.totalSavings) / max) * 210);
      return `
        <div class="vertical-item" title="${row.name}: ${yen(row.totalSavings)}">
          <div class="vertical-bar-wrap">
            <div>
              <div class="vertical-value">${compactYen(row.totalSavings)}</div>
              <div class="vertical-bar" style="height:${height}px"><div class="segment-total ${row.totalSavings < 0 ? 'negative' : ''}" style="height:${height}px"></div></div>
            </div>
          </div>
          <div class="vertical-label">${row.name}</div>
        </div>
      `;
    })
    .join('');
}

function renderTable(rows) {
  elements.detailRows.innerHTML = rows
    .map(
      (row) => `
      <tr>
        <td>${row.partNo}</td>
        <td class="head-name">${row.name}</td>
        <td class="number">${yen(row.cost)}</td>
        <td class="number"><input class="table-input" data-part="${row.partNo}" data-field="total" type="number" min="0" value="${row.total}" /></td>
        <td class="number"><input class="table-input" data-part="${row.partNo}" data-field="unnecessary" type="number" min="0" max="${row.total}" value="${row.unnecessary}" /></td>
        <td class="number" data-part="${row.partNo}" data-output="partsSavings">${yen(row.partsSavings)}</td>
        <td class="number ${row.laborSavings < 0 ? 'negative-text' : ''}" data-part="${row.partNo}" data-output="laborSavings">${yen(row.laborSavings)}</td>
        <td class="number strong-number" data-part="${row.partNo}" data-output="totalSavings">${yen(row.totalSavings)}</td>
        <td class="number" data-part="${row.partNo}" data-output="reductionRate">${percent(row.reductionRate)}</td>
      </tr>
    `,
    )
    .join('');
}

function updateTableResults(rows) {
  rows.forEach((row) => {
    const totalInput = elements.detailRows.querySelector(`input[data-part="${row.partNo}"][data-field="total"]`);
    const unnecessaryInput = elements.detailRows.querySelector(`input[data-part="${row.partNo}"][data-field="unnecessary"]`);
    totalInput.value = String(row.total);
    unnecessaryInput.value = String(row.unnecessary);
    unnecessaryInput.max = String(row.total);

    elements.detailRows.querySelector(`[data-part="${row.partNo}"][data-output="partsSavings"]`).textContent = yen(row.partsSavings);
    const laborOutput = elements.detailRows.querySelector(`[data-part="${row.partNo}"][data-output="laborSavings"]`);
    const totalOutput = elements.detailRows.querySelector(`[data-part="${row.partNo}"][data-output="totalSavings"]`);
    laborOutput.textContent = yen(row.laborSavings);
    totalOutput.textContent = yen(row.totalSavings);
    laborOutput.classList.toggle('negative-text', row.laborSavings < 0);
    totalOutput.classList.toggle('negative-text', row.totalSavings < 0);
    elements.detailRows.querySelector(`[data-part="${row.partNo}"][data-output="reductionRate"]`).textContent = percent(row.reductionRate);
  });
}

function renderDashboard() {
  const rows = getRows();
  const totals = getTotals(rows);
  renderKpis(totals);
  renderRanking(rows);
  renderDonut(totals);
  renderVerticalCharts(rows);
  updateTableResults(rows);
}

elements.laborRate.addEventListener('input', (event) => {
  state.laborRate = clamp(event.target.value);
  elements.laborRate.value = String(state.laborRate);
  renderDashboard();
});

elements.detailRows.addEventListener('input', (event) => {
  const input = event.target;
  if (!input.matches('.table-input')) return;
  const partNo = input.dataset.part;
  const field = input.dataset.field;
  const current = state.inputs[partNo];

  if (field === 'total') {
    current.total = clamp(input.value);
    current.unnecessary = Math.min(current.unnecessary, current.total);
  } else {
    current.unnecessary = clamp(input.value, current.total);
  }

  input.value = String(current[field]);
  renderDashboard();
});

renderTable(getRows());
renderDashboard();
