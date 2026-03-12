/* ============================================================
   PayTrack — Dashboard v2 Logic  (js/dashboard-v2.js)
   Requires js/api.js to be loaded first
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

  /* ── Auth guard ── */
  if (!window.PayTrackAPI.Auth.isLoggedIn()) {
    window.location.href = "login.html"; return;
  }

  const { Invoices, Settings, Clients } = window.PayTrackAPI;

  /* ── Elements ── */
  const searchInput      = document.querySelector(".nav-center input");
  const viewAllLink      = document.querySelector(".panel-header .link");
  const createInvoiceBtn = document.querySelector(".btn-primary");

  /* ── Nav ── */
  if (createInvoiceBtn) createInvoiceBtn.onclick = () => location.href = "create-invoice-v2.html";
  if (viewAllLink) viewAllLink.onclick = (e) => { e.preventDefault(); location.href = "view-invoices.html"; };

  /* ── Business branding handled by nav.js ── */

  /* ── Currency helper ── */
  const cur = (() => {
    const s = JSON.parse(localStorage.getItem("paytrack_settings") || "{}");
    return s.invoice?.currency || "₹";
  })();

  const fmt = (n) => {
    const num = Number(n || 0);
    const parts = num.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts[1] === "00" ? `${cur}${parts[0]}` : `${cur}${parts.join(".")}`;
  };

  /* ── Stats ── */
  function updateStats(invoices, clientCount) {
    let totalRevenue = 0, paidCount = 0, pendingAmount = 0;
    invoices.forEach(inv => {
      const t = Number(inv.total || 0);
      totalRevenue += t;
      if (inv.status === "paid") paidCount++;
      else pendingAmount += t;
    });

    const el = (id) => document.getElementById(id);
    if (el("statRevenue")) el("statRevenue").textContent = fmt(totalRevenue);
    if (el("statPaid"))    el("statPaid").textContent    = paidCount;
    if (el("statPending")) el("statPending").textContent = fmt(pendingAmount);
    if (el("statClients")) el("statClients").textContent = clientCount || 0;
  }

  /* ── Recent invoices ── */
  function renderRecentInvoices(invoices) {
    const panel = document.querySelector(".panel");
    if (!panel) return;

    panel.querySelectorAll(".invoice-row:not(.inv-col-label), .empty-state-dash").forEach(r => r.remove());

    const recent = invoices.slice(0, 4);
    if (!recent.length) {
      const empty = document.createElement("p");
      empty.className = "empty-state-dash muted";
      empty.style.cssText = "padding:28px 0;text-align:center;font-size:14px;";
      empty.textContent = "No invoices yet. Create your first!";
      panel.appendChild(empty);
      return;
    }

    recent.forEach(inv => {
      const row = document.createElement("div");
      row.className = "invoice-row";
      row.innerHTML = `
        <span style="font-family:monospace;font-size:12px;font-weight:600;color:var(--accent-light)">${inv.invoiceId}</span>
        <span class="muted">${inv.clientName || "—"}</span>
        <span class="${inv.status === "paid" ? "paid" : "pending"}">${inv.status.toUpperCase()}</span>
        <span style="font-weight:600;">${fmt(inv.total)}</span>`;
      panel.appendChild(row);
    });
  }

  /* ── Insights ── */
  function updateInsights(invoices) {
    const now          = new Date();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1);

    const week7Rev  = invoices.filter(i => i.status === "paid" && new Date(i.paidAt || i.createdAt) >= sevenDaysAgo).reduce((s, i) => s + Number(i.total || 0), 0);
    const monthRev  = invoices.filter(i => i.status === "paid" && new Date(i.paidAt || i.createdAt) >= monthStart).reduce((s, i) => s + Number(i.total || 0), 0);
    const paidCount = invoices.filter(i => i.status === "paid").length;
    const rate      = invoices.length ? Math.round((paidCount / invoices.length) * 100) : 0;
    const avgVal    = invoices.length ? invoices.reduce((s, i) => s + Number(i.total || 0), 0) / invoices.length : 0;

    const clientTotals = {};
    invoices.forEach(inv => {
      const n = (inv.clientName || "").trim();
      if (n) clientTotals[n] = (clientTotals[n] || 0) + Number(inv.total || 0);
    });
    const bestClient = Object.entries(clientTotals).sort((a, b) => b[1] - a[1])[0];

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set("insightWeek",       invoices.length ? fmt(week7Rev)  : "—");
    set("insightMonth",      invoices.length ? fmt(monthRev)  : "—");
    set("insightBestClient", bestClient ? bestClient[0] : "—");
    set("insightAvg",        invoices.length ? fmt(avgVal)    : "—");
    set("insightRate",       invoices.length ? `${rate}%`     : "—");

    const pending  = invoices.filter(i => i.status !== "paid").length;
    const alertEl  = document.getElementById("alertText");
    if (alertEl) {
      alertEl.textContent = pending > 0
        ? `${pending} invoice${pending !== 1 ? "s" : ""} pending payment`
        : invoices.length === 0 ? "No invoices yet — create your first one!"
        : "All invoices are paid 🎉";
    }
  }

  /* ── Search ── */
  let allInvoices = [];
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      renderRecentInvoices(q
        ? allInvoices.filter(inv =>
            inv.invoiceId.toLowerCase().includes(q) ||
            (inv.clientName || "").toLowerCase().includes(q) ||
            inv.status.toLowerCase().includes(q))
        : allInvoices);
    });
  }

  /* ── Load all data ── */
  async function loadDashboard() {
    try {
      const [invoicesRes, clientsRes] = await Promise.all([
        Invoices.getAll(),
        Clients.getAll().catch(() => ({ data: [] })),
      ]);

      allInvoices = invoicesRes.data || [];
      const clientCount = (clientsRes.data || []).length;

      /* Cache settings for PDF/offline use */
      try {
        const settingsRes = await Settings.get();
        if (settingsRes.data) {
          localStorage.setItem("paytrack_settings", JSON.stringify(settingsRes.data));
        }
      } catch (_) {}

      updateStats(allInvoices, clientCount);
      renderRecentInvoices(allInvoices);
      updateInsights(allInvoices);

      /* Cache invoices locally for PDF generation */
      localStorage.setItem("paytrack_invoices", JSON.stringify(
        allInvoices.map(inv => ({ ...inv, id: inv.invoiceId }))
      ));

    } catch (err) {
      console.error("Dashboard load error:", err);
    }
  }

  /* ── Init ── */
  await loadDashboard();

  /* Re-sync when tab regains focus */
  window.addEventListener("focus", loadDashboard);
});