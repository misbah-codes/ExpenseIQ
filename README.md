# 💸 ExpenseIQ — Personal Finance Suite

A sleek, feature-rich personal finance tracker built with **vanilla HTML, CSS, and JavaScript** — no frameworks, no backend, no installation required. Just open and go.

---

## ✨ Features

### 📊 Expense Tracker
- Add income and expense transactions with description, amount, category, date, and payment mode
- Quick-add amount chips (₹100, ₹500, ₹1K, ₹10K, ₹1L, ₹10L)
- Payment modes: Online/UPI, Cash, Card, Bank Transfer
- Attach invoice images to transactions (drag & drop supported)
- Filter transactions by All / Income / Expense / category
- Transaction detail bottom sheet (mobile-friendly)
- Delete transactions with confirmation
- Live summary cards: Total Balance, Total Income, Total Expenses

### 🧮 Financial Calculators
- **EMI Calculator** — Loan amount, interest rate, tenure
- **SIP Calculator** — Monthly investment, expected returns, duration
- **FD Calculator** — Fixed deposit with Simple & Compound interest modes
- **PPF Calculator** — Public Provident Fund maturity estimator

### 💱 Currency Converter
- Live exchange rates via API
- Convert between major global currencies
- Clean, fast UI

### 💰 Savings & Investment
- **Goal Planner** — Set a savings goal and calculate time to achieve it
- **Inflation Calculator** — See what your money will be worth in the future

### 📄 Statement Export
- Generate monthly or yearly statements
- Clean printable invoice/receipt view per transaction

---

## 🗂️ Project Structure

```
expenseiq/
├── index.html      # App layout, tabs, forms, modals
├── style.css       # Full styling — dark theme, responsive grid
├── app.js          # All logic — state, calculations, API calls
└── favicon.svg     # App icon
```

---

## 🚀 Getting Started

No build step or server needed.

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/expenseiq.git
   cd expenseiq
   ```

2. **Open in browser**
   ```bash
   # Simply open index.html in your browser, or use a local server:
   npx serve .
   # or
   python -m http.server 8080
   ```

3. Visit `http://localhost:8080` (or just double-click `index.html`)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Markup | HTML5 |
| Styling | CSS3 (Custom Properties, Grid, Flexbox) |
| Logic | Vanilla JavaScript (ES6+) |
| Fonts | Google Fonts — Exo 2, Share Tech Mono |
| Data | localStorage (browser-based persistence) |
| Rates | Live currency exchange rate API |

---

## 📱 Responsive Design

ExpenseIQ is fully responsive:
- **Desktop** — Multi-column grid layout with side-by-side panels
- **Mobile (≤768px)** — Full-page overlay navigation per tab, bottom-sheet transaction details, touch-friendly chips and buttons

---

## 💾 Data Storage

All transaction data is saved to your browser's **localStorage** under the key `expenseiq_txns`. No data is sent to any server. Your data stays on your device.

> ⚠️ Clearing browser data/cache will erase your transactions. Consider exporting statements regularly.

---

## 📸 Screenshots

<img width="731" height="428" alt="dash" src="https://github.com/user-attachments/assets/545e7b83-7e34-4c2e-b565-c2fd1dae8ff7" />


---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---



---

## 👤 Author


**Your Name**
- GitHub: [@misbah-codes](https://github.com/misbah-codes)

---

> Built with ❤️ for personal finance management — track smarter, spend wiser.
