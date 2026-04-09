      // ══════════════════════════════════════════════
      // STATE
      // ══════════════════════════════════════════════
      let transactions = JSON.parse(
        localStorage.getItem("expenseiq_txns") || "[]",
      );
      let currentType = "expense";
      let currentFilter = "all";
      let pendingInvoice = null;
      let fdMode = "simple";
      let rates = {};
      let currentTxMode = "Online";
      let stmtPeriod = "monthly";

      const CAT_COLORS = {
        Food: "#f5c542",
        Transport: "#6bffc8",
        Shopping: "#ff6b6b",
        Entertainment: "#a78bfa",
        Health: "#fb923c",
        Education: "#38bdf8",
        Utilities: "#f472b6",
        Salary: "#4ade80",
        Freelance: "#818cf8",
        Other: "#94a3b8",
      };
      const CAT_ICONS = {
        Food: "🍜",
        Transport: "🚌",
        Shopping: "🛒",
        Entertainment: "🎮",
        Health: "💊",
        Education: "📚",
        Utilities: "💡",
        Salary: "💼",
        Freelance: "💻",
        Other: "📦",
      };

      // ══════════════════════════════════════════════
      // INIT
      // ══════════════════════════════════════════════
      document.addEventListener("DOMContentLoaded", () => {
        const now = new Date();
        document.getElementById("date").value = toISO(now);
        document.getElementById("stmt-month").value = now.getMonth();
        document.getElementById("stmt-year").value = now.getFullYear();
        document.getElementById("stmt-year-only").value = now.getFullYear();
        document.getElementById("current-date").textContent =
          now.toLocaleDateString("en-IN", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          });

        const area = document.getElementById("upload-area");
        area.addEventListener("dragover", (e) => {
          e.preventDefault();
          area.classList.add("dragover");
        });
        area.addEventListener("dragleave", () =>
          area.classList.remove("dragover"),
        );
        area.addEventListener("drop", (e) => {
          e.preventDefault();
          area.classList.remove("dragover");
          if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
        });
        ["desc", "amount", "category", "date"].forEach((id) => {
          const el = document.getElementById(id);
          el.addEventListener("input", () => clearErr(id));
          el.addEventListener("change", () => clearErr(id));
        });

        render();
        fetchRates();
      });

      function toISO(d) {
        return d.toISOString().split("T")[0];
      }

      // ══════════════════════════════════════════════
      // TAB SWITCHING
      // ══════════════════════════════════════════════
      // ── TAB LABELS for mobile header ──
      const TAB_LABELS = {
        tracker:  "📊 Tracker",
        tools:    "🧮 Calculators",
        currency: "💱 Currency",
        savings:  "💰 Savings & Invest"
      };

      function switchTab(name) {
        // On mobile (≤768px), non-tracker tabs open as a full-page overlay
        if (window.innerWidth <= 768 && name !== "tracker") {
          openMobilePage(name);
          return;
        }
        activateTab(name);
      }

      function activateTab(name) {
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".nav-tab").forEach(t => t.classList.remove("active"));
        document.getElementById("tab-" + name).classList.add("active");
        const tabs = ["tracker", "tools", "currency", "savings"];
        document.querySelectorAll(".nav-tab")[tabs.indexOf(name)].classList.add("active");
        if (name === "tracker") setTimeout(renderBars, 50);
      }

      // ── MOBILE FULL-PAGE OVERLAY ──
      let mobilePageOpen = null;

      function openMobilePage(name) {
        const overlay = document.getElementById("mobile-overlay-" + name);
        if (!overlay) return;
        const contentSlot = overlay.querySelector(".mobile-page-content");
        const originalPanel = document.getElementById("tab-" + name);
        // Move children into overlay if not already there
        if (!contentSlot.hasChildNodes()) {
          while (originalPanel.firstChild) {
            contentSlot.appendChild(originalPanel.firstChild);
          }
        }
        originalPanel.style.display = "none";
        overlay.classList.add("active");
        mobilePageOpen = name;
        document.body.style.overflow = "hidden";
        overlay.scrollTop = 0;
        // Push state so browser back button works
        history.pushState({ mobilePage: name }, "");
        // Trigger currency fetch when opening that tab
        if (name === "currency" && typeof fetchRates === "function") {
          setTimeout(fetchRates, 100);
        }
      }

      function closeMobilePage(name) {
        const overlay = document.getElementById("mobile-overlay-" + name);
        if (!overlay) return;
        overlay.classList.remove("active");
        // Return children to original panel
        const contentSlot = overlay.querySelector(".mobile-page-content");
        const originalPanel = document.getElementById("tab-" + name);
        while (contentSlot.firstChild) {
          originalPanel.appendChild(contentSlot.firstChild);
        }
        originalPanel.style.display = "";
        mobilePageOpen = null;
        document.body.style.overflow = "";
      }

      function mobileBack(name) {
        closeMobilePage(name);
        activateTab("tracker");
      }

      // Handle browser back button / swipe-back gesture
      window.addEventListener("popstate", function(e) {
        if (mobilePageOpen) {
          closeMobilePage(mobilePageOpen);
          activateTab("tracker");
        }
      });

      // ══════════════════════════════════════════════
      // QUICK CHIPS
      // ══════════════════════════════════════════════
      function adjustAmount(delta) {
        const el = document.getElementById("amount");
        const cur = parseFloat(el.value) || 0;
        const nxt = Math.max(0, cur + delta);
        el.value = nxt % 1 === 0 ? nxt : nxt.toFixed(2);
        clearErr("amount");
      }

      // ══════════════════════════════════════════════
      // TRANSACTION LOGIC
      // ══════════════════════════════════════════════
      function setType(t) {
        currentType = t;
        document.getElementById("btn-expense").className =
          "type-btn" + (t === "expense" ? " active-expense" : "");
        document.getElementById("btn-income").className =
          "type-btn" + (t === "income" ? " active-income" : "");
      }

      function setErr(id, msg) {
        document.getElementById(id).classList.add("error");
        const e = document.getElementById("err-" + id);
        if (e) {
          e.textContent = msg;
          e.classList.add("show");
        }
      }
      function clearErr(id) {
        const el = document.getElementById(id) || document.getElementById(id + '-file');
        if (el) el.classList.remove("error");
        const e = document.getElementById("err-" + id);
        if (e) e.classList.remove("show");
      }
      function clearAllErrs() {
        ["desc", "amount", "category", "date"].forEach(clearErr);
      }

      function validate() {
        clearAllErrs();
        let ok = true;
        const desc = document.getElementById("desc").value.trim();
        const amount = document.getElementById("amount").value;
        const cat = document.getElementById("category").value;
        const date = document.getElementById("date").value;
        if (!desc || desc.length < 3) {
          setErr("desc", "Description is required (min 3 chars)");
          ok = false;
        }
        const amt = parseFloat(amount);
        if (!amount || isNaN(amt) || amt <= 0) {
          setErr("amount", "Enter a valid amount greater than ₹0");
          ok = false;
        } else if (amt > 10000000) {
          setErr("amount", "Amount cannot exceed ₹1,00,00,000");
          ok = false;
        }
        if (!cat) {
          setErr("category", "Please select a category");
          ok = false;
        }
        if (!date) {
          setErr("date", "Please select a date");
          ok = false;
        } else {
          const sel = new Date(date + "T00:00:00"),
            now = new Date();
          now.setHours(0, 0, 0, 0);
          if (sel > now) {
            setErr("date", "Date cannot be in the future");
            ok = false;
          }
        }
        return ok;
      }

      function handleInvoiceSelect(e) {
        if (e.target.files[0]) processFile(e.target.files[0]);
      }
      function processFile(file) {
        clearErr("invoice");
        const allowed = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
          "application/pdf",
        ];
        if (!allowed.includes(file.type)) {
          const e = document.getElementById("err-invoice");
          e.textContent = "Unsupported file.";
          e.classList.add("show");
          return;
        }
        if (file.size > 5 * 1024 * 1024) {
          const e = document.getElementById("err-invoice");
          e.textContent = "File too large (max 5 MB).";
          e.classList.add("show");
          return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
          pendingInvoice = {
            name: file.name,
            size: file.size,
            dataUrl: ev.target.result,
            fileType: file.type,
          };
          document.getElementById("preview-name").textContent = file.name;
          document.getElementById("preview-size").textContent = fmtSize(
            file.size,
          );
          document.getElementById("preview-icon").textContent =
            file.type === "application/pdf" ? "📄" : "🖼";
          document.getElementById("invoice-preview").classList.add("show");
          document.getElementById("upload-area").style.display = "none";
        };
        reader.readAsDataURL(file);
      }
      function removeInvoice() {
        pendingInvoice = null;
        document.getElementById("invoice-file").value = "";
        document.getElementById("invoice-preview").classList.remove("show");
        document.getElementById("upload-area").style.display = "block";
      }
      function fmtSize(b) {
        if (b < 1024) return b + " B";
        if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
        return (b / 1048576).toFixed(1) + " MB";
      }

      function addTransaction() {
        if (!validate()) {
          showToast("Fix the errors above", true);
          return;
        }
        const tx = {
          id: Date.now(),
          desc: document.getElementById("desc").value.trim(),
          amount: parseFloat(
            parseFloat(document.getElementById("amount").value).toFixed(2),
          ),
          category: document.getElementById("category").value,
          date: document.getElementById("date").value,
          type: currentType,
          mode: currentTxMode,
          from: document.getElementById("tx-from").value.trim(),
          to: document.getElementById("tx-to").value.trim(),
          invoice: pendingInvoice ? { ...pendingInvoice } : null,
        };
        transactions.unshift(tx);
        save();
        render();
        document.getElementById("desc").value = "";
        document.getElementById("amount").value = "";
        document.getElementById("date").value = toISO(new Date());
        document.getElementById("category").value = "";
        document.getElementById("tx-from").value = "";
        document.getElementById("tx-to").value = "";
        clearAllErrs();
        removeInvoice();
        showToast(
          `✓ ${currentType === "income" ? "Income" : "Expense"} added!`,
        );
      }

      // ── Queue logic ──
      let txQueue = [];

      function queueTransaction() {
        if (!validate()) {
          showToast("Fix the errors above", true);
          return;
        }
        const tx = {
          qid: Date.now() + Math.random(),
          id: Date.now(),
          desc: document.getElementById("desc").value.trim(),
          amount: parseFloat(
            parseFloat(document.getElementById("amount").value).toFixed(2),
          ),
          category: document.getElementById("category").value,
          date: document.getElementById("date").value,
          type: currentType,
          mode: currentTxMode,
          from: document.getElementById("tx-from").value.trim(),
          to: document.getElementById("tx-to").value.trim(),
          invoice: pendingInvoice ? { ...pendingInvoice } : null,
        };
        txQueue.push(tx);
        document.getElementById("desc").value = "";
        document.getElementById("amount").value = "";
        document.getElementById("date").value = toISO(new Date());
        document.getElementById("category").value = "";
        document.getElementById("tx-from").value = "";
        document.getElementById("tx-to").value = "";
        clearAllErrs();
        removeInvoice();
        renderQueue();
        showToast(`📥 Queued: ${tx.desc}`);
      }

      function removeFromQueue(qid) {
        txQueue = txQueue.filter((t) => t.qid !== qid);
        renderQueue();
      }

      function renderQueue() {
        const preview = document.getElementById("queue-preview");
        const submitBtn = document.getElementById("submit-all-btn");
        const countBadge = document.getElementById("queue-count-badge");
        const submitCount = document.getElementById("submit-all-count");
        const queueList = document.getElementById("queue-list");
        const queueTotal = document.getElementById("queue-total");

        if (txQueue.length === 0) {
          preview.style.display = "none";
          submitBtn.style.display = "none";
          return;
        }

        preview.style.display = "block";
        submitBtn.style.display = "block";
        countBadge.textContent = txQueue.length;
        submitCount.textContent = txQueue.length;

        const total = txQueue.reduce(
          (s, t) => s + (t.type === "income" ? t.amount : -t.amount),
          0,
        );
        queueTotal.textContent =
          (total >= 0 ? "+" : "−") +
          "₹" +
          Math.abs(total).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        queueTotal.style.color =
          total >= 0 ? "var(--income-color)" : "var(--expense-color)";

        queueList.innerHTML = txQueue
          .map(
            (t) => `
    <div style="display:flex;align-items:center;gap:8px;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:6px 10px;">
      <span style="font-size:14px;">${CAT_ICONS[t.category] || "📦"}</span>
      <span style="flex:1;font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.desc)}</span>
      <span style="font-family:'Exo 2', sans-serif;font-size:12px;font-weight:700;color:${t.type === "income" ? "var(--income-color)" : "var(--expense-color)"};flex-shrink:0;">${t.type === "income" ? "+" : "−"}₹${t.amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      <button onclick="removeFromQueue(${t.qid})" style="background:none;border:none;color:var(--border);cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;flex-shrink:0;transition:color 0.2s;" onmouseover="this.style.color='var(--expense-color)'" onmouseout="this.style.color='var(--border)'">✕</button>
    </div>
  `,
          )
          .join("");
      }

      function submitAllQueued() {
        if (!txQueue.length) return;
        txQueue.forEach((tx) => {
          transactions.unshift({ ...tx, id: Date.now() + Math.random() });
        });
        const count = txQueue.length;
        txQueue = [];
        save();
        render();
        renderQueue();
        showToast(`⚡ ${count} transaction${count > 1 ? "s" : ""} submitted!`);
      }

      function deleteTransaction(id) {
        transactions = transactions.filter((t) => t.id !== id);
        save();
        render();
        showToast("Transaction deleted");
      }

      function filterTx(type, btn) {
        currentFilter = type;
        document
          .querySelectorAll(".filter-btn:not(.reset-btn)")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        renderList();
      }

      function resetHistory() {
        if (!transactions.length) { showToast("No transactions to clear", true); return; }
        if (!confirm("Clear all transactions? This cannot be undone.")) return;
        transactions = [];
        save();
        render();
        showToast("All transactions cleared");
      }

      function openTxDetail(id) {
        if (window.innerWidth > 768) return; // desktop: do nothing
        const t = transactions.find(tx => tx.id === id);
        if (!t) return;
        const isIncome = t.type === 'income';
        const color = isIncome ? 'var(--income-color)' : 'var(--expense-color)';

        document.getElementById('txd-icon').style.background = (CAT_COLORS[t.category] || '#888') + '22';
        document.getElementById('txd-icon').textContent = CAT_ICONS[t.category] || '📦';
        document.getElementById('txd-desc').textContent = t.desc;
        document.getElementById('txd-type').textContent = isIncome ? 'Income' : 'Expense';
        document.getElementById('txd-type').style.color = color;
        document.getElementById('txd-amount').textContent = (isIncome ? '+' : '−') + fmt(t.amount);
        document.getElementById('txd-amount').style.color = color;
        document.getElementById('txd-date').textContent = fmtDate(t.date);
        document.getElementById('txd-cat').textContent = (CAT_ICONS[t.category] || '') + ' ' + t.category;

        const modeRow = document.getElementById('txd-mode-row');
        modeRow.style.display = t.mode ? '' : 'none';
        if (t.mode) document.getElementById('txd-mode').textContent = modeIcon(t.mode) + ' ' + t.mode;

        const fromRow = document.getElementById('txd-from-row');
        fromRow.style.display = t.from ? '' : 'none';
        if (t.from) document.getElementById('txd-from').textContent = t.from;

        const toRow = document.getElementById('txd-to-row');
        toRow.style.display = t.to ? '' : 'none';
        if (t.to) document.getElementById('txd-to').textContent = t.to;

        const invRow = document.getElementById('txd-invoice-row');
        if (t.invoice) {
          invRow.style.display = '';
          document.getElementById('txd-invoice').innerHTML = `<button onclick="closeTxDetailDirect();viewInvoice(${t.id})" style="background:rgba(245,197,66,0.15);border:1px solid rgba(245,197,66,0.3);border-radius:6px;padding:4px 10px;color:var(--accent);font-family:'Exo 2', sans-serif;font-size:11px;font-weight:700;cursor:pointer;">View 📎</button>`;
        } else {
          invRow.style.display = 'none';
        }

        document.getElementById('txd-delete').onclick = () => {
          closeTxDetailDirect();
          deleteTransaction(t.id);
        };

        const overlay = document.getElementById('tx-detail-overlay');
        const sheet = document.getElementById('tx-detail-sheet');
        overlay.style.display = 'flex';
        requestAnimationFrame(() => { sheet.style.transform = 'translateY(0)'; });
      }

      function closeTxDetail(e) {
        // If called from overlay click, only close when clicking the backdrop itself
        if (e && e.target && e.target.id !== 'tx-detail-overlay') return;
        const sheet = document.getElementById('tx-detail-sheet');
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => { document.getElementById('tx-detail-overlay').style.display = 'none'; }, 320);
      }
      function closeTxDetailDirect() {
        const sheet = document.getElementById('tx-detail-sheet');
        sheet.style.transform = 'translateY(100%)';
        setTimeout(() => { document.getElementById('tx-detail-overlay').style.display = 'none'; }, 320);
      }

      function save() {
        localStorage.setItem("expenseiq_txns", JSON.stringify(transactions));
      }

      function fmt(n) {
        return (
          "₹" +
          Math.abs(n).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
      function fmtSigned(n) {
        return (
          (n < 0 ? "−₹" : "₹") +
          Math.abs(n).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        );
      }
      function fmtDate(d) {
        return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
      }
      function esc(s) {
        return s
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
      }
      function fmtC(n) {
        return (
          "₹" +
          n.toLocaleString("en-IN", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          })
        );
      }

      function render() {
        renderSummary();
        renderList();
        renderDonut();
        renderBars();
        renderCatBars();
      }

      function renderSummary() {
        const income = transactions
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);
        const expense = transactions
          .filter((t) => t.type === "expense")
          .reduce((s, t) => s + t.amount, 0);
        const balance = income - expense;
        document.getElementById("total-income").textContent = fmt(income);
        document.getElementById("total-expense").textContent = fmt(expense);
        document.getElementById("balance").textContent = fmtSigned(balance);
        document.getElementById("balance").style.color =
          balance < 0 ? "var(--expense-color)" : "var(--accent)";
        document.getElementById("income-count").textContent =
          transactions.filter((t) => t.type === "income").length +
          " transactions";
        document.getElementById("expense-count").textContent =
          transactions.filter((t) => t.type === "expense").length +
          " transactions";
      }

      function renderList() {
        const list = document.getElementById("tx-list");
        const filtered = transactions.filter(
          (t) => currentFilter === "all" || t.type === currentFilter,
        );
        if (!filtered.length) {
          list.innerHTML = `<div class="empty-state"><div class="big">📭</div>No transactions yet.<br>Add one above!</div>`;
          return;
        }
        list.innerHTML = filtered
          .map(
            (t) => `
    <li class="tx-item tx-item-clickable" onclick="openTxDetail(${t.id})" style="cursor:default;">
      <div class="tx-icon" style="background:${CAT_COLORS[t.category]}22">${CAT_ICONS[t.category] || "📦"}</div>
      <div class="tx-details">
        <div class="tx-desc">${esc(t.desc)}${t.invoice ? `<button onclick="viewInvoice(${t.id})" title="View invoice" style="display:inline-flex;align-items:center;gap:4px;background:rgba(245,197,66,0.15);border:1px solid rgba(245,197,66,0.3);border-radius:6px;padding:2px 8px;cursor:pointer;margin-left:6px;vertical-align:middle;transition:all 0.15s;" onmouseover="this.style.background='rgba(245,197,66,0.28)'" onmouseout="this.style.background='rgba(245,197,66,0.15)'"><svg xmlns='http://www.w3.org/2000/svg' width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'><path d='M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48'/></svg><span style="font-family:'Exo 2', sans-serif;font-size:10px;font-weight:700;color:white;letter-spacing:0.5px;text-transform:uppercase;">Invoice</span></button>` : ""}  </div>
        <div class="tx-meta">${esc(t.category)} · ${fmtDate(t.date)}${t.mode ? ` · <span style="color:var(--accent);font-size:10px;">${modeIcon(t.mode)} ${t.mode}</span>` : ''}${t.from ? ` · <span style="color:var(--muted);">From: ${esc(t.from)}</span>` : ''}${t.to ? ` · <span style="color:var(--muted);">To: ${esc(t.to)}</span>` : ''}</div>
      </div>
      <div class="tx-amount ${t.type}">${t.type === "income" ? "+" : "−"}${fmt(t.amount)}</div>
      <button class="tx-delete" onclick="event.stopPropagation();deleteTransaction(${t.id})" title="Delete">✕</button>
    </li>
  `,
          )
          .join("");
      }

      function viewInvoice(id) {
        const tx = transactions.find((t) => t.id === id);
        if (!tx?.invoice) return;
        document.getElementById("modal-title").textContent = tx.invoice.name;
        const body = document.getElementById("modal-body");
        if (tx.invoice.fileType === "application/pdf") {
          body.innerHTML = `<p style="color:var(--muted);font-size:13px;margin-bottom:16px">PDF cannot be previewed inline.</p><a class="pdf-dl-link" href="${tx.invoice.dataUrl}" download="${esc(tx.invoice.name)}">📄 Download ${esc(tx.invoice.name)}</a>`;
        } else {
          body.innerHTML = `<img src="${tx.invoice.dataUrl}" alt="${esc(tx.invoice.name)}">`;
        }
        document.getElementById("invoice-modal").classList.add("show");
      }
      function closeInvoiceModal() {
        document.getElementById("invoice-modal").classList.remove("show");
      }
      function closeModalOverlay(e) {
        if (e.target.id === "invoice-modal") closeInvoiceModal();
      }

      // ── Transaction Mode ──
      function setTxMode(mode) {
        currentTxMode = mode;
        ['Online','Cash','Card','Bank'].forEach(m => {
          const btn = document.getElementById('mode-' + m.toLowerCase());
          if (btn) btn.className = 'tx-mode-btn' + (m === mode ? ' active' : '');
        });
      }
      function modeIcon(m) {
        return {Online:'📱', Cash:'💵', Card:'💳', Bank:'🏦'}[m] || '💸';
      }

      // ── Statement Period ──
      let customType = 'all';
      let customCats = new Set(['ALL']);

      function setStmtPeriod(p) {
        stmtPeriod = p;
        document.getElementById('stmt-period-monthly').className = 'type-btn' + (p==='monthly' ? ' active-income' : '');
        document.getElementById('stmt-period-yearly').className  = 'type-btn' + (p==='yearly'  ? ' active-income' : '');
        document.getElementById('stmt-period-custom').className  = 'type-btn' + (p==='custom'  ? ' active-income' : '');
        document.getElementById('stmt-month-row').style.display      = p === 'monthly' ? '' : 'none';
        document.getElementById('stmt-year-only-row').style.display  = p === 'yearly'  ? '' : 'none';
        document.getElementById('stmt-dl-btn').style.display         = p === 'custom'  ? 'none' : '';
        document.getElementById('custom-stmt-panel').classList.toggle('show', p === 'custom');
        if (p === 'custom') updateCustomPreview();
      }

      function setCustomType(t) {
        customType = t;
        document.getElementById('ctype-all').className    = 'tx-type-btn' + (t==='all'     ? ' sel-all' : '');
        document.getElementById('ctype-income').className = 'tx-type-btn' + (t==='income'  ? ' sel-inc' : '');
        document.getElementById('ctype-expense').className= 'tx-type-btn' + (t==='expense' ? ' sel-exp' : '');
        updateCustomPreview();
      }

      function toggleCustomCat(cat) {
        if (cat === 'ALL') {
          customCats = new Set(['ALL']);
        } else {
          customCats.delete('ALL');
          if (customCats.has(cat)) { customCats.delete(cat); if (!customCats.size) customCats.add('ALL'); }
          else customCats.add(cat);
        }
        document.querySelectorAll('#custom-cat-chips .cat-chip').forEach(btn => {
          btn.classList.toggle('selected', customCats.has(btn.dataset.cat));
        });
        updateCustomPreview();
      }

      function getCustomFiltered() {
        const from = document.getElementById('custom-from-date').value;
        const to   = document.getElementById('custom-to-date').value;
        return transactions.filter(t => {
          if (from && t.date < from) return false;
          if (to   && t.date > to)   return false;
          if (customType !== 'all' && t.type !== customType) return false;
          if (!customCats.has('ALL') && !customCats.has(t.category)) return false;
          return true;
        });
      }

      function updateCustomPreview() {
        const from = document.getElementById('custom-from-date').value;
        const to   = document.getElementById('custom-to-date').value;
        const el   = document.getElementById('custom-stmt-preview');
        if (!from && !to) { el.innerHTML = 'Select a date range to preview matching transactions.'; return; }
        const filtered = getCustomFiltered();
        const income   = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
        const expense  = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const catLabel = customCats.has('ALL') ? 'All categories' : [...customCats].join(', ');
        el.innerHTML = `<span>${filtered.length}</span> transaction${filtered.length!==1?'s':''} found &nbsp;·&nbsp; `
          + `Income <span style="color:var(--income-color)">+₹${income.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span> &nbsp;·&nbsp; `
          + `Expenses <span style="color:var(--expense-color)">−₹${expense.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</span>`
          + `<br><span style="font-size:10px;color:var(--muted);margin-top:4px;display:block;">Categories: ${catLabel}</span>`;
      }

      function downloadCustomStatementPDF() {
        const from = document.getElementById('custom-from-date').value;
        const to   = document.getElementById('custom-to-date').value;
        if (!from || !to) { showToast('Please select both From and To dates', true); return; }
        if (from > to)    { showToast('From date must be before To date', true); return; }
        const filtered = getCustomFiltered();
        if (!filtered.length) { showToast('No transactions match your filters', true); return; }

        const income  = filtered.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
        const expense = filtered.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
        const balance = income - expense;
        const catLabel = customCats.has('ALL') ? 'All Categories' : [...customCats].join(', ');
        const typeLabel = customType === 'all' ? 'All Types' : customType.charAt(0).toUpperCase()+customType.slice(1)+' Only';
        const fmtD = d => new Date(d+'T00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
        const periodLabel = `${fmtD(from)} – ${fmtD(to)}`;

        const rows = filtered.map((t,i) => `
          <tr style="background:${i%2===0?'#1a1a1e':'#141416'}">
            <td>${i+1}</td>
            <td>${fmtDate(t.date)}</td>
            <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.desc}</td>
            <td>${t.category}</td>
            <td>${t.mode||'—'}</td>
            <td>${t.from||'—'}</td>
            <td>${t.to||'—'}</td>
            <td style="color:${t.type==='income'?'#6bffc8':'#ff6b6b'};font-weight:700;">${t.type==='income'?'Income':'Expense'}</td>
            <td style="color:${t.type==='income'?'#6bffc8':'#ff6b6b'};font-weight:700;text-align:right;">${(t.type==='income'?'+':'−')}₹${t.amount.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
            <td style="text-align:center;">${t.invoice?'✓':'—'}</td>
          </tr>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>Custom Statement — ${periodLabel}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@700;800&family=Share+Tech+Mono&display=swap');
          * { box-sizing:border-box; margin:0; padding:0; }
          body { font-family:'Share Tech Mono', monospace; background:#0e0e10; color:#f0f0f0; padding:32px; font-size:12px; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:16px; border-bottom:2px solid #f5c542; }
          .logo { font-family:'Exo 2', sans-serif; font-size:36px; font-weight:800; color:#f5c542; }
          .meta { text-align:right; color:#888899; font-size:11px; line-height:2; }
          .meta span { color:#f5c542; }
          .summary { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:20px; }
          .sum-card { background:#18181c; border:1px solid #2e2e38; border-radius:10px; padding:16px; }
          .sum-label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:#888899; margin-bottom:6px; }
          .sum-val { font-family:'Exo 2', sans-serif; font-size:22px; font-weight:700; }
          .income-val { color:#6bffc8; } .expense-val { color:#ff6b6b; } .balance-val { color:#f5c542; }
          .filters-bar { background:#18181c; border:1px solid #2e2e38; border-radius:8px; padding:10px 14px; margin-bottom:20px; display:flex; gap:24px; flex-wrap:wrap; font-size:11px; color:#888899; }
          .filters-bar strong { color:#f5c542; }
          table { width:100%; border-collapse:collapse; font-size:11px; }
          thead tr { background:#f5c542; color:#000; }
          th { padding:8px 10px; text-align:left; font-family:'Exo 2', sans-serif; font-size:10px; letter-spacing:0.5px; text-transform:uppercase; }
          td { padding:7px 10px; border-bottom:1px solid #2e2e38; vertical-align:middle; }
          .section-title { font-family:'Exo 2', sans-serif; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888899; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
          .section-title::before { content:''; display:inline-block; width:6px; height:6px; background:#f5c542; border-radius:50%; }
          .footer { margin-top:24px; padding-top:16px; border-top:1px solid #2e2e38; text-align:center; font-size:10px; color:#888899; }
          .print-fab { position:fixed; bottom:32px; right:32px; display:flex; align-items:center; gap:10px; background:#f5c542; color:#000; border:none; border-radius:50px; padding:14px 26px; font-family:'Exo 2', sans-serif; font-size:14px; font-weight:800; letter-spacing:0.5px; cursor:pointer; box-shadow:0 4px 24px rgba(245,197,66,0.35); transition:all 0.2s; z-index:999; }
          .print-fab:hover { background:#ffd464; transform:translateY(-2px); box-shadow:0 8px 32px rgba(245,197,66,0.45); }
          .print-fab svg { flex-shrink:0; }
          @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .print-fab { display:none !important; } }
        </style></head><body>
        <button class="print-fab" onclick="window.print()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Save as PDF
        </button>
        <div class="header">
          <div>
            <div class="logo">ExpenseIQ</div>
            <div style="color:#888899;font-size:11px;margin-top:4px;">Custom Statement · Personal Finance Suite</div>
          </div>
          <div class="meta">
            <div>Period: <span>${periodLabel}</span></div>
            <div>Generated: <span>${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span></div>
            <div>Total Transactions: <span>${filtered.length}</span></div>
          </div>
        </div>
        <div class="summary">
          <div class="sum-card"><div class="sum-label">Total Income</div><div class="sum-val income-val">+₹${income.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
          <div class="sum-card"><div class="sum-label">Total Expenses</div><div class="sum-val expense-val">−₹${expense.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
          <div class="sum-card"><div class="sum-label">Net Balance</div><div class="sum-val balance-val">${balance>=0?'+':'−'}₹${Math.abs(balance).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        </div>
        <div class="filters-bar">
          <div>📅 Date Range: <strong>${periodLabel}</strong></div>
          <div>💳 Type: <strong>${typeLabel}</strong></div>
          <div>🏷 Categories: <strong>${catLabel}</strong></div>
        </div>
        <div class="section-title">Transaction History</div>
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th>Mode</th><th>From</th><th>To</th><th>Type</th><th>Amount</th><th>Invoice</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Custom Statement generated by ExpenseIQ · ${new Date().toLocaleString('en-IN')}</div>
        </body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        showToast(`✓ Custom statement ready — ${filtered.length} transactions`);
      }

      // ── Download Statement as PDF ──
      function downloadStatementPDF() {
        let filtered, periodLabel;
        if (stmtPeriod === 'monthly') {
          const month = parseInt(document.getElementById("stmt-month").value);
          const year  = parseInt(document.getElementById("stmt-year").value);
          if (isNaN(year) || year < 2000 || year > 2099) { showToast("Enter a valid year", true); return; }
          const key = `${year}-${String(month+1).padStart(2,"0")}`;
          filtered = transactions.filter(t => t.date.startsWith(key));
          periodLabel = new Date(year, month).toLocaleString("default",{month:"long"}) + " " + year;
        } else {
          const year = parseInt(document.getElementById("stmt-year-only").value);
          if (isNaN(year) || year < 2000 || year > 2099) { showToast("Enter a valid year", true); return; }
          filtered = transactions.filter(t => t.date.startsWith(String(year)));
          periodLabel = "Year " + year;
        }
        if (!filtered.length) { showToast("No transactions found for this period", true); return; }

        const income  = filtered.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0);
        const expense = filtered.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
        const balance = income - expense;

        // Build printable HTML and trigger browser print-to-PDF
        const rows = filtered.map((t,i) => `
          <tr style="background:${i%2===0?'#1a1a1e':'#141416'}">
            <td>${i+1}</td>
            <td>${fmtDate(t.date)}</td>
            <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.desc}</td>
            <td>${t.category}</td>
            <td>${t.mode||'—'}</td>
            <td>${t.from||'—'}</td>
            <td>${t.to||'—'}</td>
            <td style="color:${t.type==='income'?'#6bffc8':'#ff6b6b'};font-weight:700;">${t.type==='income'?'Income':'Expense'}</td>
            <td style="color:${t.type==='income'?'#6bffc8':'#ff6b6b'};font-weight:700;text-align:right;">${(t.type==='income'?'+':'−')}₹${t.amount.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
            <td style="text-align:center;">${t.invoice?'✓':'—'}</td>
          </tr>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>Statement — ${periodLabel}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@700;800&family=Share+Tech+Mono&display=swap');
          * { box-sizing: border-box; margin:0; padding:0; }
          body { font-family:'Share Tech Mono', monospace; background:#0e0e10; color:#f0f0f0; padding:32px; font-size:12px; }
          .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:28px; padding-bottom:16px; border-bottom:2px solid #f5c542; }
          .logo { font-family:'Exo 2', sans-serif; font-size:36px; font-weight:800; color:#f5c542; }
          .meta { text-align:right; color:#888899; font-size:11px; line-height:2; }
          .meta span { color:#f5c542; }
          .summary { display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:28px; }
          .sum-card { background:#18181c; border:1px solid #2e2e38; border-radius:10px; padding:16px; }
          .sum-label { font-size:9px; letter-spacing:2px; text-transform:uppercase; color:#888899; margin-bottom:6px; }
          .sum-val { font-family:'Exo 2', sans-serif; font-size:22px; font-weight:700; }
          .income-val { color:#6bffc8; } .expense-val { color:#ff6b6b; } .balance-val { color:#f5c542; }
          table { width:100%; border-collapse:collapse; font-size:11px; }
          thead tr { background:#f5c542; color:#000; }
          th { padding:8px 10px; text-align:left; font-family:'Exo 2', sans-serif; font-size:10px; letter-spacing:0.5px; text-transform:uppercase; }
          td { padding:7px 10px; border-bottom:1px solid #2e2e38; vertical-align:middle; }
          .section-title { font-family:'Exo 2', sans-serif; font-size:12px; font-weight:700; letter-spacing:1px; text-transform:uppercase; color:#888899; margin-bottom:10px; display:flex; align-items:center; gap:6px; }
          .section-title::before { content:''; display:inline-block; width:6px; height:6px; background:#f5c542; border-radius:50%; }
          .footer { margin-top:24px; padding-top:16px; border-top:1px solid #2e2e38; text-align:center; font-size:10px; color:#888899; }
          .print-fab { position:fixed; bottom:32px; right:32px; display:flex; align-items:center; gap:10px; background:#f5c542; color:#000; border:none; border-radius:50px; padding:14px 26px; font-family:'Exo 2', sans-serif; font-size:14px; font-weight:800; letter-spacing:0.5px; cursor:pointer; box-shadow:0 4px 24px rgba(245,197,66,0.35); transition:all 0.2s; z-index:999; }
          .print-fab:hover { background:#ffd464; transform:translateY(-2px); box-shadow:0 8px 32px rgba(245,197,66,0.45); }
          .print-fab svg { flex-shrink:0; }
          @media print { body { -webkit-print-color-adjust:exact; print-color-adjust:exact; } .print-fab { display:none !important; } }
        </style></head><body>
        <button class="print-fab" onclick="window.print()">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Print / Save as PDF
        </button>
        <div class="header">
          <div>
            <div class="logo">ExpenseIQ</div>
            <div style="color:#888899;font-size:11px;margin-top:4px;">Personal Finance Suite</div>
          </div>
          <div class="meta">
            <div>Statement Period: <span>${periodLabel}</span></div>
            <div>Generated: <span>${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</span></div>
            <div>Total Transactions: <span>${filtered.length}</span></div>
          </div>
        </div>
        <div class="summary">
          <div class="sum-card"><div class="sum-label">Total Income</div><div class="sum-val income-val">+₹${income.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
          <div class="sum-card"><div class="sum-label">Total Expenses</div><div class="sum-val expense-val">−₹${expense.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
          <div class="sum-card"><div class="sum-label">Net Balance</div><div class="sum-val balance-val">${balance>=0?'+':'−'}₹${Math.abs(balance).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>
        </div>
        <div class="section-title">Transaction History</div>
        <table>
          <thead><tr><th>#</th><th>Date</th><th>Description</th><th>Category</th><th>Mode</th><th>From</th><th>To</th><th>Type</th><th>Amount</th><th>Invoice</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="footer">Generated by ExpenseIQ · ${new Date().toLocaleString('en-IN')}</div>
        </body></html>`;

        const win = window.open('', '_blank');
        win.document.write(html);
        win.document.close();
        showToast(`✓ PDF statement for ${periodLabel} ready`);
      }

      // ── Donut Chart ──
      function renderDonut() {
        const canvas = document.getElementById("donutChart");
        const ctx = canvas.getContext("2d");
        const W = 160,
          H = 160,
          cx = 80,
          cy = 80,
          R = 64,
          r = 44;
        ctx.clearRect(0, 0, W, H);
        const expenses = transactions.filter((t) => t.type === "expense");
        const total = expenses.reduce((s, t) => s + t.amount, 0);
        const income = transactions
          .filter((t) => t.type === "income")
          .reduce((s, t) => s + t.amount, 0);
        const pct =
          income > 0 ? Math.min(100, Math.round((total / income) * 100)) : 0;
        document.getElementById("donut-pct").textContent = pct + "%";
        if (!expenses.length) {
          ctx.beginPath();
          ctx.arc(cx, cy, R, 0, Math.PI * 2);
          ctx.arc(cx, cy, r, 0, Math.PI * 2, true);
          ctx.fillStyle = "#2e2e38";
          ctx.fill("evenodd");
          document.getElementById("donut-legend").innerHTML = "";
          return;
        }
        const cats = {};
        expenses.forEach(
          (t) => (cats[t.category] = (cats[t.category] || 0) + t.amount),
        );
        const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
        let angle = -Math.PI / 2;
        entries.forEach(([cat, val]) => {
          const sweep = (val / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + R * Math.cos(angle), cy + R * Math.sin(angle));
          ctx.arc(cx, cy, R, angle, angle + sweep);
          ctx.arc(cx, cy, r, angle + sweep, angle, true);
          ctx.closePath();
          ctx.fillStyle = CAT_COLORS[cat] || "#888";
          ctx.fill();
          angle += sweep;
        });
        document.getElementById("donut-legend").innerHTML = entries
          .map(
            ([cat]) =>
              `<div class="legend-item"><div class="legend-dot" style="background:${CAT_COLORS[cat]}"></div><span>${cat}</span></div>`,
          )
          .join("");
      }

      // ── Bar Chart (HTML) ──
      function renderBars() {
        const container = document.getElementById("bar-chart-html");
        if (!container) return;
        const months = allMonths();
        const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);

        const fmt2 = n => n >= 100000
          ? (n / 100000).toFixed(1) + "L"
          : n >= 1000
            ? (n / 1000).toFixed(1) + "K"
            : String(Math.round(n));

        container.innerHTML = months.map(m => {
          const iPct = (m.income / maxVal) * 100;
          const ePct = (m.expense / maxVal) * 100;
          const hasData = m.income > 0 || m.expense > 0;
          return `
            <div style="display:grid;grid-template-columns:30px 1fr;align-items:center;gap:10px;">
              <span style="font-size:10px;color:var(--muted);text-align:right;letter-spacing:0.5px;">${m.label}</span>
              <div style="display:flex;flex-direction:column;gap:3px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
                    <div style="width:${iPct}%;height:100%;background:var(--income-color);border-radius:4px;transition:width 0.4s ease;"></div>
                  </div>
                  <span style="font-size:10px;color:var(--income-color);width:36px;text-align:right;font-family:'Exo 2', sans-serif;font-weight:700;">${m.income > 0 ? fmt2(m.income) : ''}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden;">
                    <div style="width:${ePct}%;height:100%;background:var(--expense-color);border-radius:4px;transition:width 0.4s ease;"></div>
                  </div>
                  <span style="font-size:10px;color:var(--expense-color);width:36px;text-align:right;font-family:'Exo 2', sans-serif;font-weight:700;">${m.expense > 0 ? fmt2(m.expense) : ''}</span>
                </div>
              </div>
            </div>`;
        }).join("");
      }
      function allMonths() {
        const year = new Date().getFullYear();
        return Array.from({ length: 12 }, (_, month) => {
          const k = `${year}-${String(month + 1).padStart(2, "0")}`;
          const label = new Date(year, month, 1).toLocaleString("default", { month: "short" });
          return {
            label,
            income: transactions
              .filter((t) => t.type === "income" && t.date.startsWith(k))
              .reduce((s, t) => s + t.amount, 0),
            expense: transactions
              .filter((t) => t.type === "expense" && t.date.startsWith(k))
              .reduce((s, t) => s + t.amount, 0),
          };
        });
      }
      function renderCatBars() {
        const cats = {};
        transactions
          .filter((t) => t.type === "expense")
          .forEach(
            (t) => (cats[t.category] = (cats[t.category] || 0) + t.amount),
          );
        const entries = Object.entries(cats)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const max = entries[0]?.[1] || 1;
        const el = document.getElementById("category-bars");
        if (!entries.length) {
          el.innerHTML =
            '<div class="empty-state" style="padding:20px 0;font-size:12px;">No data yet</div>';
          return;
        }
        el.innerHTML = entries
          .map(
            ([cat, val]) => `
    <div class="budget-item">
      <div class="budget-row"><span class="budget-cat">${CAT_ICONS[cat]} ${cat}</span><span class="budget-pct">${fmt(val)}</span></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${((val / max) * 100).toFixed(1)}%;background:${CAT_COLORS[cat]}"></div></div>
    </div>
  `,
          )
          .join("");
      }

      // ── Toast ──
      let toastT;
      function showToast(msg, isErr = false) {
        const t = document.getElementById("toast");
        t.textContent = msg;
        t.className = "toast show" + (isErr ? " err" : "");
        clearTimeout(toastT);
        toastT = setTimeout(() => t.classList.remove("show"), 2800);
      }

      // ══════════════════════════════════════════════
      // SIMPLE CALCULATOR
      // ══════════════════════════════════════════════
      let calcCurrent = "0",
        calcPrev = "",
        calcOperator = "",
        calcNewNum = false;

      function calcUpdateDisplay() {
        document.getElementById("calc-result").textContent = parseFloat(
          calcCurrent,
        ).toLocaleString("en-IN", { maximumFractionDigits: 8 });
        document.getElementById("calc-expr").textContent =
          calcPrev && calcOperator ? `${calcPrev} ${calcOperator}` : "\u00a0";
      }
      function calcNum(n) {
        if (calcNewNum) {
          calcCurrent = n;
          calcNewNum = false;
        } else
          calcCurrent =
            calcCurrent === "0"
              ? n
              : calcCurrent.length > 14
                ? calcCurrent
                : calcCurrent + n;
        calcUpdateDisplay();
      }
      function calcDot() {
        if (calcNewNum) {
          calcCurrent = "0.";
          calcNewNum = false;
        } else if (!calcCurrent.includes(".")) calcCurrent += ".";
        calcUpdateDisplay();
      }
      function calcOp(op) {
        if (calcPrev && calcOperator && !calcNewNum) calcEquals(true);
        calcPrev = calcCurrent;
        calcOperator = op;
        calcNewNum = true;
        calcUpdateDisplay();
      }
      function calcEquals(chain = false) {
        if (!calcPrev || !calcOperator) return;
        const a = parseFloat(calcPrev),
          b = parseFloat(calcCurrent);
        let res;
        switch (calcOperator) {
          case "+":
            res = a + b;
            break;
          case "-":
            res = a - b;
            break;
          case "*":
            res = a * b;
            break;
          case "/":
            res = b !== 0 ? a / b : "Error";
            break;
        }
        calcCurrent =
          res === "Error" ? "Error" : String(parseFloat(res.toFixed(10)));
        if (!chain) {
          calcPrev = "";
          calcOperator = "";
        }
        calcNewNum = true;
        calcUpdateDisplay();
      }
      function calcClear() {
        calcCurrent = "0";
        calcPrev = "";
        calcOperator = "";
        calcNewNum = false;
        calcUpdateDisplay();
      }
      function calcSign() {
        calcCurrent = String(parseFloat(calcCurrent) * -1);
        calcUpdateDisplay();
      }
      function calcPct() {
        calcCurrent = String(parseFloat(calcCurrent) / 100);
        calcUpdateDisplay();
      }

      // Keyboard support for calculator
      document.addEventListener("keydown", (e) => {
        const tab = document.getElementById("tab-tools");
        if (!tab.classList.contains("active")) return;
        // Don't intercept keypresses when user is typing in an input/textarea/select
        const tag = document.activeElement && document.activeElement.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
        if (e.key >= "0" && e.key <= "9") calcNum(e.key);
        else if (e.key === ".") calcDot();
        else if (e.key === "+") calcOp("+");
        else if (e.key === "-") calcOp("-");
        else if (e.key === "*") calcOp("*");
        else if (e.key === "/") {
          e.preventDefault();
          calcOp("/");
        } else if (e.key === "Enter" || e.key === "=") calcEquals();
        else if (e.key === "Backspace") {
          calcCurrent = calcCurrent.length > 1 ? calcCurrent.slice(0, -1) : "0";
          calcUpdateDisplay();
        } else if (e.key === "Escape") calcClear();
      });

      // ══════════════════════════════════════════════
      // EMI / LOAN CALCULATOR
      // ══════════════════════════════════════════════
      function calcEMI() {
        const P = parseFloat(document.getElementById("loan-amount").value);
        const annualR = parseFloat(document.getElementById("loan-rate").value);
        const N = parseInt(document.getElementById("loan-tenure").value);
        if (!P || !annualR || !N || P <= 0 || annualR <= 0 || N <= 0) return;
        const r = annualR / 12 / 100;
        const emi = (P * r * Math.pow(1 + r, N)) / (Math.pow(1 + r, N) - 1);
        const total = emi * N;
        const interest = total - P;
        document.getElementById("emi-val").textContent = fmt(emi);
        document.getElementById("emi-total").textContent = fmt(total);
        document.getElementById("emi-interest").textContent = fmt(interest);
        document.getElementById("emi-principal").textContent = fmt(P);
        document.getElementById("emi-result").style.display = "block";
        // Amortization
        let balance = P;
        const rows = [];
        for (let m = 1; m <= N; m++) {
          const int = balance * r;
          const prin = emi - int;
          balance -= prin;
          rows.push(`<tr>
      <td style="color:var(--muted)">${m}</td>
      <td>${fmtC(emi)}</td>
      <td style="color:var(--income-color)">${fmtC(prin)}</td>
      <td style="color:var(--expense-color)">${fmtC(int)}</td>
      <td>${fmtC(Math.max(0, balance))}</td>
    </tr>`);
        }
        document.getElementById("amort-body").innerHTML = rows.join("");
        document.getElementById("amort-wrap-container").style.display = "block";
      }

      // ══════════════════════════════════════════════
      // CURRENCY CONVERTER
      // ══════════════════════════════════════════════
      async function fetchRates() {
        document.getElementById("curr-spinner").style.display = "inline-block";
        // Fallback rates (approximate, April 2026 — used only when all live APIs fail)
        const fallbackRates = {
          USD: 1,
          INR: 84.5,
          EUR: 0.91,
          GBP: 0.78,
          JPY: 151.2,
          AED: 3.6725,
          SGD: 1.34,
          CAD: 1.38,
          AUD: 1.56,
          CHF: 0.88,
          CNY: 7.26,
          SAR: 3.75,
        };

        let success = false;

        // Attempt 1: Frankfurter (supports most currencies, free, no key)
        try {
          const res = await fetch(
            "https://api.frankfurter.app/latest?from=USD&to=INR,EUR,GBP,JPY,CAD,AUD,CHF,CNY,SGD"
          );
          if (!res.ok) throw new Error("Frankfurter error " + res.status);
          const data = await res.json();
          rates = { USD: 1, ...data.rates };
          // AED and SAR are USD-pegged — Frankfurter omits them
          if (!rates.AED) rates.AED = 3.6725;
          if (!rates.SAR) rates.SAR = 3.75;
          success = true;
        } catch (e1) {
          // Attempt 2: Open Exchange Rates free tier (no key needed for latest/USD base)
          try {
            const res2 = await fetch("https://open.er-api.com/v6/latest/USD");
            if (!res2.ok) throw new Error("ER-API error " + res2.status);
            const data2 = await res2.json();
            if (data2.result !== "success") throw new Error("ER-API bad result");
            const needed = ["INR","EUR","GBP","JPY","CAD","AUD","CHF","CNY","SGD","AED","SAR"];
            rates = { USD: 1 };
            needed.forEach(c => { if (data2.rates[c]) rates[c] = data2.rates[c]; });
            if (!rates.AED) rates.AED = 3.6725;
            if (!rates.SAR) rates.SAR = 3.75;
            success = true;
          } catch (e2) {
            // Both APIs failed — use static fallback
            rates = { ...fallbackRates };
          }
        }

        document.getElementById("rate-badge").textContent = success ? "LIVE ✓" : "CACHED";
        if (!success) {
          document.getElementById("curr-rate").textContent = "Using approximate rates (offline)";
        }
        convertCurrency();
        renderSnapshot();
        document.getElementById("curr-spinner").style.display = "none";
      }

      function convertCurrency() {
        const amount = parseFloat(document.getElementById("curr-amount").value) || 0;
        const from = document.getElementById("curr-from").value;
        const to = document.getElementById("curr-to").value;
        if (!rates[from] || !rates[to]) return;
        // All rates are relative to USD, so convert: from → USD → to
        const inUSD = amount / rates[from];
        const result = inUSD * rates[to];
        const symb = {
          INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥",
          AED: "د.إ", SGD: "S$", CAD: "C$", AUD: "A$",
          CHF: "Fr", CNY: "¥", SAR: "﷼",
        };
        document.getElementById("curr-result").textContent =
          `${symb[to] || ""}${result.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${to}`;
        const rate = rates[to] / rates[from];
        document.getElementById("curr-rate").textContent =
          `1 ${from} = ${rate.toFixed(6)} ${to}`;
      }

      function swapCurrency() {
        const f = document.getElementById("curr-from").value;
        const t = document.getElementById("curr-to").value;
        document.getElementById("curr-from").value = t;
        document.getElementById("curr-to").value = f;
        convertCurrency();
      }

      function renderSnapshot() {
        const snap = ["USD", "EUR", "GBP", "JPY", "AED", "SGD", "CAD", "AUD"];
        const symb = {
          INR: "₹", USD: "$", EUR: "€", GBP: "£", JPY: "¥",
          AED: "د.إ", SGD: "S$", CAD: "C$", AUD: "A$",
          CHF: "Fr", CNY: "¥", SAR: "﷼",
        };
        if (!rates.INR) return;
        // Show how much 1000 INR = X in each currency
        // rates are USD-based, so: 1000 INR → USD → target
        const inrInUSD = 1000 / rates.INR;
        document.getElementById("curr-snapshot").innerHTML = snap
          .map((c) => {
            const val = inrInUSD * rates[c];
            return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;">
      <div style="font-size:10px;color:var(--muted);letter-spacing:1px;margin-bottom:4px;">${c}</div>
      <div style="font-family:'Exo 2', sans-serif;font-size:16px;font-weight:700;color:var(--text)">${symb[c] || ""}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
    </div>`;
          })
          .join("");
      }

      // ══════════════════════════════════════════════
      // SIP CALCULATOR
      // ══════════════════════════════════════════════
      function calcSIP() {
        const monthly = parseFloat(
          document.getElementById("sip-monthly").value,
        );
        const annualR = parseFloat(document.getElementById("sip-rate").value);
        const years = parseFloat(document.getElementById("sip-years").value);
        if (
          !monthly ||
          !annualR ||
          !years ||
          monthly <= 0 ||
          annualR <= 0 ||
          years <= 0
        )
          return;
        const r = annualR / 12 / 100;
        const n = years * 12;
        const fv = monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r);
        const invested = monthly * n;
        const returns = fv - invested;
        document.getElementById("sip-invested").textContent = fmt(invested);
        document.getElementById("sip-returns").textContent = fmt(returns);
        document.getElementById("sip-total").textContent = fmt(fv);
        document.getElementById("sip-wealth").textContent =
          `${((returns / invested) * 100).toFixed(1)}% gain`;
        document.getElementById("sip-result").style.display = "block";
      }

      // ══════════════════════════════════════════════
      // FD CALCULATOR
      // ══════════════════════════════════════════════
      function setFDMode(mode) {
        fdMode = mode;
        document.getElementById("fd-simple-tab").className =
          "savings-tab" + (mode === "simple" ? " active" : "");
        document.getElementById("fd-compound-tab").className =
          "savings-tab" + (mode === "compound" ? " active" : "");
        document.getElementById("fd-freq-group").style.display =
          mode === "compound" ? "block" : "none";
        calcFD();
      }
      function calcFD() {
        const P = parseFloat(document.getElementById("fd-principal").value);
        const r = parseFloat(document.getElementById("fd-rate").value) / 100;
        const t = parseFloat(document.getElementById("fd-years").value);
        if (!P || !r || !t || P <= 0 || r <= 0 || t <= 0) return;
        let maturity;
        if (fdMode === "simple") {
          maturity = P + P * r * t;
        } else {
          const n = parseInt(document.getElementById("fd-freq").value) || 4;
          maturity = P * Math.pow(1 + r / n, n * t);
        }
        const interest = maturity - P;
        document.getElementById("fd-principal-val").textContent = fmt(P);
        document.getElementById("fd-interest-val").textContent = fmt(interest);
        document.getElementById("fd-maturity").textContent = fmt(maturity);
        document.getElementById("fd-result").style.display = "block";
      }

      // ══════════════════════════════════════════════
      // GOAL PLANNER
      // ══════════════════════════════════════════════
      function calcGoal() {
        const target = parseFloat(document.getElementById("goal-target").value);
        const current =
          parseFloat(document.getElementById("goal-current").value) || 0;
        const monthly = parseFloat(
          document.getElementById("goal-monthly").value,
        );
        const annualR =
          parseFloat(document.getElementById("goal-rate").value) || 0;
        const name = document.getElementById("goal-name").value || "My Goal";
        if (!target || !monthly || target <= 0 || monthly <= 0) return;
        const needed = Math.max(0, target - current);
        const pct = Math.min(100, (current / target) * 100).toFixed(1);
        const r = annualR / 12 / 100;
        let months = 0;
        if (r > 0) {
          // FV of current savings + FV of SIP = target
          // Solve numerically
          let balance = current;
          while (balance < target && months < 1200) {
            balance = balance * (1 + r) + monthly;
            months++;
          }
        } else {
          months = Math.ceil(needed / monthly);
        }
        const years = Math.floor(months / 12);
        const remMonths = months % 12;
        const timeStr =
          years > 0
            ? years + "y " + (remMonths > 0 ? remMonths + "m" : "")
            : months + "m";
        document.getElementById("goal-name-val").textContent = name;
        document.getElementById("goal-time").textContent =
          months < 1200 ? timeStr : "Goal may not be reachable at this rate";
        document.getElementById("goal-needed").textContent = fmt(needed);
        document.getElementById("goal-pct").textContent = pct + "% saved";
        document.getElementById("goal-result").style.display = "block";
      }

      // ══════════════════════════════════════════════
      // INFLATION CALCULATOR
      // ══════════════════════════════════════════════
      function calcInflation() {
        const amount = parseFloat(document.getElementById("inf-amount").value);
        const rate = parseFloat(document.getElementById("inf-rate").value) || 6;
        const years = parseFloat(document.getElementById("inf-years").value);
        if (!amount || !years || amount <= 0 || years <= 0) return;
        const futureCost = amount * Math.pow(1 + rate / 100, years);
        const lost = futureCost - amount;
        const power = ((amount / futureCost) * 100).toFixed(1);
        document.getElementById("inf-today").textContent = fmt(amount);
        document.getElementById("inf-future").textContent = fmt(futureCost);
        document.getElementById("inf-lost").textContent = fmt(lost);
        document.getElementById("inf-power").textContent =
          power + "% purchasing power";
        document.getElementById("inf-result").style.display = "block";
      }
