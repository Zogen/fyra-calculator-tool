# Fyra Calculator Tool

A lightweight web tool that calculates an efficient cutting plan when cutting stock bars into smaller pieces.

The application helps estimate:

- Number of bars required  
- Waste per bar  
- Total waste  
- Theoretical minimum bars required  

The tool runs entirely in the browser and is optimized for **mobile use**, making it convenient for on-site usage in workshops or manufacturing environments.

---

## Features

- User-defined stock bar length  
- Input multiple cut lengths and quantities  
- Automatic cutting plan calculation  
- Waste calculation per bar  
- Total waste estimation  
- Theoretical minimum material calculation  
- Structured results table  
- Mobile-friendly responsive UI  
- Automatic dark mode (based on device settings)  

---

## Demo

Once deployed, the tool can be accessed directly from a browser.

Example usage flow:

1. Enter the **stock bar length**
2. Add the **required piece lengths**
3. Enter the **quantity** for each length
4. Press **Calculate**
5. View the generated **cutting plan and waste summary**

---

## How It Works

The tool uses a **First-Fit Decreasing heuristic algorithm**, a well-known approach for approximating solutions to the cutting stock optimization problem.

Algorithm steps:

1. Expand the quantities into a list of individual pieces
2. Sort pieces by descending length
3. Iterate through pieces and place each in the first bar where it fits
4. If no bar can accommodate the piece, create a new bar

This approach is fast and produces efficient cutting plans suitable for real-world use.

---

## Example Output

| Bar | Pieces | Used Length | Waste |
|-----|--------|-------------|-------|
| 1 | 2.4, 2.4, 1.2 | 6.0 | 0.0 |
| 2 | 2.4, 1.8, 1.8 | 6.0 | 0.0 |
| 3 | 1.8, 1.8, 1.2, 1.2 | 6.0 | 0.0 |

Summary:

- Total bars used  
- Total waste  
- Theoretical minimum bars required  

---

## Deployment

Because the project is a static website, it can be hosted easily on platforms such as:

- GitHub Pages  
- Netlify  
- Cloudflare Pages  
- Vercel  

Deployment usually requires simply connecting the repository and setting the **output directory to the project root**.

---

## Future Enhancements

Possible improvements for future versions:

- Visual cutting diagrams for each bar  
- Export results to CSV / Excel  
- Printable cutting sheets  
- Save frequently used cutting lists  
- Support for multiple stock lengths  
- Exact optimization solver (integer programming)  
- Shareable cutting plan URLs  
- Progressive Web App (PWA) support  
- Offline mode for workshop environments  

---

## License

MIT License