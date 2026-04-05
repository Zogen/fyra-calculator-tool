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

  // Store for export
  _lastExport = { pieces, bars, STOCK, kerf, unit };

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

/* ================================
   EXPORT STATE
================================ */

let _lastExport = null; // { pieces, bars, STOCK, kerf, unit }

/* ================================
   EXPORT CSV
================================ */

function exportCSV() {
  if (!_lastExport) return;
  const { pieces, bars, STOCK, kerf, unit } = _lastExport;

  const totalUsed = bars.reduce((s, bar) => s + bar.reduce((ss, p) => ss + p.length, 0), 0);
  const totalWaste = bars.reduce((s, bar) => {
    const used = bar.reduce((ss, p) => ss + p.length + kerf, 0);
    return s + Math.max(0, STOCK - used);
  }, 0);
  const efficiency = (totalUsed / (bars.length * STOCK) * 100);

  const rows = [];

  // Header / input parameters
  rows.push(['Fyra Calculator — Cut Plan']);
  rows.push(['Generated', new Date().toLocaleString()]);
  rows.push([]);
  rows.push(['INPUT PARAMETERS']);
  rows.push(['Stock Bar Length', STOCK + ' cm', '(entered in ' + unit + ')']);
  rows.push(['Kerf Width', kerf + ' cm']);
  rows.push(['Total Pieces', pieces.length]);
  rows.push([]);

  // Summary
  rows.push(['SUMMARY']);
  rows.push(['Bars Used', bars.length]);
  rows.push(['Total Waste (cm)', totalWaste.toFixed(2)]);
  rows.push(['Efficiency (%)', efficiency.toFixed(1)]);
  rows.push([]);

  // Cut details
  rows.push(['CUT DETAILS']);
  rows.push(['Bar', 'Pieces (label + length cm)', 'Used (cm)', 'Waste (cm)', 'Efficiency (%)']);
  bars.forEach((bar, idx) => {
    const used = bar.reduce((s, p) => s + p.length, 0);
    const totalUsedWithKerf = used + bar.length * kerf;
    const waste = Math.max(0, STOCK - totalUsedWithKerf);
    const eff = (totalUsedWithKerf / STOCK * 100);
    const piecesStr = bar.map(p => (p.label ? p.label + ' ' : '') + p.length + 'cm').join(' | ');
    rows.push([
      'B' + (idx + 1),
      piecesStr,
      totalUsedWithKerf.toFixed(2),
      waste.toFixed(2),
      eff.toFixed(1)
    ]);
  });

  const csv = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fyra-cut-plan.csv';
  a.click();
  URL.revokeObjectURL(url);
}

/* ================================
   EXPORT PDF
================================ */

function exportPDF() {
  if (!_lastExport) return;
  const { pieces, bars, STOCK, kerf, unit } = _lastExport;

  const totalUsed = bars.reduce((s, bar) => s + bar.reduce((ss, p) => ss + p.length, 0), 0);
  const totalWaste = bars.reduce((s, bar) => {
    const used = bar.reduce((ss, p) => ss + p.length + kerf, 0);
    return s + Math.max(0, STOCK - used);
  }, 0);
  const totalRequired = pieces.reduce((s, p) => s + p.length, 0);
  const minBars = Math.ceil(totalRequired / STOCK);
  const efficiency = (totalUsed / (bars.length * STOCK) * 100);
  const effLabel = efficiency >= 90 ? 'Excellent' : efficiency >= 75 ? 'Good' : 'Poor';

  // Build bar visual rows as SVG-like HTML blocks (scaled)
  const barsHtml = bars.map((bar, idx) => {
    const barUsed = bar.reduce((s, p) => s + p.length + kerf, 0);
    const waste = Math.max(0, STOCK - barUsed);
    const segs = bar.map(p => {
      const w = (p.length / STOCK * 100).toFixed(2);
      const color = COLORS[p.typeIdx % COLORS.length];
      return `<div style="width:${w}%;height:100%;background:${color};display:inline-flex;align-items:center;justify-content:center;font-size:9px;color:#fff;font-weight:600;overflow:hidden;white-space:nowrap;">${p.length > STOCK * 0.08 ? p.length + 'cm' : ''}</div>`;
    }).join('');
    const wasteW = (waste / STOCK * 100).toFixed(2);
    const wasteBlock = waste > 0.01 ? `<div style="width:${wasteW}%;height:100%;background:#f1f5f9;border-left:1px dashed #cbd5e1;box-sizing:border-box;"></div>` : '';
    return `
      <tr>
        <td style="font-size:11px;font-weight:600;color:#6b7280;padding:4px 8px 4px 0;white-space:nowrap;">B${idx+1}</td>
        <td style="padding:3px 0;">
          <div style="width:100%;height:22px;display:flex;border-radius:4px;overflow:hidden;border:1px solid #e3e7ef;">${segs}${wasteBlock}</div>
        </td>
        <td style="font-size:10px;color:#9ca3af;padding:4px 0 4px 8px;white-space:nowrap;">${waste > 0.01 ? '−'+waste.toFixed(2)+'cm' : '✓'}</td>
      </tr>`;
  }).join('');

  const tableRows = bars.map((bar, idx) => {
    const used = bar.reduce((s, p) => s + p.length, 0);
    const totalUsedWithKerf = used + bar.length * kerf;
    const waste = Math.max(0, STOCK - totalUsedWithKerf);
    const eff = (totalUsedWithKerf / STOCK * 100);
    const piecesStr = bar.map(p => (p.label ? p.label + ' ' : '') + p.length + 'cm').join(', ');
    return `<tr style="border-bottom:1px solid #f1f5f9;">
      <td style="padding:6px 10px;font-size:11px;font-weight:600;color:#6b7280;">B${idx+1}</td>
      <td style="padding:6px 10px;font-size:11px;font-family:monospace;">${piecesStr}</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;">${totalUsedWithKerf.toFixed(2)}</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;">${waste.toFixed(2)}</td>
      <td style="padding:6px 10px;font-size:11px;text-align:right;">${eff.toFixed(1)}%</td>
    </tr>`;
  }).join('');

  const html = `<!doctype html><html><head><meta charset="UTF-8"/>
  <title>Fyra Cut Plan</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; color: #111827; padding: 32px; font-size: 13px; }
    h1 { font-size: 20px; font-weight: 700; letter-spacing: -0.02em; }
    h2 { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #6b7280; margin: 24px 0 10px; }
    .badge { font-size: 9px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #2563eb; background: #eff6ff; padding: 2px 7px; border-radius: 20px; border: 1px solid #bfdbfe; vertical-align: middle; margin-left: 8px; }
    .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
    .params { display: flex; gap: 24px; flex-wrap: wrap; margin-bottom: 8px; }
    .param { background: #f8f9fc; border: 1px solid #e3e7ef; border-radius: 8px; padding: 10px 14px; }
    .param-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 2px; }
    .param-value { font-size: 15px; font-weight: 700; }
    .stats { display: flex; gap: 16px; margin-bottom: 8px; }
    .stat { flex: 1; background: #f8f9fc; border: 1px solid #e3e7ef; border-radius: 8px; padding: 10px 14px; }
    .stat-label { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; margin-bottom: 2px; }
    .stat-value { font-size: 18px; font-weight: 700; }
    .stat-sub { font-size: 10px; color: #9ca3af; margin-top: 2px; }
    table.detail { width: 100%; border-collapse: collapse; }
    table.detail thead tr { border-bottom: 2px solid #e3e7ef; }
    table.detail th { padding: 6px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: #6b7280; text-align: left; }
    table.detail th:nth-child(n+3) { text-align: right; }
    @media print { body { padding: 20px; } }
  </style>
  </head><body>
  <h1>Fyra Calculator <span class="badge">Cut Plan</span></h1>
  <div class="meta">Generated ${new Date().toLocaleString()}</div>

  <h2>Input Parameters</h2>
  <div class="params">
    <div class="param"><div class="param-label">Stock Bar Length</div><div class="param-value">${STOCK} cm</div></div>
    <div class="param"><div class="param-label">Unit (entered as)</div><div class="param-value">${unit}</div></div>
    <div class="param"><div class="param-label">Kerf Width</div><div class="param-value">${kerf} cm</div></div>
    <div class="param"><div class="param-label">Total Pieces</div><div class="param-value">${pieces.length}</div></div>
  </div>

  <h2>Summary</h2>
  <div class="stats">
    <div class="stat"><div class="stat-label">Bars Needed</div><div class="stat-value">${bars.length}</div><div class="stat-sub">Min possible: ${minBars}</div></div>
    <div class="stat"><div class="stat-label">Total Waste</div><div class="stat-value">${totalWaste.toFixed(2)} cm</div><div class="stat-sub">across all bars</div></div>
    <div class="stat"><div class="stat-label">Efficiency</div><div class="stat-value">${efficiency.toFixed(1)}%</div><div class="stat-sub">${effLabel}</div></div>
  </div>

  <h2>Visual Cutting Plan</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">${barsHtml}</table>

  <h2>Cut Details</h2>
  <table class="detail">
    <thead><tr><th>Bar</th><th>Pieces</th><th>Used (cm)</th><th>Waste (cm)</th><th>Efficiency</th></tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
  </body></html>`;

  const win = window.open('', '_blank');
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}