/* =====================================
   PayTrack – Invoices Logic
   Loads from API, falls back to localStorage
   ===================================== */

/* ---------- AUTH GUARD ---------- */
if (!localStorage.getItem("paytrack_token")) {
  window.location.href = "login.html";
}

/* ---------- ELEMENTS ---------- */
const invoiceList = document.getElementById("invoiceList");

/* ---------- IN-MEMORY STORE ---------- */
let allInvoices = [];

/* ---------- STORAGE HELPERS ---------- */
function getInvoices() {
  return allInvoices;
}
function saveInvoicesCache(invoices) {
  allInvoices = invoices;
  localStorage.setItem("paytrack_invoices", JSON.stringify(invoices));
}

/* ---------- SETTINGS (payment methods) ---------- */
function getPaymentOptions() {
  const s = JSON.parse(localStorage.getItem("paytrack_settings") || "{}");
  const p = s.payments || {};
  const opts = [];
  if (p.cash !== false) opts.push("Cash");
  if (p.upi  !== false) opts.push("UPI");
  if (p.bank === true)  opts.push("Bank");
  if (opts.length === 0) opts.push("Cash", "UPI");
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

    const settings = JSON.parse(localStorage.getItem("paytrack_settings") || "{}");
    const cur = settings.invoice?.currency || "₹";
    const invoiceId = invoice.invoiceId || invoice.id || "—";
    const total = Number(invoice.total || 0)
      .toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

    /* Actions cell */
    let actionsHTML = "";
    if (invoice.status === "pending") {
      actionsHTML = `
        <select class="payment-select" data-id="${invoiceId}">
          <option value="">Mark Paid</option>
          ${paymentOptions.map(p => `<option value="${p}">${p}</option>`).join("")}
        </select>
        <button class="delete-btn" data-id="${invoiceId}">🗑</button>`;
    } else {
      actionsHTML = `
        <span class="paid-via">
          ✓ ${invoice.paymentMethod || "Paid"}
        </span>
        <button class="delete-btn" data-id="${invoiceId}">🗑</button>`;
    }

    row.innerHTML = `
      <span class="inv-id-cell">${invoiceId}</span>
      <span class="inv-client-cell">${invoice.clientName || "—"}</span>
      <span class="inv-amt-cell">${cur}${total}</span>
      <span><span class="status ${invoice.status}">${invoice.status.toUpperCase()}</span></span>
      <span class="inv-actions-cell">${actionsHTML}</span>`;

    invoiceList.appendChild(row);

    /* Mark paid via dropdown */
    const select = row.querySelector(".payment-select");
    if (select) {
      select.addEventListener("change", async () => {
        const method = select.value;
        if (!method) return;

        /* Instant UI feedback */
        const statusSpan = row.querySelector(".status");
        if (statusSpan) {
          statusSpan.className = "status paid";
          statusSpan.textContent = "PAID";
        }
        const actionsCell = row.querySelector(".inv-actions-cell");
        if (actionsCell) {
          actionsCell.innerHTML = `
            <span class="paid-via">✓ ${method}</span>
            <button class="delete-btn" data-id="${invoiceId}">🗑</button>`;
          actionsCell.querySelector(".delete-btn").onclick = () => deleteInvoice(invoiceId);
        }

        /* Persist to API */
        try {
          await window.PayTrackAPI.Invoices.markPaid(invoiceId, method);
          /* Update local cache */
          const inv = allInvoices.find(i => (i.invoiceId || i.id) === invoiceId);
          if (inv) {
            inv.status        = "paid";
            inv.paymentMethod = method;
            inv.paidAt        = new Date().toISOString();
          }
          saveInvoicesCache(allInvoices);
          showToast(`Marked as paid via ${method}`);
        } catch (err) {
          showToast("Failed to mark paid: " + err.message, "error");
        }
      });
    }

    /* Delete handler */
    row.querySelector(".delete-btn")?.addEventListener("click", () => {
      deleteInvoice(invoiceId);
    });
  });
}

/* ---------- DELETE ---------- */
async function deleteInvoice(id) {
  if (!confirm("Delete this invoice permanently?")) return;
  try {
    await window.PayTrackAPI.Invoices.delete(id);
    allInvoices = allInvoices.filter(inv => (inv.invoiceId || inv.id) !== id);
    saveInvoicesCache(allInvoices);
    showToast("Invoice deleted");
    renderInvoices();
  } catch (err) {
    showToast("Failed to delete: " + err.message, "error");
  }
}

/* ---------- LOAD FROM API ---------- */
async function loadInvoices() {
  try {
    const res = await window.PayTrackAPI.Invoices.getAll();
    allInvoices = res.data || [];
    saveInvoicesCache(allInvoices);
    renderInvoices();
  } catch (err) {
    console.error("Failed to load invoices:", err);
    /* Fallback to localStorage cache */
    allInvoices = JSON.parse(localStorage.getItem("paytrack_invoices") || "[]");
    renderInvoices();
  }
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadInvoices();
});
