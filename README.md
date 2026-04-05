# Fyra Calculator Tool

A lightweight browser-based tool that calculates an efficient cutting plan when cutting stock bars into smaller pieces. Designed for on-site use in workshops and manufacturing environments.

---

## Features

- User-defined stock bar length with selectable unit (m, cm, mm)
- Sub-lengths always entered in cm for consistency
- Optional kerf (blade width) offset per cut
- Two input modes:
  - **Manual** — add rows with label, length, and quantity
  - **CSV** — paste directly from Excel (tab-separated columns)
- Excel paste format: each column is one item type (`ΤΕΜΑΧΙΑ: N` header, lengths below); quantity is a per-row multiplier
- Comma and dot decimal separators both accepted
- Piece labels with color coding across the visual plan
- Visual cutting diagram — proportional bar segments per cut, waste shown as dashed region
- Efficiency rating per bar (Excellent / Good / Poor)
- Summary stats: bars needed, total waste, overall efficiency, theoretical minimum bars
- Export to **CSV** (UTF-8, Excel-compatible) and **PDF** (print-ready, opens in new tab)
- Mobile-friendly responsive UI
- Automatic dark mode (follows device settings)
- Runs entirely in the browser — no server, no dependencies

---

## How It Works

The tool uses a **First-Fit Decreasing (FFD) heuristic**, a well-known approximation algorithm for the cutting stock problem.

Steps:

1. Expand all piece types into individual pieces (applying the per-row quantity multiplier)
2. Sort pieces by descending length
3. Place each piece into the first bar where it fits, accounting for kerf
4. If no existing bar fits, open a new one

This is fast, practical, and produces near-optimal results for real-world cut lists.

---

## Input Format (CSV / Excel Paste)

Select a range in Excel and paste directly into the CSV tab. The expected layout is:

```
ΤΕΜΑΧΙΑ: 2    ΤΕΜΑΧΙΑ: 3    ΤΕΜΑΧΙΑ: 1
97.5          148.2          138.2
97.5          148.2          138.2
97.5          148.2
97.5
```

- First row: `Label: N` per column — `N` is the quantity multiplier (how many pieces of each length are needed)
- Subsequent rows: one length per cell (in cm), empty cells are skipped
- Columns are separated by tabs (standard Excel copy behaviour)

---

## Export

After calculating, two export options are available in the Results card:

- **Export CSV** — includes input parameters, summary, and full cut details table. UTF-8 BOM encoded for correct display in Excel.
- **Export PDF** — opens a print-ready page in a new tab with input parameters, summary stats, visual bar diagram, and cut details table. Trigger print from the browser.

---

## Project Structure

```
/
├── index.html        # Markup and layout
├── css/
│   └── styles.css    # Design tokens, components, dark mode
├── js/
│   └── app.js        # All logic: parsing, optimization, rendering, export
└── content/
    └── favicon.ico
```

---

## Deployment

Static site — no build step required. Deploy by pointing the root directory to any static host:

- Cloudflare Pages
- GitHub Pages
- Netlify
- Vercel

---

## Possible Future Enhancements

- Exact optimization solver (integer programming) for guaranteed minimum bar count
- Save and reload cut lists (localStorage or shareable URL)
- Support for multiple stock bar lengths in a single calculation
- PWA / offline mode for workshop environments
- Printable per-bar cut sheets with measurements

---

## License

MIT License