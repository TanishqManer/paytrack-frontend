document.addEventListener("DOMContentLoaded", async () => {

  /* ============================================================
     PayTrack — View Invoices  (js/view-invoices.js)
     - All data from MongoDB via PayTrackAPI
     - Cash: manual Mark Paid dropdown → optional Send Invoice
     - Online: Razorpay checkout → auto-marks Paid → auto-emails receipt
     - UPI QR code displayed in modal for easy scanning
     - PDF engine fully preserved from original
     ============================================================ */

  /* ---------- AUTH GUARD ---------- */
  if (!window.PayTrackAPI.Auth.isLoggedIn()) {
    window.location.href = "login.html";
    return;
  }

  const { Invoices, Payments } = window.PayTrackAPI;

  /* ---------- ELEMENTS ---------- */
  const invoiceList = document.getElementById("invoiceList");

  /* ---------- SETTINGS ---------- */
  function getSettings() {
    return JSON.parse(localStorage.getItem("paytrack_settings")) || {};
  }

  const settings        = getSettings();
  const invoiceSettings = settings.invoice  || { currency: "₹", prefix: "INV", gstPercent: 0 };
  const payments        = settings.payments || { cash: true, upi: true, bank: false };
  if (payments.cash === undefined) payments.cash = true;
  if (payments.upi  === undefined) payments.upi  = true;

  /* ---------- IN-MEMORY INVOICE STORE ---------- */
  let allInvoices = [];

  /* ============================================================
     TOAST
     ============================================================ */
  function showToast(msg, type = "success") {
    document.querySelectorAll(".vi-toast").forEach(t => t.remove());
    const t = document.createElement("div");
    t.className = "vi-toast toast";
    t.style.borderLeftColor =
      type === "error" ? "var(--danger)" :
      type === "info"  ? "var(--accent)"  :
                         "var(--success)";

    const icon = document.createElement("span");
    icon.style.cssText = `
      width:24px;height:24px;border-radius:50%;
      background:${type === "error" ? "var(--danger-dim)" : type === "info" ? "var(--accent-dim)" : "var(--success-dim)"};
      color:${type === "error" ? "var(--danger)" : type === "info" ? "var(--accent-light)" : "var(--success)"};
      display:flex;align-items:center;justify-content:center;
      font-size:12px;font-weight:700;flex-shrink:0;`;
    icon.textContent = type === "error" ? "✕" : type === "info" ? "…" : "✓";

    const text = document.createElement("span");
    text.textContent = msg;
    t.appendChild(icon);
    t.appendChild(text);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  /* ============================================================
     UPI QR CODE MODAL
     Generates a UPI QR using Google Charts API
     ============================================================ */
  function showUpiQrModal(invoice) {
    document.getElementById("upiQrModal")?.remove();

    const upiId     = payments.upiId || "";
    const bizName   = (JSON.parse(localStorage.getItem("paytrack_business") || "{}").name || "PayTrack").replace(/\s/g, "%20");
    const amount    = Number(invoice.total || 0).toFixed(2);
    const invoiceId = invoice.invoiceId || invoice.id || "";
    const note      = `Invoice%20${invoiceId}`;

    /* UPI deep link */
    const upiLink = upiId
      ? `upi://pay?pa=${upiId}&pn=${bizName}&am=${amount}&cu=INR&tn=${note}`
      : null;

    /* QR image via Google Charts */
    const qrUrl = upiLink
      ? `https://chart.googleapis.com/chart?chs=200x200&cht=qr&chl=${encodeURIComponent(upiLink)}&choe=UTF-8`
      : null;

    const modal = document.createElement("div");
    modal.id = "upiQrModal";
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(0,0,0,0.7);
      display:flex;align-items:center;justify-content:center;
      z-index:99999;backdrop-filter:blur(4px);
    `;

    modal.innerHTML = `
      <div style="
        background:#13131f;border:1px solid rgba(99,102,241,0.3);
        border-radius:20px;padding:36px;width:100%;max-width:360px;
        box-shadow:0 40px 100px rgba(0,0,0,0.6);
        font-family:'DM Sans',sans-serif;text-align:center;
      ">
        <h3 style="margin:0 0 6px;color:#fff;font-size:20px;font-weight:800;">
          💳 Collect Payment
        </h3>
        <p style="margin:0 0 24px;color:#9ca3af;font-size:13px;">
          Invoice <strong style="color:#a5b4fc;">${invoiceId}</strong> ·
          <strong style="color:#6ee7b7;">₹${amount}</strong>
        </p>

        ${qrUrl ? `
          <div style="
            background:#fff;border-radius:12px;padding:12px;
            display:inline-block;margin-bottom:16px;
          ">
            <img src="${qrUrl}" width="200" height="200" alt="UPI QR Code" style="display:block;" />
          </div>
          <p style="color:#9ca3af;font-size:12px;margin:0 0 8px;">
            Scan with any UPI app to pay
          </p>
          ${upiId ? `<p style="color:#a5b4fc;font-size:13px;font-weight:600;margin:0 0 20px;">UPI: ${upiId}</p>` : ""}
        ` : `
          <div style="
            background:#1a1a2e;border:1px dashed rgba(99,102,241,0.3);
            border-radius:12px;padding:24px;margin-bottom:20px;
          ">
            <p style="color:#9ca3af;font-size:13px;margin:0;">
              No UPI ID configured.<br>
              Add your UPI ID in <a href="settings.html" style="color:#6366f1;">Settings → Payment Methods</a>
            </p>
          </div>
        `}

        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button id="qrMarkPaidBtn" style="
            padding:10px 20px;background:#6366f1;color:#fff;
            border:none;border-radius:10px;font-size:14px;font-weight:600;
            cursor:pointer;font-family:'DM Sans',sans-serif;
          ">✓ Mark as Paid (UPI)</button>
          <button id="qrCollectOnlineBtn" style="
            padding:10px 20px;background:rgba(99,102,241,0.15);color:#a5b4fc;
            border:1px solid rgba(99,102,241,0.3);border-radius:10px;font-size:14px;font-weight:600;
            cursor:pointer;font-family:'DM Sans',sans-serif;
          ">💳 Razorpay</button>
          <button id="qrCloseBtn" style="
            padding:10px 20px;background:rgba(255,255,255,0.05);color:#9ca3af;
            border:1px solid rgba(255,255,255,0.1);border-radius:10px;font-size:14px;
            cursor:pointer;font-family:'DM Sans',sans-serif;
          ">Close</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    /* Close */
    modal.querySelector("#qrCloseBtn").addEventListener("click", () => modal.remove());
    modal.addEventListener("click", (e) => { if (e.target === modal) modal.remove(); });

    /* Mark paid via UPI (manual confirm) */
    modal.querySelector("#qrMarkPaidBtn").addEventListener("click", async () => {
      const row = document.querySelector(`[data-invoice-id="${invoiceId}"]`);
      modal.remove();
      await markPaid(invoice, "UPI", row);
    });

    /* Razorpay online collect */
    modal.querySelector("#qrCollectOnlineBtn").addEventListener("click", () => {
      modal.remove();
      openRazorpayCheckout(invoice);
    });
  }

  /* ============================================================
     PDF GENERATION  (fully preserved from original)
     ============================================================ */
  async function downloadPDF(invoice) {

    const jspdfLib = window.jspdf || window.jsPDF;
    if (!jspdfLib?.jsPDF && typeof jsPDF === "undefined") {
      showToast("PDF library not loaded. Refresh and try again.", "error");
      return;
    }

    const biz = JSON.parse(localStorage.getItem("paytrack_business")) || {};
    const rawCur = invoiceSettings.currency || "Rs.";
    const cur = rawCur === "₹" ? "Rs." : rawCur === "€" ? "EUR " : rawCur === "$" ? "$ " : rawCur + " ";

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

    const fc  = (c) => doc.setFillColor(c[0], c[1], c[2]);
    const tc  = (c) => doc.setTextColor(c[0], c[1], c[2]);
    const dc  = (c) => doc.setDrawColor(c[0], c[1], c[2]);
    const lw  = (w) => doc.setLineWidth(w);
    const fn  = (sz, st = "normal") => { doc.setFontSize(sz); doc.setFont("helvetica", st); };

    const box   = (x, y, w, h, c)        => { fc(c); doc.rect(x, y, w, h, "F"); };
    const rbox  = (x, y, w, h, r, c)     => { fc(c); doc.roundedRect(x, y, w, h, r, r, "F"); };
    const stroke = (x, y, w, h, r, c, lwidth = 0.3) => {
      dc(c); lw(lwidth); doc.roundedRect(x, y, w, h, r, r, "S");
    };
    const hline = (y, c = RULE, weight = 0.25) => {
      dc(c); lw(weight); doc.line(ML, y, PW - MR, y);
    };
    const fmt = (n) => {
      const num = Number(n || 0);
      const parts = num.toFixed(2).split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
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

    box(0, 0, PW, PH, WHITE);

    /* ── HEADER ── */
    box(0, 0, PW, 56, INDIGO);
    fc(INDIGO_D);
    doc.triangle(PW - 70, 0, PW, 0, PW, 56, "F");

    let logoRight = ML;
    if (biz.logo) {
      try {
        const LW = 36, LH = 36;
        const LY = (56 - LH) / 2;
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
    const pillBg  = isPaid ? GREEN : AMBER;
    fn(7.5, "bold");
    const pW = doc.getTextWidth(pillTxt) + 12;
    const pX = PW - MR - pW;
    rbox(pX, 38, pW, 7.5, 2.5, pillBg);
    tc(WHITE);
    doc.text(pillTxt, pX + pW / 2, 43.3, { align: "center" });

    /* ── META ROW ── */
    let Y = 70;

    fn(7, "bold"); tc(MUTED);
    doc.text("DATE ISSUED",  ML,      Y);
    doc.text("DUE DATE",     ML + 56, Y);

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
    const tableRows = (invoice.items || []).map((item, i) => [
      String(i + 1),
      item.name || "—",
      String(item.qty || 1),
      money(item.price || 0),
      money((item.price || 0) * (item.qty || 1)),
    ]);

    doc.autoTable({
      startY: Y,
      head:   [["#", "DESCRIPTION", "QTY", "RATE", "AMOUNT"]],
      body:   tableRows,
      theme:  "plain",
      styles: {
        font:        "helvetica",
        fontSize:    9,
        cellPadding: 5,
        lineColor:   RULE,
        lineWidth:   0.2,
        textColor:   BODY,
        overflow:    "linebreak",
      },
      headStyles: {
        fillColor:   IND_PALE,
        textColor:   INDIGO,
        fontStyle:   "bold",
        fontSize:    7.5,
        cellPadding: { top: 6, bottom: 6, left: 5, right: 5 },
        lineWidth:   { bottom: 0.6 },
        lineColor:   INDIGO,
      },
      columnStyles: {
        0: { cellWidth: 8,  halign: "center", textColor: MUTED },
        1: { cellWidth: "auto" },
        2: { cellWidth: 14, halign: "center" },
        3: { cellWidth: 42, halign: "right" },
        4: { cellWidth: 42, halign: "right", fontStyle: "bold", textColor: INK },
      },
      alternateRowStyles: { fillColor: BGLIGHT },
      bodyStyles:         { fillColor: WHITE },
      margin: { left: ML, right: MR },
    });

    Y = doc.lastAutoTable.finalY + 8;

    /* ── TOTALS ── */
    const subtotal = Number(invoice.subtotal || 0);
    const gstPct   = Number(invoice.gstPercent || 0);
    const gstAmt   = subtotal * gstPct / 100;
    const total    = Number(invoice.total || subtotal + gstAmt);

    const TW = 96, TX = PW - MR - TW;
    const rowsCount = gstPct > 0 ? 2 : 1;
    const cardH = rowsCount * 9 + 16;

    rbox(TX, Y, TW, cardH, 3, BGLIGHT);
    stroke(TX, Y, TW, cardH, 3, RULE);

    fn(8.5, "normal"); tc(MUTED);
    doc.text("Subtotal", TX + 6, Y + 8);
    tc(BODY);
    doc.text(money(subtotal), PW - MR - 4, Y + 8, { align: "right" });

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

    /* ── PAYMENT DETAILS (from settings) ── */
    const hasPayDets =
      (payments.upi && payments.upiId) ||
      (payments.bank && payments.bankDetails);

    if (hasPayDets) {
      fn(7.5, "bold"); tc(MUTED);
      doc.text("PAYMENT DETAILS", ML, Y);
      hline(Y + 3, RULE, 0.3);
      Y += 9;

      fn(8.5, "normal");
      if (payments.upi && payments.upiId) {
        tc(MUTED);  doc.text("UPI ID:", ML, Y);
        tc(BODY);   doc.text(payments.upiId, ML + 20, Y);
        Y += 6;
      }
      if (payments.bank && payments.bankDetails) {
        tc(MUTED);  doc.text("Bank:", ML, Y);
        tc(BODY);
        const bl = doc.splitTextToSize(payments.bankDetails, CW - 22);
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
        const SY = stampY;

        dc(RULE); lw(0.4);
        doc.setLineDash([2.5, 1.5]);
        doc.roundedRect(SX - 5, SY - 4, SW + 10, SH + 18, 3, 3, "S");
        doc.setLineDash([]);

        doc.addImage(biz.stamp, "PNG", SX, SY, SW, SH);

        fn(7, "normal"); tc(MUTED);
        doc.text("Authorized Signature", SX + SW / 2, SY + SH + 6, { align: "center" });

        fn(7.5, "bold"); tc(INK);
        doc.text((biz.name || "").toUpperCase(), SX + SW / 2, SY + SH + 12, { align: "center" });
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

    /* ── DOWNLOAD ── */
    try {
      const fileName = `${invoiceDisplayId}.pdf`;
      const blob     = doc.output("blob");
      const blobUrl  = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl; link.download = fileName; link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      showToast(`PDF downloaded: ${fileName}`);

      return new Promise(resolve => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });

    } catch (err) {
      console.error("PDF download error:", err);
      showToast("PDF download failed. Check console.", "error");
      return null;
    }
  }

  /* ============================================================
     RAZORPAY CHECKOUT
     ============================================================ */
  async function openRazorpayCheckout(invoice) {
    showToast("Creating payment order…", "info");

    let orderData;
    try {
      const res = await Payments.createOrder(invoice.invoiceId || invoice.id);
      if (!res.success) throw new Error(res.message);
      orderData = res.data;
    } catch (err) {
      showToast("Could not create payment order: " + err.message, "error");
      return;
    }

    if (!window.Razorpay) {
      await new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://checkout.razorpay.com/v1/checkout.js";
        s.onload = resolve;
        s.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
        document.head.appendChild(s);
      });
    }

    const invoiceDisplayId = invoice.invoiceId || invoice.id;

    const options = {
      key:         orderData.keyId,
      amount:      orderData.amount,
      currency:    orderData.currency || "INR",
      name:        JSON.parse(localStorage.getItem("paytrack_business") || "{}").name || "PayTrack",
      description: `Invoice ${invoiceDisplayId}`,
      order_id:    orderData.orderId,
      prefill: {
        name:  orderData.clientName  || "",
        email: orderData.clientEmail || "",
      },
      theme: { color: "#6366f1" },

      handler: async function (response) {
        showToast("Verifying payment…", "info");
        try {
          const verifyRes = await Payments.verify({
            razorpayOrderId:   response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
            invoiceId:         invoiceDisplayId,
          });
          if (!verifyRes.success) throw new Error(verifyRes.message);

          showToast(`Payment confirmed! Invoice ${invoiceDisplayId} marked as Paid.`);
          if (invoice.clientEmail) showToast("Receipt emailed to client ✓");
          await loadInvoices();

        } catch (err) {
          showToast("Payment verification failed: " + err.message, "error");
        }
      },

      modal: {
        ondismiss: () => showToast("Payment cancelled.", "info"),
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  /* ============================================================
     SEND INVOICE EMAIL  (Cash — manual)
     ============================================================ */
  async function sendInvoiceEmail(invoice, btn) {
    if (!invoice.clientEmail) {
      showToast("No client email on this invoice.", "error");
      return;
    }

    const originalText  = btn.textContent;
    btn.disabled        = true;
    btn.textContent     = "Sending…";

    try {
      /* Send just the invoiceId — backend builds the email from stored data.
         Never send pdfBase64 over the wire (causes Vercel timeout). */
      const invoiceDisplayId = invoice.invoiceId || invoice.id;
      const res = await Payments.sendInvoice(invoiceDisplayId, null);
      if (!res || !res.success) throw new Error(res?.message || "Send failed");

      showToast(`Invoice emailed to ${invoice.clientEmail} ✓`);
      await loadInvoices();

    } catch (err) {
      showToast("Failed to send email: " + err.message, "error");
    } finally {
      btn.disabled    = false;
      btn.textContent = originalText;
    }
  }

  /* ============================================================
     MARK PAID (Cash / Bank — manual dropdown)
     ============================================================ */
  async function markPaid(invoice, method, row) {
    try {
      const invoiceDisplayId = invoice.invoiceId || invoice.id;
      await Invoices.markPaid(invoiceDisplayId, method);

      /* Instant UI update */
      if (row) {
        const statusSpan = row.querySelector(".status");
        if (statusSpan) {
          statusSpan.className   = "status paid";
          statusSpan.textContent = "PAID";
        }

        const actionsCell = row.querySelector(".actions");
        if (actionsCell) {
          actionsCell.innerHTML = buildPaidActions(
            { ...invoice, status: "paid", paymentMethod: method },
            false
          );
          attachPaidActions(actionsCell, { ...invoice, status: "paid", paymentMethod: method });
        }

        const pmCell = row.querySelector(".payment-method");
        if (pmCell) {
          pmCell.innerHTML = `<span style="color:var(--success);font-weight:600;">${method}</span>`;
        }
      }

      const idx = allInvoices.findIndex(i => (i.invoiceId || i.id) === (invoice.invoiceId || invoice.id));
      if (idx !== -1) {
        allInvoices[idx].status        = "paid";
        allInvoices[idx].paymentMethod = method;
        allInvoices[idx].paidAt        = new Date().toISOString();
      }

      showToast(`Invoice marked as paid via ${method}`);

    } catch (err) {
      showToast("Failed to mark paid: " + err.message, "error");
    }
  }

  /* ============================================================
     DELETE INVOICE
     ============================================================ */
  async function deleteInvoice(invoice, row) {
    const invoiceDisplayId = invoice.invoiceId || invoice.id;
    if (!confirm(`Delete invoice ${invoiceDisplayId}? This cannot be undone.`)) return;

    try {
      await Invoices.delete(invoiceDisplayId);
      row.remove();
      allInvoices = allInvoices.filter(i => (i.invoiceId || i.id) !== invoiceDisplayId);
      showToast(`Invoice ${invoiceDisplayId} deleted`);

      const badge = document.getElementById("invoiceCountBadge");
      if (badge) {
        const count = document.querySelectorAll("#invoiceList .invoice-row").length;
        badge.textContent = `${count} invoice${count !== 1 ? "s" : ""}`;
      }
    } catch (err) {
      showToast("Failed to delete: " + err.message, "error");
    }
  }

  /* ============================================================
     BUILD ACTIONS HTML
     ============================================================ */
  function buildPendingActions(invoice) {
    const invoiceDisplayId = invoice.invoiceId || invoice.id;
    const manualOpts = [];
    if (payments.cash) manualOpts.push("Cash");
    if (payments.bank) manualOpts.push("Bank");
    const hasUpi = payments.upi;

    let html = "";

    if (manualOpts.length) {
      html += `<select class="payment-select" data-id="${invoiceDisplayId}">
        <option value="">Mark Paid</option>
        ${manualOpts.map(p => `<option value="${p}">${p}</option>`).join("")}
      </select>`;
    }

    if (hasUpi) {
      html += `<button class="btn-small primary collect-btn" data-id="${invoiceDisplayId}">
        📱 UPI / Pay
      </button>`;
    }

    html += `<button class="btn-small primary pdf-btn" data-id="${invoiceDisplayId}">📄 PDF</button>`;
    html += `<button class="btn-small danger delete-btn" data-id="${invoiceDisplayId}">🗑</button>`;

    return html;
  }

  function buildPaidActions(invoice, emailSent) {
    const invoiceDisplayId = invoice.invoiceId || invoice.id;
    let html = "";

    if (invoice.clientEmail && invoice.paymentMethod !== "Online") {
      const label = emailSent ? "✓ Sent" : "📧 Send";
      html += `<button class="btn-small ${emailSent ? "" : "primary"} send-btn"
                data-id="${invoiceDisplayId}"
                ${emailSent ? "disabled title='Invoice already sent'" : ""}>
                ${label}
              </button>`;
    }

    html += `<button class="btn-small primary pdf-btn" data-id="${invoiceDisplayId}">📄 PDF</button>`;
    html += `<button class="btn-small danger delete-btn" data-id="${invoiceDisplayId}">🗑</button>`;

    return html;
  }

  function attachPaidActions(actionsCell, invoice) {
    actionsCell.querySelector(".send-btn")?.addEventListener("click", (e) => {
      sendInvoiceEmail(invoice, e.currentTarget);
    });
    actionsCell.querySelector(".pdf-btn")?.addEventListener("click", () => {
      showToast("Generating PDF…", "info");
      setTimeout(() => downloadPDF(invoice), 150);
    });
    actionsCell.querySelector(".delete-btn")?.addEventListener("click", () => {
      const row = actionsCell.closest(".invoice-row");
      deleteInvoice(invoice, row);
    });
  }

  /* ============================================================
     RENDER INVOICES
     ============================================================ */
  function renderInvoices(list) {
    const invoices = list || allInvoices;
    invoiceList.innerHTML = "";

    if (!invoices.length) {
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
      /* data attribute for QR modal row lookup */
      row.dataset.invoiceId = invoice.invoiceId || invoice.id || "";

      const invoiceDisplayId = invoice.invoiceId || invoice.id || "—";
      const isPaid           = invoice.status === "paid";
      const emailSent        = invoice.emailSentToClient || false;

      row.innerHTML = `
        <span class="invoice-id">${invoiceDisplayId}</span>
        <span class="invoice-client">${invoice.clientName || "—"}</span>
        <span class="invoice-amount">
          ${invoiceSettings.currency}${Number(invoice.total || 0)
            .toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}
        </span>
        <span>
          <span class="status ${invoice.status}">
            ${invoice.status.toUpperCase()}
          </span>
        </span>
        <span class="payment-method">
          ${invoice.paymentMethod
            ? `<span style="color:var(--success);font-weight:600;">${invoice.paymentMethod}</span>`
            : `<span style="color:var(--text-muted)">—</span>`}
        </span>
        <span class="actions">
          ${isPaid
            ? buildPaidActions(invoice, emailSent)
            : buildPendingActions(invoice)}
        </span>`;

      /* ── Wire up action buttons ── */
      const actionsCell = row.querySelector(".actions");

      if (!isPaid) {
        /* Manual mark-paid dropdown */
        actionsCell.querySelector(".payment-select")?.addEventListener("change", (e) => {
          if (!e.target.value) return;
          markPaid(invoice, e.target.value, row);
        });

        /* UPI QR + collect button */
        actionsCell.querySelector(".collect-btn")?.addEventListener("click", () => {
          showUpiQrModal(invoice);
        });

        /* PDF */
        actionsCell.querySelector(".pdf-btn")?.addEventListener("click", () => {
          showToast("Generating PDF…", "info");
          setTimeout(() => downloadPDF(invoice), 150);
        });

        /* Delete */
        actionsCell.querySelector(".delete-btn")?.addEventListener("click", () => {
          deleteInvoice(invoice, row);
        });
      } else {
        attachPaidActions(actionsCell, invoice);
      }

      invoiceList.appendChild(row);
    });
  }

  /* ============================================================
     LOAD INVOICES FROM API
     ============================================================ */
  async function loadInvoices() {
    try {
      const res = await Invoices.getAll();
      allInvoices = res.data || [];

      localStorage.setItem("paytrack_invoices", JSON.stringify(
        allInvoices.map(inv => ({ ...inv, id: inv.invoiceId }))
      ));

      renderInvoices();
    } catch (err) {
      console.error("Failed to load invoices:", err);
      showToast("Could not load invoices. Please refresh.", "error");
    }
  }

  /* ── Theme ── */
  if (settings.appearance?.theme === "dark") document.body.classList.add("dark");

  /* ── Init ── */
  await loadInvoices();

});
