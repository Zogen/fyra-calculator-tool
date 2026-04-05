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
   UNIT HANDLING
================================ */

// Sub-lengths are always in cm. This converts stock bar & kerf to cm.
function toСm(value, unit) {
  if (unit === 'm')  return value * 100;
  if (unit === 'mm') return value / 10;
  return value; // already cm
}

function updateUnitLabels() {
  const unit = document.getElementById('stockUnit').value;
  document.getElementById('kerfUnit').textContent = unit;
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
    const length = parseFloat(inputs[1].value.replace(',', '.'));
    const qty = parseInt(inputs[2].value);
    if (!isNaN(length) && length > 0 && !isNaN(qty) && qty > 0) {
      for (let i = 0; i < qty; i++) {
        pieces.push({ label: label || null, length, qty: 1 });
      }
    }
  });
  return pieces;
}

function parseCSVInput() {
  const raw = document.getElementById('csvInput').value;
  const errEl = document.getElementById('csvError');
  errEl.style.display = 'none';

  if (!raw.trim()) {
    errEl.textContent = 'Please enter some data.';
    errEl.style.display = 'block';
    return null;
  }

  // Split into rows, then split each row by tab (Excel paste format)
  const rows = raw.split('\n').map(r => r.split('\t'));
  const numCols = Math.max(...rows.map(r => r.length));

  // First row is headers: "Label xN" per column
  const headers = rows[0];
  const columns = [];

  for (let c = 0; c < numCols; c++) {
    const header = (headers[c] || '').trim();
    if (!header) continue; // skip empty columns

    const headerMatch = header.match(/^(.+?)\s*:\s*(\d+)$/i);
    if (!headerMatch) {
      errEl.textContent = `Column ${c + 1}: header "${header}" must be "Label: <quantity>" (e.g. "ΤΕΜΑΧΙΑ: 5").`;
      errEl.style.display = 'block';
      return null;
    }

    columns.push({
      label: headerMatch[1].trim(),
      qty: parseInt(headerMatch[2]),
      colIndex: c,
      lengths: []
    });
  }

  if (!columns.length) {
    errEl.textContent = 'No valid column headers found.';
    errEl.style.display = 'block';
    return null;
  }

  // Remaining rows are lengths — collect non-empty cells per column
  for (let r = 1; r < rows.length; r++) {
    for (const col of columns) {
      const cell = (rows[r][col.colIndex] || '').trim();
      if (!cell) continue;
      // Accept both dot and comma as decimal separator
      const length = parseFloat(cell.replace(',', '.'));
      if (isNaN(length) || length <= 0) {
        errEl.textContent = `Row ${r + 1}, column "${col.label}": invalid length "${cell}".`;
        errEl.style.display = 'block';
        return null;
      }
      col.lengths.push(length);
    }
  }

  // qty is a multiplier per row — each unique length gets qty pieces
  const pieces = [];
  for (const col of columns) {
    for (const length of col.lengths) {
      for (let i = 0; i < col.qty; i++) {
        pieces.push({ label: col.label, length, qty: 1 });
      }
    }
  }

  if (!pieces.length) {
    errEl.textContent = 'No valid pieces found.';
    errEl.style.display = 'block';
    return null;
  }

  return pieces;
}

/* ================================
   OPTIMIZATION ALGORITHM
================================ */

function optimizeCut(pieces, STOCK, kerf) {
  const allPieces = pieces.map((p, typeIdx) => ({ ...p, typeIdx }));
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
  const unit = document.getElementById('stockUnit').value;
  const STOCK = toСm(parseFloat(document.getElementById('stockLength').value), unit);
  const kerf = toСm(parseFloat(document.getElementById('kerfWidth').value) || 0, unit);
  if (isNaN(STOCK) || STOCK <= 0) return;

  // Assign a typeIdx per unique label for coloring
  const labelIndex = {};
  let colorCounter = 0;
  pieces.forEach(p => {
    const key = p.label || '__unlabelled__';
    if (labelIndex[key] === undefined) labelIndex[key] = colorCounter++;
    p.typeIdx = labelIndex[key];
  });

  const bars = optimizeCut(pieces, STOCK, kerf);

  const totalUsed = bars.reduce((s, bar) => s + bar.reduce((ss, p) => ss + p.length, 0), 0);
  const totalWaste = bars.reduce((s, bar) => {
    const used = bar.reduce((ss, p) => ss + p.length + kerf, 0);
    return s + Math.max(0, STOCK - used);
  }, 0);
  const totalRequired = pieces.reduce((s, p) => s + p.length, 0);
  const minBars = Math.ceil(totalRequired / STOCK);
  const efficiency = (totalUsed / (bars.length * STOCK) * 100);
  const effClass = efficiency >= 90 ? 'efficiency-good' : efficiency >= 75 ? 'efficiency-ok' : 'efficiency-poor';

  // Build legend entries: one per unique label
  const legendEntries = Object.entries(labelIndex).map(([key, idx]) => {
    const label = key === '__unlabelled__' ? null : key;
    const count = pieces.filter(p => p.label === label).length;
    return { label, idx, count };
  });

  renderSummary(bars.length, minBars, totalWaste, efficiency, effClass);
  renderLegend(legendEntries);
  renderBarsVisual(bars, STOCK, kerf);
  renderResultsTable(bars, STOCK, kerf);

  const section = document.getElementById('resultsSection');
  section.style.display = 'block';
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
      <div class="stat-sub">cm across all bars</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Efficiency</div>
      <div class="stat-value">${efficiency.toFixed(1)}%</div>
      <div class="stat-sub"><span class="efficiency-pill ${effClass}">${efficiency >= 90 ? 'Excellent' : efficiency >= 75 ? 'Good' : 'Poor'}</span></div>
    </div>`;
}

function renderLegend(legendEntries) {
  document.getElementById('legend').innerHTML =
    legendEntries.map(e => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${COLORS[e.idx % COLORS.length]}"></div>
        <span>${e.label || 'Piece'} ×${e.count} (cm)</span>
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
      return `<div class="bar-segment" style="width:${w}%;background:${color}" title="${p.label ? p.label + ' ' : ''}${p.length}cm">${showLabel ? p.length + 'cm' : ''}</div>`;
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
      `<span class="piece-chip" style="background:${COLORS[p.typeIdx % COLORS.length]}">${p.label ? p.label + ' ' : ''}${p.length}cm</span>`
    ).join('');

    return `
      <tr>
        <td>B${idx + 1}</td>
        <td class="pieces-cell">${piecesHtml}</td>
        <td>${totalUsedWithKerf.toFixed(2)} cm</td>
        <td>${waste.toFixed(2)} cm</td>
        <td><span class="efficiency-pill ${effClass}">${eff.toFixed(1)}%</span></td>
      </tr>`;
  }).join('');
}