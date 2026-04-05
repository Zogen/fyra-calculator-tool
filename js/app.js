const COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
  '#ef4444', '#06b6d4', '#84cc16', '#f97316',
  '#e879f9', '#34d399'
];

/* ================================
   TAB SWITCHING
================================ */

function switchTab(name) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', (i === 0 && name === 'manual') || (i === 1 && name === 'csv'));
  });
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

/* ================================
   MANUAL INPUT ROWS
================================ */

function addRow() {
  const tbody = document.querySelector('#inputTable tbody');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="td-input"><input type="text" placeholder="Label"/></td>
    <td class="td-input"><input type="number" step="0.01" min="0.01" placeholder="0.00"/></td>
    <td class="td-input"><input type="number" min="1" placeholder="1"/></td>
    <td style="width:48px;text-align:center"><button class="btn-remove" onclick="removeRow(this)">✕</button></td>
  `;
  tbody.appendChild(tr);
}

function removeRow(btn) {
  const tbody = btn.closest('tbody');
  if (tbody.rows.length > 1) btn.closest('tr').remove();
}

/* ================================
   CSV INPUT
================================ */

function clearCSV() {
  document.getElementById('csvInput').value = '';
  document.getElementById('csvError').style.display = 'none';
}

/* ================================
   PARSERS
================================ */

function parseManualInput() {
  const rows = document.querySelectorAll('#inputTable tbody tr');
  const pieces = [];
  rows.forEach(row => {
    const inputs = row.querySelectorAll('input');
    const label = inputs[0].value.trim();
    const length = parseFloat(inputs[1].value);
    const qty = parseInt(inputs[2].value);
    if (!isNaN(length) && length > 0 && !isNaN(qty) && qty > 0) {
      pieces.push({ label: label || null, length, qty });
    }
  });
  return pieces;
}

function parseCSVInput() {
  const raw = document.getElementById('csvInput').value.trim();
  const errEl = document.getElementById('csvError');
  errEl.style.display = 'none';

  if (!raw) {
    errEl.textContent = 'Please enter some data.';
    errEl.style.display = 'block';
    return null;
  }

  const pieces = [];
  const lines = raw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));

  for (let i = 0; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim());
    let label = null, length, qty;

    if (parts.length === 2) {
      length = parseFloat(parts[0]);
      qty = parseInt(parts[1]);
    } else if (parts.length >= 3) {
      label = parts[0];
      length = parseFloat(parts[1]);
      qty = parseInt(parts[2]);
    } else {
      errEl.textContent = `Line ${i + 1}: expected "length, quantity" or "label, length, quantity".`;
      errEl.style.display = 'block';
      return null;
    }

    if (isNaN(length) || length <= 0 || isNaN(qty) || qty <= 0) {
      errEl.textContent = `Line ${i + 1}: invalid length or quantity.`;
      errEl.style.display = 'block';
      return null;
    }

    pieces.push({ label, length, qty });
  }

  if (!pieces.length) {
    errEl.textContent = 'No valid rows found.';
    errEl.style.display = 'block';
    return null;
  }

  return pieces;
}

/* ================================
   OPTIMIZATION ALGORITHM
================================ */

function optimizeCut(pieces, STOCK, kerf) {
  const allPieces = [];
  pieces.forEach((p, typeIdx) => {
    for (let j = 0; j < p.qty; j++) {
      allPieces.push({ length: p.length, typeIdx, label: p.label });
    }
  });
  allPieces.sort((a, b) => b.length - a.length);

  const bars = [];
  for (const piece of allPieces) {
    let placed = false;
    for (const bar of bars) {
      const used = bar.reduce((s, p) => s + p.length + kerf, 0);
      if (used + piece.length <= STOCK) {
        bar.push(piece);
        placed = true;
        break;
      }
    }
    if (!placed) bars.push([piece]);
  }
  return bars;
}

/* ================================
   ENTRY POINTS
================================ */

function calculate() {
  const pieces = parseManualInput();
  if (!pieces.length) return;
  runCalculation(pieces);
}

function calculateCSV() {
  const pieces = parseCSVInput();
  if (!pieces) return;
  runCalculation(pieces);
}

/* ================================
   RENDER RESULTS
================================ */

function runCalculation(pieces) {
  const STOCK = parseFloat(document.getElementById('stockLength').value);
  const kerf = parseFloat(document.getElementById('kerfWidth').value) || 0;
  if (isNaN(STOCK) || STOCK <= 0) return;

  const bars = optimizeCut(pieces, STOCK, kerf);

  const totalUsed = bars.reduce((s, bar) => s + bar.reduce((ss, p) => ss + p.length, 0), 0);
  const totalWaste = bars.reduce((s, bar) => {
    const used = bar.reduce((ss, p) => ss + p.length + kerf, 0);
    return s + Math.max(0, STOCK - used);
  }, 0);
  const totalRequired = pieces.reduce((s, p) => s + p.length * p.qty, 0);
  const minBars = Math.ceil(totalRequired / STOCK);
  const efficiency = (totalUsed / (bars.length * STOCK) * 100);
  const effClass = efficiency >= 90 ? 'efficiency-good' : efficiency >= 75 ? 'efficiency-ok' : 'efficiency-poor';

  renderSummary(bars.length, minBars, totalWaste, efficiency, effClass);
  renderLegend(pieces);
  renderBarsVisual(bars, STOCK, kerf);
  renderResultsTable(bars, STOCK, kerf);

  const section = document.getElementById('resultsSection');
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  pieces.forEach((p, i) => p.typeIdx = i);
}

function renderSummary(barsCount, minBars, totalWaste, efficiency, effClass) {
  document.getElementById('summaryGrid').innerHTML = `
    <div class="stat-card">
      <div class="stat-label">Bars needed</div>
      <div class="stat-value">${barsCount}</div>
      <div class="stat-sub">Min possible: ${minBars}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Total waste</div>
      <div class="stat-value">${totalWaste.toFixed(3)}</div>
      <div class="stat-sub">m across all bars</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Efficiency</div>
      <div class="stat-value">${efficiency.toFixed(1)}%</div>
      <div class="stat-sub"><span class="efficiency-pill ${effClass}">${efficiency >= 90 ? 'Excellent' : efficiency >= 75 ? 'Good' : 'Poor'}</span></div>
    </div>`;
}

function renderLegend(pieces) {
  document.getElementById('legend').innerHTML =
    pieces.map((p, i) => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></div>
        <span>${p.label ? p.label + ' ' : ''}${p.length}m ×${p.qty}</span>
      </div>`
    ).join('') +
    `<div class="legend-item">
      <div class="legend-dot" style="background:var(--surface-2);border:1px dashed var(--border-strong)"></div>
      <span>Waste</span>
    </div>`;
}

function renderBarsVisual(bars, STOCK, kerf) {
  document.getElementById('barsVisual').innerHTML = bars.map((bar, idx) => {
    const barUsed = bar.reduce((s, p) => s + p.length + kerf, 0);
    const waste = Math.max(0, STOCK - barUsed);

    const segs = bar.map(p => {
      const w = (p.length / STOCK * 100).toFixed(2);
      const color = COLORS[p.typeIdx % COLORS.length];
      const showLabel = p.length / STOCK > 0.08;
      return `<div class="bar-segment" style="width:${w}%;background:${color}" title="${p.label ? p.label + ' ' : ''}${p.length}m">${showLabel ? p.length + 'm' : ''}</div>`;
    }).join('');

    const wasteW = (waste / STOCK * 100).toFixed(2);
    const wasteBlock = waste > 0.001
      ? `<div class="waste-segment" style="width:${wasteW}%"></div>`
      : '';

    return `
      <div class="bar-row">
        <div class="bar-label">B${idx + 1}</div>
        <div class="bar-track">${segs}${wasteBlock}</div>
        <div class="bar-waste-label">${waste > 0.001 ? '−' + waste.toFixed(3) + 'm' : '✓'}</div>
      </div>`;
  }).join('');
}

function renderResultsTable(bars, STOCK, kerf) {
  document.querySelector('#resultsTable tbody').innerHTML = bars.map((bar, idx) => {
    const used = bar.reduce((s, p) => s + p.length, 0);
    const totalUsedWithKerf = used + bar.length * kerf;
    const waste = Math.max(0, STOCK - totalUsedWithKerf);
    const eff = (totalUsedWithKerf / STOCK * 100);
    const effClass = eff >= 90 ? 'efficiency-good' : eff >= 75 ? 'efficiency-ok' : 'efficiency-poor';

    const piecesHtml = bar.map(p =>
      `<span class="piece-chip" style="background:${COLORS[p.typeIdx % COLORS.length]}">${p.label ? p.label + ' ' : ''}${p.length}m</span>`
    ).join('');

    return `
      <tr>
        <td>B${idx + 1}</td>
        <td class="pieces-cell">${piecesHtml}</td>
        <td>${totalUsedWithKerf.toFixed(3)} m</td>
        <td>${waste.toFixed(3)} m</td>
        <td><span class="efficiency-pill ${effClass}">${eff.toFixed(1)}%</span></td>
      </tr>`;
  }).join('');
}
