function addRow() {
    const table = document.querySelector("#inputTable tbody");

    const row = document.createElement("tr");

    row.innerHTML = `
<td><input type="number" step="0.01"></td>
<td><input type="number"></td>
<td><button onclick="removeRow(this)">✕</button></td>
`;

    table.appendChild(row);
}

function removeRow(btn) {
    btn.parentNode.parentNode.remove();
}

function optimizeCut(lengths, quantities, STOCK) {
    let pieces = [];

    for (let i = 0; i < lengths.length; i++) {
        for (let j = 0; j < quantities[i]; j++) {
            pieces.push(lengths[i]);
        }
    }

    pieces.sort((a, b) => b - a);

    let bars = [];

    for (let piece of pieces) {
        let placed = false;

        for (let bar of bars) {
            let sum = bar.reduce((a, b) => a + b, 0);

            if (sum + piece <= STOCK) {
                bar.push(piece);
                placed = true;
                break;
            }
        }

        if (!placed) {
            bars.push([piece]);
        }
    }

    return bars;
}

function calculate() {
    const STOCK = parseFloat(document.getElementById("stockLength").value);

    const rows = document.querySelectorAll("#inputTable tbody tr");

    let lengths = [];
    let quantities = [];

    rows.forEach((row) => {
        let length = parseFloat(row.cells[0].children[0].value);
        let qty = parseInt(row.cells[1].children[0].value);

        if (!isNaN(length) && !isNaN(qty)) {
            lengths.push(length);
            quantities.push(qty);
        }
    });

    const bars = optimizeCut(lengths, quantities, STOCK);

    const tbody = document.querySelector("#resultsTable tbody");

    tbody.innerHTML = "";

    let totalWaste = 0;

    bars.forEach((bar, index) => {
        let used = bar.reduce((a, b) => a + b, 0);
        let waste = STOCK - used;

        totalWaste += waste;

        let row = document.createElement("tr");

        row.innerHTML = `
<td>${index + 1}</td>
<td>${bar.join(", ")}</td>
<td>${used.toFixed(2)}</td>
<td>${waste.toFixed(2)}</td>
`;

        tbody.appendChild(row);
    });

    let totalRequired = 0;

    for (let i = 0; i < lengths.length; i++) {
        totalRequired += lengths[i] * quantities[i];
    }

    let minBars = Math.ceil(totalRequired / STOCK);

    document.getElementById("summary").innerHTML = `

<p>Total Bars Used: <strong>${bars.length}</strong></p>
<p>Total Waste: <strong>${totalWaste.toFixed(2)}</strong></p>
<p>Theoretical Minimum Bars: <strong>${minBars}</strong></p>

`;
}
