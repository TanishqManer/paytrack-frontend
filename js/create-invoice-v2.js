document.addEventListener("DOMContentLoaded", async () => {

  /* ============================================================
     PayTrack — Create Invoice  (js/create-invoice-v2.js)
     - Items loaded from API (no localStorage)
     - Invoice saved to MongoDB via API
     - Settings pulled from API (with localStorage fallback)
     - Full branded PDF engine (same as view-invoices)
     - All original UI logic preserved
     ============================================================ */

  /* ---------- AUTH GUARD ---------- */
  if (!window.PayTrackAPI.Auth.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  const { Invoices, Items, Settings } = window.PayTrackAPI;

  /* ============================================================
     TOAST  (fully preserved from original)
     ============================================================ */
  function showToast(message, type = "success") {
    document.querySelectorAll(".ci-toast").forEach(t => t.remove());

    const toast    = document.createElement("div");
    toast.className = "ci-toast";
    const isError  = type === "error";

    toast.style.cssText = `
      position: fixed;
      bottom: 28px;
      right: 28px;
      background: var(--bg-card, #13131f);
      border: 1px solid ${isError ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"};
      border-left: 3px solid ${isError ? "#ef4444" : "#10b981"};
      border-radius: 14px;
      padding: 16px 20px;
      font-size: 14px;
      font-family: 'DM Sans', sans-serif;
      color: ${isError ? "#fca5a5" : "#6ee7b7"};
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 12px;
      min-width: 280px;
      max-width: 380px;
      animation: ciSlideIn 0.3s cubic-bezier(0.4,0,0.2,1) both;
    `;

    const icon = document.createElement("span");
    icon.style.cssText = `
      width: 28px; height: 28px; border-radius: 50%;
      background: ${isError ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)"};
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; flex-shrink: 0;
    `;
    icon.textContent = isError ? "✕" : "✓";

    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(icon);
    toast.appendChild(text);

    if (!document.getElementById("ci-toast-styles")) {
      const style = document.createElement("style");
      style.id = "ci-toast-styles";
      style.textContent = `
        @keyframes ciSlideIn {
          from { opacity:0; transform: translateX(20px); }
          to   { opacity:1; transform: translateX(0); }
        }
        @keyframes ciSlideOut {
          from { opacity:1; transform: translateX(0); }
          to   { opacity:0; transform: translateX(20px); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = "ciSlideOut 0.3s cubic-bezier(0.4,0,0.2,1) forwards";
      setTimeout(() => toast.remove(), 300);
    }, type === "success" ? 3000 : 4000);
  }

  /* ============================================================
     SETTINGS — fetch from API, fallback to localStorage cache
     ============================================================ */
  let invoiceSettings = { prefix: "INV", gstPercent: 0, dueDays: 15, currency: "₹" };
  let paymentSettings = { cash: true, upi: true, bank: false, upiId: "", bankDetails: "" };

  try {
    const res = await Settings.get();
    if (res.data) {
      /* Cache for offline / PDF use */
      localStorage.setItem("paytrack_settings", JSON.stringify(res.data));
      invoiceSettings = res.data.invoice  || invoiceSettings;
      paymentSettings = res.data.payments || paymentSettings;
    }
  } catch (_) {
    /* Fall back to localStorage cache */
    const cached = JSON.parse(localStorage.getItem("paytrack_settings") || "{}");
    if (cached.invoice)  invoiceSettings = cached.invoice;
    if (cached.payments) paymentSettings = cached.payments;
  }

  /* ============================================================
     ITEMS — fetch from API
     ============================================================ */
  let products = [];

  async function loadProducts() {
    try {
      const res = await Items.getAll();
      products  = (res.data || []).map(item => ({
        /* Normalize API field names to what the UI expects */
        id:          item._id || item.id,
        name:        item.name,
        price:       item.price,
        description: item.description || "",
        /* API stores Cloudinary URL as imageUrl; UI uses image */
        image:       item.imageUrl || item.image || "",
      }));

      /* Keep localStorage in sync for any legacy references */
      localStorage.setItem("paytrack_items", JSON.stringify(products));
    } catch (err) {
      console.error("Failed to load items:", err);
      /* Fallback to cached items */
      products = JSON.parse(localStorage.getItem("paytrack_items") || "[]");
    }
  }

  /* ============================================================
     CART STATE
     ============================================================ */
  let cart = [];

  /* ============================================================
     ELEMENTS
     ============================================================ */
  const productGrid      = document.getElementById("productGrid");
  const invoiceCart      = document.getElementById("invoiceCart");
  const totalAmount      = document.getElementById("totalAmount");
  const clientNameInput    = document.getElementById("clientName");
  const clientEmailInput   = document.getElementById("clientEmail");
  const clientAddressInput = document.getElementById("clientAddress");
  const createInvoiceBtn   = document.getElementById("createInvoiceBtn");

  /* ============================================================
     FULL BRANDED PDF ENGINE
     (Same engine as view-invoices.js — replaces the basic original)
     ============================================================ */
  async function generateInvoicePDF(invoice) {
    const jspdfLib = window.jspdf || window.jsPDF;
    if (!jspdfLib?.jsPDF && typeof jsPDF === "undefined") {
      console.error("jsPDF not available");
      return null;
    }

    const biz    = JSON.parse(localStorage.getItem("paytrack_business")) || {};
    const rawCur = invoiceSettings.currency || "Rs.";
    const cur    = rawCur === "₹" ? "Rs." : rawCur === "€" ? "EUR " : rawCur === "$" ? "$ " : rawCur + " ";

    const { jsPDF } = window.jspdf || window.jsPDF || { jsPDF: window.jsPDF };
    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });

    const PW = 210, PH = 297, ML = 14, MR = 14;
    const CW = PW - ML - MR;

    const INDIGO   = [99,  102, 241];
    const INDIGO_D = [79,  70,  229];
    const IND_PALE = [238, 238, 253];
    const WHITE    = [255, 255, 255];
    const INK      = [17,  17,  51 ];
    const BODY     = [55,  55,  90 ];
    const MUTED    = [120, 120, 160];
    const RULE     = [220, 220, 235];
    const BGLIGHT  = [248, 248, 254];
    const GREEN    = [16,  185, 129];
    const AMBER    = [245, 158, 11 ];
    const GREENBG  = [236, 253, 245];

    const fc    = (c) => doc.setFillColor(c[0], c[1], c[2]);
    const tc    = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const dc    = (c) => doc.setDrawColor(c[0], c[1], c[2]);
    const lw    = (w) => doc.setLineWidth(w);
    const fn    = (sz, st = "normal") => { doc.setFontSize(sz); doc.setFont("helvetica", st); };
    const box   = (x, y, w, h, c)        => { fc(c); doc.rect(x, y, w, h, "F"); };
    const rbox  = (x, y, w, h, r, c)     => { fc(c); doc.roundedRect(x, y, w, h, r, r, "F"); };
    const stroke = (x, y, w, h, r, c, lwidth = 0.3) => {
      dc(c); lw(lwidth); doc.roundedRect(x, y, w, h, r, r, "S");
    };
    const hline = (y, c = RULE, weight = 0.25) => {
      dc(c); lw(weight); doc.line(ML, y, PW - MR, y);
    };
    const fmt = (n) => {
      const num   = Number(n || 0);
      const parts = num.toFixed(2).split(".");
      parts[0]    = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      return parts.join(".");
    };
    const money = (n) => `${cur} ${fmt(n)}`;
    const fdate = (s) => {
      try {
        return new Date(s).toLocaleDateString("en-IN", {
          day: "2-digit", month: "short", year: "numeric"
        });
      } catch (_) { return "—"; }
    };

    const invoiceDisplayId = invoice.invoiceId || invoice.id || "—";
    const isPaid = invoice.status === "paid";

    /* Page background */
    box(0, 0, PW, PH, WHITE);

    /* ── HEADER ── */
    box(0, 0, PW, 56, INDIGO);
    fc(INDIGO_D);
    doc.triangle(PW - 70, 0, PW, 0, PW, 56, "F");

    let logoRight = ML;
    if (biz.logo) {
      try {
        const LW = 36, LH = 36, LY = (56 - LH) / 2;
        rbox(ML - 2, LY - 2, LW + 4, LH + 4, 4, WHITE);
        doc.addImage(biz.logo, "PNG", ML, LY, LW, LH);
        logoRight = ML + LW + 10;
      } catch (_) { logoRight = ML; }
    }

    fn(13, "bold"); tc(WHITE);
    doc.text((biz.name || "Your Business").toUpperCase(), logoRight, 21);

    fn(7.5, "normal"); tc([220, 220, 255]);
    let infoY = 28;
    if (biz.address) {
      const aLines = doc.splitTextToSize(biz.address, 100);
      aLines.forEach(l => { doc.text(l, logoRight, infoY); infoY += 4.5; });
    }
    const contactLine = [biz.email, biz.phone].filter(Boolean).join("   |   ");
    if (contactLine) doc.text(contactLine, logoRight, infoY);

    fn(24, "bold"); tc(WHITE);
    doc.text("INVOICE", PW - MR, 26, { align: "right" });
    fn(8.5, "normal"); tc([220, 220, 255]);
    doc.text(`No.  ${invoiceDisplayId}`, PW - MR, 34, { align: "right" });

    const pillTxt = isPaid ? "PAID" : "PENDING";
    fn(7.5, "bold");
    const pW = doc.getTextWidth(pillTxt) + 12;
    const pX = PW - MR - pW;
    rbox(pX, 38, pW, 7.5, 2.5, isPaid ? GREEN : AMBER);
    tc(WHITE);
    doc.text(pillTxt, pX + pW / 2, 43.3, { align: "center" });

    /* ── META ROW ── */
    let Y = 70;
    fn(7, "bold"); tc(MUTED);
    doc.text("DATE ISSUED", ML,      Y);
    doc.text("DUE DATE",    ML + 56, Y);
    fn(9.5, "bold"); tc(INK);
    doc.text(fdate(invoice.createdAt), ML,      Y + 6);
    doc.text(fdate(invoice.dueDate),   ML + 56, Y + 6);

    fn(7, "bold"); tc(MUTED);
    doc.text("BILL TO", PW - MR, Y, { align: "right" });
    fn(11, "bold"); tc(INK);
    doc.text(invoice.clientName || "—", PW - MR, Y + 7, { align: "right" });

    fn(8, "normal"); tc(BODY);
    let billY = Y + 13;
    if (invoice.clientEmail) {
      doc.text(invoice.clientEmail, PW - MR, billY, { align: "right" });
      billY += 5;
    }
    if (invoice.clientAddress) {
      const al = doc.splitTextToSize(invoice.clientAddress, 75);
      al.forEach(l => { doc.text(l, PW - MR, billY, { align: "right" }); billY += 4.5; });
    }

    Y = Math.max(Y + 22, billY + 4);
    hline(Y, RULE, 0.4);
    Y += 8;

    /* ── ITEMS TABLE ── */
    doc.autoTable({
      startY: Y,
      head:   [["#", "DESCRIPTION", "QTY", "RATE", "AMOUNT"]],
      body:   (invoice.items || []).map((item, i) => [
        String(i + 1),
        item.name || "—",
        String(item.qty || 1),
        money(item.price || 0),
        money((item.price || 0) * (item.qty || 1)),
      ]),
      theme:  "plain",
      styles: {
        font: "helvetica", fontSize: 9, cellPadding: 5,
        lineColor: RULE, lineWidth: 0.2, textColor: BODY, overflow: "linebreak",
      },
      headStyles: {
        fillColor: IND_PALE, textColor: INDIGO, fontStyle: "bold", fontSize: 7.5,
        cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
        lineWidth: { bottom: 0.6 }, lineColor: INDIGO,
      },
      columnStyles: {
        0: { cellWidth: 8,      halign: "center", textColor: MUTED },
        1: { cellWidth: "auto" },
        2: { cellWidth: 14,     halign: "center" },
        3: { cellWidth: 42,     halign: "right"  },
        4: { cellWidth: 42,     halign: "right",  fontStyle: "bold", textColor: INK },
      },
      alternateRowStyles: { fillColor: BGLIGHT },
      bodyStyles:         { fillColor: WHITE },
      margin: { left: ML, right: MR },
    });

    Y = doc.lastAutoTable.finalY + 8;

    /* ── TOTALS ── */
    const subtotal  = Number(invoice.subtotal  || 0);
    const gstPct    = Number(invoice.gstPercent || 0);
    const gstAmt    = subtotal * gstPct / 100;
    const total     = Number(invoice.total || subtotal + gstAmt);
    const rowsCount = gstPct > 0 ? 2 : 1;
    const cardH     = rowsCount * 9 + 16;
    const TW = 96, TX = PW - MR - TW;

    rbox(TX, Y, TW, cardH, 3, BGLIGHT);
    stroke(TX, Y, TW, cardH, 3, RULE);
    fn(8.5, "normal"); tc(MUTED);
    doc.text("Subtotal", TX + 6, Y + 8);
    tc(BODY); doc.text(money(subtotal), PW - MR - 4, Y + 8, { align: "right" });

    if (gstPct > 0) {
      tc(MUTED); doc.text(`GST (${gstPct}%)`, TX + 6, Y + 17);
      tc(BODY);  doc.text(money(gstAmt), PW - MR - 4, Y + 17, { align: "right" });
    }

    const totalY = Y + rowsCount * 9 + 4;
    rbox(TX, totalY, TW, 13, 3, INDIGO);
    fn(10.5, "bold"); tc(WHITE);
    doc.text("TOTAL DUE", TX + 6, totalY + 8.5);
    doc.text(money(total), PW - MR - 4, totalY + 8.5, { align: "right" });
    Y = totalY + 18;

    /* ── PAYMENT METHOD (if paid) ── */
    if (invoice.paymentMethod) {
      rbox(ML, Y, 76, 14, 3, GREENBG);
      stroke(ML, Y, 76, 14, 3, GREEN, 0.4);
      fn(7, "bold"); tc(MUTED);
      doc.text("PAYMENT RECEIVED VIA", ML + 5, Y + 5.5);
      fn(9, "bold"); tc(GREEN);
      doc.text(invoice.paymentMethod.toUpperCase(), ML + 5, Y + 11);
      Y += 20;
    }

    /* ── PAYMENT DETAILS from settings ── */
    const hasPayDets =
      (paymentSettings.upi && paymentSettings.upiId) ||
      (paymentSettings.bank && paymentSettings.bankDetails);

    if (hasPayDets) {
      fn(7.5, "bold"); tc(MUTED);
      doc.text("PAYMENT DETAILS", ML, Y);
      hline(Y + 3, RULE, 0.3);
      Y += 9;
      fn(8.5, "normal");
      if (paymentSettings.upi && paymentSettings.upiId) {
        tc(MUTED); doc.text("UPI ID:", ML, Y);
        tc(BODY);  doc.text(paymentSettings.upiId, ML + 20, Y);
        Y += 6;
      }
      if (paymentSettings.bank && paymentSettings.bankDetails) {
        tc(MUTED); doc.text("Bank:", ML, Y);
        tc(BODY);
        const bl = doc.splitTextToSize(paymentSettings.bankDetails, CW - 22);
        doc.text(bl, ML + 20, Y);
        Y += bl.length * 5 + 3;
      }
      Y += 4;
    }

    /* ── STAMP ── */
    const FOOTER_H   = 16;
    const sigZoneTop = PH - FOOTER_H - 64;
    const stampY     = Math.max(Y + 6, sigZoneTop);

    if (biz.stamp) {
      try {
        const SW = 48, SH = 48;
        const SX = PW - MR - SW;
        dc(RULE); lw(0.4);
        doc.setLineDash([2.5, 1.5]);
        doc.roundedRect(SX - 5, stampY - 4, SW + 10, SH + 18, 3, 3, "S");
        doc.setLineDash([]);
        doc.addImage(biz.stamp, "PNG", SX, stampY, SW, SH);
        fn(7, "normal"); tc(MUTED);
        doc.text("Authorized Signature", SX + SW / 2, stampY + SH + 6, { align: "center" });
        fn(7.5, "bold"); tc(INK);
        doc.text((biz.name || "").toUpperCase(), SX + SW / 2, stampY + SH + 12, { align: "center" });
      } catch (_) {}
    }

    fn(8, "normal"); tc(MUTED);
    doc.text("Thank you for your business!", ML, Math.max(Y + 16, sigZoneTop + 52));

    /* ── FOOTER ── */
    box(0, PH - FOOTER_H, PW, FOOTER_H, INDIGO);
    fn(7, "normal"); tc([220, 220, 255]);
    doc.text("Generated by PayTrack", ML, PH - FOOTER_H + 9.5);
    doc.text(
      `Invoice ${invoiceDisplayId}  ·  ${fdate(new Date().toISOString())}`,
      PW - MR, PH - FOOTER_H + 9.5, { align: "right" }
    );
    tc([200, 200, 255]); fn(6.5, "normal");
    doc.text("Page 1 of 1", PW / 2, PH - FOOTER_H + 9.5, { align: "center" });

    /* Return as base64 data URI */
    const blob = doc.output("blob");
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  }

  /* ============================================================
     RENDER PRODUCTS  (fully preserved from original)
     ============================================================ */
  function renderProducts() {
    if (!productGrid) return;
    productGrid.innerHTML = "";

    if (products.length === 0) {
      productGrid.innerHTML = `
        <div class="empty-catalog">
          <div class="empty-catalog-icon">🛍️</div>
          <p>No products found.<br>Add items first from the Items page.</p>
          <button class="btn-secondary" onclick="window.location.href='add-item.html'">
            + Add Items
          </button>
        </div>`;
      return;
    }

    products.forEach(product => {
      const card = document.createElement("div");
      card.className = "product-card";

      card.innerHTML = `
        <div class="product-image">
          ${product.image
            ? `<img src="${product.image}" alt="${product.name}">`
            : `<span class="product-image-placeholder">📦</span>`}
        </div>
        <div class="product-body">
          <h4>${product.name}</h4>
          <div class="product-price">
            ${invoiceSettings.currency}${product.price}
          </div>
        </div>
        <div class="product-actions">
          <button class="btn-add-cart">+ Add to Cart</button>
        </div>`;

      card.querySelector("button").addEventListener("click", () => addToCart(product));
      productGrid.appendChild(card);
    });
  }

  /* ============================================================
     ADD TO CART  (fully preserved from original)
     ============================================================ */
  function addToCart(product) {
    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id: product.id, name: product.name, price: product.price, qty: 1 });
    }
    renderCart();
  }

  /* ============================================================
     RENDER CART  (fully preserved from original)
     ============================================================ */
  function renderCart() {
    if (!invoiceCart) return;
    invoiceCart.innerHTML = "";

    if (cart.length === 0) {
      invoiceCart.innerHTML = `
        <div class="cart-empty">
          <div class="cart-empty-icon">🛒</div>
          No items added yet
        </div>`;
      if (totalAmount) totalAmount.textContent = `${invoiceSettings.currency}0`;
      return;
    }

    cart.forEach(item => {
      const row = document.createElement("div");
      row.className = "cart-item";

      row.innerHTML = `
        <div class="cart-item-info">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">${invoiceSettings.currency}${item.price} each</div>
        </div>
        <div class="cart-qty">
          <button class="qty-btn" data-action="dec">−</button>
          <span class="qty-value">${item.qty}</span>
          <button class="qty-btn" data-action="inc">+</button>
        </div>
        <div class="cart-item-total">
          ${invoiceSettings.currency}${item.price * item.qty}
        </div>`;

      row.querySelector("[data-action='inc']").onclick = () => { item.qty++; renderCart(); };
      row.querySelector("[data-action='dec']").onclick = () => {
        item.qty--;
        if (item.qty <= 0) cart = cart.filter(i => i.id !== item.id);
        renderCart();
      };

      invoiceCart.appendChild(row);
    });

    calculateTotal();
  }

  /* ============================================================
     CALCULATE TOTAL  (fully preserved from original)
     ============================================================ */
  function calculateTotal() {
    const subtotal  = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const gstAmount = subtotal * (invoiceSettings.gstPercent / 100);
    const total     = subtotal + gstAmount;
    const currency  = invoiceSettings.currency || "₹";
    const gstPct    = invoiceSettings.gstPercent || 0;

    if (totalAmount) totalAmount.textContent = `${currency}${total.toFixed(2)}`;

    /* Update summary panel */
    const subtotalDisplay = document.getElementById("subtotalDisplay");
    const gstDisplay      = document.getElementById("gstDisplay");
    const totalDisplay    = document.getElementById("totalDisplay");
    const gstRow          = document.getElementById("gstRow");
    const cartBadge       = document.getElementById("cartBadge");

    if (subtotalDisplay) subtotalDisplay.textContent = `${currency}${subtotal.toFixed(2)}`;
    if (gstDisplay)      gstDisplay.textContent      = `${currency}${gstAmount.toFixed(2)}`;
    if (totalDisplay)    totalDisplay.textContent     = `${currency}${total.toFixed(2)}`;
    if (gstRow) {
      const label = gstRow.querySelector("span");
      if (label) label.textContent = `GST (${gstPct}%)`;
      gstRow.style.display = gstPct > 0 ? "" : "none";
    }
    if (cartBadge) cartBadge.textContent = cart.reduce((s, i) => s + i.qty, 0);

    return { subtotal, gstAmount, total };
  }

  /* ============================================================
     CREATE INVOICE  — saves to MongoDB via API
     ============================================================ */
  if (createInvoiceBtn) {
    createInvoiceBtn.addEventListener("click", async () => {

      if (cart.length === 0) {
        showToast("Add at least one item to the cart first.", "error");
        return;
      }

      const clientName = clientNameInput?.value.trim();
      if (!clientName) {
        showToast("Client name is required.", "error");
        clientNameInput?.focus();
        return;
      }

      /* Loading state */
      createInvoiceBtn.textContent = "Generating invoice…";
      createInvoiceBtn.disabled    = true;

      try {
        const { subtotal, gstAmount, total } = calculateTotal();
        const createdAt = new Date().toISOString();
        const dueDate   = new Date(
          Date.now() + (invoiceSettings.dueDays || 0) * 86400000
        ).toISOString();

        /* Build invoice payload for API */
        const invoicePayload = {
          clientName,
          clientEmail:   clientEmailInput?.value.trim()   || "",
          clientAddress: clientAddressInput?.value.trim() || "",
          items:         cart.map(item => ({
            itemId: String(item.id),
            name:   item.name,
            qty:    item.qty,
            price:  item.price,
          })),
          subtotal,
          gstPercent: invoiceSettings.gstPercent || 0,
          gstAmount,
          total,
          dueDate,
        };

        /* Save to MongoDB */
        const res     = await Invoices.create(invoicePayload);
        const created = res.data;

        /* Build a local invoice object for PDF generation
           (uses the invoiceId the server assigned) */
        const invoiceForPdf = {
          invoiceId:     created.invoiceId,
          id:            created.invoiceId,
          clientName,
          clientEmail:   invoicePayload.clientEmail,
          clientAddress: invoicePayload.clientAddress,
          items:         cart,
          subtotal,
          gstPercent:    invoiceSettings.gstPercent || 0,
          gstAmount,
          total,
          status:        "pending",
          paymentMethod: null,
          createdAt:     created.createdAt || createdAt,
          dueDate:       created.dueDate   || dueDate,
        };

        /* Generate full branded PDF */
        const pdfBase64 = await generateInvoicePDF(invoiceForPdf);

        /* Optionally save PDF URL back to invoice record */
        if (pdfBase64) {
          try {
            await Invoices.savePdfUrl(created.invoiceId, pdfBase64);
          } catch (_) { /* non-critical */ }
        }

        /* Keep localStorage in sync for dashboard + other pages */
        const cached = JSON.parse(localStorage.getItem("paytrack_invoices") || "[]");
        cached.unshift({ ...invoiceForPdf, pdfBase64 });
        localStorage.setItem("paytrack_invoices", JSON.stringify(cached));

        /* ── Reset UI ── */
        createInvoiceBtn.textContent = "✦ Create Invoice";
        createInvoiceBtn.disabled    = false;

        cart = [];
        renderCart();
        if (totalAmount) totalAmount.textContent = `${invoiceSettings.currency}0`;
        if (clientNameInput)    clientNameInput.value    = "";
        if (clientEmailInput)   clientEmailInput.value   = "";
        if (clientAddressInput) clientAddressInput.value = "";

        showToast(`Invoice ${created.invoiceId} created ✓`, "success");

      } catch (err) {
        console.error("Create invoice error:", err);
        showToast(err.message || "Failed to create invoice.", "error");
        createInvoiceBtn.textContent = "✦ Create Invoice";
        createInvoiceBtn.disabled    = false;
      }
    });
  }

  /* ============================================================
     INIT — load products then render UI
     ============================================================ */
  await loadProducts();
  renderProducts();
  renderCart();

});