/* ============================================================
   PayTrack — Settings Logic  (js/settings.js)
   Requires js/api.js to be loaded first
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

  /* ── Auth guard ── */
  if (!window.PayTrackAPI.Auth.isLoggedIn()) {
    window.location.href = "login.html"; return;
  }

  const { Settings } = window.PayTrackAPI;

  /* ── Load settings from API ── */
  let settings = {
    appearance: { theme: "dark" },
    invoice:    { prefix: "INV", gstPercent: 0, dueDays: 15, currency: "₹" },
    payments:   { cash: true, upi: true, bank: false, upiId: "", bankDetails: "" },
  };

  try {
    const res = await Settings.get();
    if (res.data) {
      settings = res.data;
      /* Cache locally for offline/PDF use */
      localStorage.setItem("paytrack_settings", JSON.stringify(settings));
    }
  } catch (err) {
    console.error("Failed to load settings:", err);
    /* Fall back to localStorage */
    const cached = localStorage.getItem("paytrack_settings");
    if (cached) settings = JSON.parse(cached);
  }

  /* ── Appearance ── */
  const darkToggle = document.getElementById("darkModeToggle");

  if (settings.appearance?.theme === "dark") {
    document.body.classList.add("dark");
    if (darkToggle) darkToggle.checked = true;
  }

  if (darkToggle) {
    darkToggle.addEventListener("change", async () => {
      document.body.classList.toggle("dark");
      settings.appearance.theme = document.body.classList.contains("dark") ? "dark" : "light";

      try {
        await Settings.save({ appearance: settings.appearance });
        localStorage.setItem("paytrack_settings", JSON.stringify(settings));
        toast("Appearance saved");
      } catch (err) {
        toast("Failed to save: " + err.message, "error");
      }
    });
  }

  /* ── Invoice defaults ── */
  const invoicePrefix = document.getElementById("invoicePrefix");
  const gstPercent    = document.getElementById("gstPercent");
  const dueDays       = document.getElementById("dueDays");
  const currency      = document.getElementById("currency");
  const saveInvoiceBtn = document.getElementById("saveInvoiceSettings");

  if (invoicePrefix) invoicePrefix.value = settings.invoice?.prefix     || "INV";
  if (gstPercent)    gstPercent.value    = settings.invoice?.gstPercent || 0;
  if (dueDays)       dueDays.value       = settings.invoice?.dueDays    || 15;
  if (currency)      currency.value      = settings.invoice?.currency   || "₹";

  if (saveInvoiceBtn) {
    saveInvoiceBtn.addEventListener("click", async () => {
      settings.invoice = {
        prefix:     invoicePrefix?.value.trim() || "INV",
        gstPercent: Number(gstPercent?.value)   || 0,
        dueDays:    Number(dueDays?.value)       || 15,
        currency:   currency?.value             || "₹",
      };

      try {
        await Settings.save({ invoice: settings.invoice });
        localStorage.setItem("paytrack_settings", JSON.stringify(settings));
        buttonConfirm(saveInvoiceBtn, "Saved ✓");
      } catch (err) {
        toast("Failed to save: " + err.message, "error");
      }
    });
  }

  /* ── Payment methods ── */
  const payCash       = document.getElementById("payCash");
  const payUpi        = document.getElementById("payUpi");
  const payBank       = document.getElementById("payBank");
  const upiId         = document.getElementById("upiId");
  const bankDetails   = document.getElementById("bankDetails");
  const savePaymentBtn = document.getElementById("savePaymentSettings");

  if (payCash)      payCash.checked    = settings.payments?.cash ?? true;
  if (payUpi)       payUpi.checked     = settings.payments?.upi  ?? true;
  if (payBank)      payBank.checked    = settings.payments?.bank ?? false;
  if (upiId)        upiId.value        = settings.payments?.upiId        || "";
  if (bankDetails)  bankDetails.value  = settings.payments?.bankDetails  || "";

  if (savePaymentBtn) {
    savePaymentBtn.addEventListener("click", async () => {
      settings.payments = {
        cash:        payCash?.checked    ?? true,
        upi:         payUpi?.checked     ?? true,
        bank:        payBank?.checked    ?? false,
        upiId:       upiId?.value.trim() || "",
        bankDetails: bankDetails?.value.trim() || "",
      };

      try {
        await Settings.save({ payments: settings.payments });
        localStorage.setItem("paytrack_settings", JSON.stringify(settings));
        buttonConfirm(savePaymentBtn, "Saved ✓");
      } catch (err) {
        toast("Failed to save: " + err.message, "error");
      }
    });
  }
});

/* ── UI Helpers ── */
function buttonConfirm(btn, text) {
  const original = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1400);
}

function toast(message, type = "success") {
  const t = document.createElement("div");
  t.className = "toast";
  t.style.borderLeftColor = type === "error" ? "var(--danger)" : "var(--success)";
  t.textContent = message;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}