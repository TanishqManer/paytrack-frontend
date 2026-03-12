/* =====================================
   PayTrack – Invoices Logic
   Marks paid instantly on dropdown select
   ===================================== */

/* ---------- AUTH GUARD ---------- */
if (!localStorage.getItem("paytrack_token")) {
  window.location.href = "login.html";
}

/* ---------- ELEMENTS ---------- */
const invoiceList = document.getElementById("invoiceList");

/* ---------- STORAGE ---------- */
function getInvoices() {
  return JSON.parse(localStorage.getItem("paytrack_invoices")) || [];
}
function saveInvoices(invoices) {
  localStorage.setItem("paytrack_invoices", JSON.stringify(invoices));
}

/* ---------- SETTINGS (payment methods) ---------- */
function getPaymentOptions() {
  const s = JSON.parse(localStorage.getItem("paytrack_settings")) || {};
  const p = s.payments || {};
  const opts = [];
  /* Default cash+upi to true if settings never saved */
  if (p.cash !== false) opts.push("Cash");
  if (p.upi  !== false) opts.push("UPI");
  if (p.bank === true)  opts.push("Bank");
  if (opts.length === 0) opts.push("Cash", "UPI"); // absolute fallback
  return opts;
}

/* ---------- TOAST ---------- */
function showToast(msg, type = "success") {
  document.querySelectorAll(".inv-toast").forEach(t => t.remove());
  const t = document.createElement("div");
  t.className = "inv-toast toast";
  t.style.borderLeftColor = type === "error" ? "var(--danger)" : "var(--success)";

  const icon = document.createElement("span");
  icon.style.cssText = `
    width:22px;height:22px;border-radius:50%;flex-shrink:0;
    background:${type === "error" ? "var(--danger-dim)" : "var(--success-dim)"};
    color:${type === "error" ? "var(--danger)" : "var(--success)"};
    display:flex;align-items:center;justify-content:center;
    font-size:11px;font-weight:700;`;
  icon.textContent = type === "error" ? "✕" : "✓";

  const text = document.createElement("span");
  text.textContent = msg;
  t.appendChild(icon);
  t.appendChild(text);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* ---------- RENDER ---------- */
function renderInvoices() {
  const invoices = getInvoices();
  const paymentOptions = getPaymentOptions();
  invoiceList.innerHTML = "";

  if (invoices.length === 0) {
    invoiceList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🧾</div>
        <h3>No invoices yet</h3>
        <p>Create your first invoice to get started</p>
        <button class="btn-small primary"
          onclick="window.location.href='create-invoice-v2.html'">
          + Create Invoice
        </button>
      </div>`;
    return;
  }

  invoices.forEach(invoice => {
    const row = document.createElement("div");
    row.className = "invoice-row";

    const settings = JSON.parse(localStorage.getItem("paytrack_settings")) || {};
    const cur = settings.invoice?.currency || "₹";
    const total = Number(invoice.total || 0)
      .toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    /* Actions cell */
    let actionsHTML = "";
    if (invoice.status === "pending") {
      actionsHTML = `
        <select class="payment-select" data-id="${invoice.id}">
          <option value="">Mark Paid</option>
          ${paymentOptions.map(p => `<option value="${p}">${p}</option>`).join("")}
        </select>
        <button class="delete-btn" data-id="${invoice.id}">🗑</button>`;
    } else {
      actionsHTML = `
        <span class="paid-via">
          ✓ ${invoice.paymentMethod || "Paid"}
        </span>
        <button class="delete-btn" data-id="${invoice.id}">🗑</button>`;
    }

    row.innerHTML = `
      <span class="inv-id-cell">${invoice.id}</span>
      <span class="inv-client-cell">${invoice.clientName || "—"}</span>
      <span class="inv-amt-cell">${cur}${total}</span>
      <span><span class="status ${invoice.status}">${invoice.status.toUpperCase()}</span></span>
      <span class="inv-actions-cell">${actionsHTML}</span>`;

    invoiceList.appendChild(row);

    /* Mark paid instantly on dropdown change */
    const select = row.querySelector(".payment-select");
    if (select) {
      select.addEventListener("change", () => {
        const method = select.value;
        if (!method) return;

        /* Immediately swap the row UI before re-render for instant feedback */
        const statusSpan = row.querySelector(".status");
        if (statusSpan) {
          statusSpan.className = "status paid";
          statusSpan.textContent = "PAID";
        }
        const actionsCell = row.querySelector(".inv-actions-cell");
        if (actionsCell) {
          actionsCell.innerHTML = `
            <span class="paid-via">✓ ${method}</span>
            <button class="delete-btn" data-id="${invoice.id}">🗑</button>`;
          /* Reattach delete handler on new button */
          actionsCell.querySelector(".delete-btn").onclick = () => deleteInvoice(invoice.id);
        }

        /* Persist to storage */
        const all = getInvoices();
        const inv = all.find(i => i.id === invoice.id);
        if (inv) {
          inv.status        = "paid";
          inv.paymentMethod = method;
          inv.paidAt        = new Date().toISOString();
          saveInvoices(all);
        }

        showToast(`Marked as paid via ${method}`);
      });
    }

    /* Delete handler */
    row.querySelector(".delete-btn")?.addEventListener("click", () => {
      deleteInvoice(invoice.id);
    });
  });
}

/* ---------- DELETE ---------- */
function deleteInvoice(id) {
  if (!confirm("Delete this invoice permanently?")) return;
  saveInvoices(getInvoices().filter(inv => inv.id !== id));
  showToast("Invoice deleted");
  renderInvoices();
}

/* ---------- INIT ---------- */
renderInvoices();