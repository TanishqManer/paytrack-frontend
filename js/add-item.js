/* ============================================================
   PayTrack — Add Item  (js/add-item.js)
   Requires js/api.js loaded first.
   All rendering happens AFTER API responds — no race conditions.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ---------- AUTH GUARD ---------- */
  if (!localStorage.getItem("paytrack_token")) {
    window.location.href = "login.html";
    return;
  }

  /* ---------- ELEMENTS ---------- */
  const form        = document.getElementById("addItemForm");
  const nameInput   = document.getElementById("itemName");
  const descInput   = document.getElementById("itemDescription");
  const priceInput  = document.getElementById("itemPrice");
  const fileInput   = document.getElementById("itemImageFile");
  const urlInput    = document.getElementById("itemImageUrl");
  const itemsList   = document.getElementById("itemsList");
  const countEl     = document.getElementById("itemsCount");
  const saveBtn     = document.getElementById("saveItemBtn")
                   || form?.querySelector("[type='submit']");

  /* ---------- IN-MEMORY STORE ---------- */
  let allItems = [];

  /* ---------- CURRENCY ---------- */
  function getCurrency() {
    const s = JSON.parse(localStorage.getItem("paytrack_settings") || "{}");
    return s.invoice?.currency || "₹";
  }

  /* ---------- TOAST ---------- */
  function showToast(msg, type = "success") {
    document.querySelectorAll(".ai-toast").forEach(t => t.remove());
    const t = document.createElement("div");
    t.className = "ai-toast toast";
    t.style.cssText = `
      position:fixed;bottom:28px;right:28px;
      background:var(--bg-card,#13131f);
      border:1px solid ${type === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"};
      border-left:3px solid ${type === "error" ? "#ef4444" : "#10b981"};
      border-radius:14px;padding:14px 20px;
      font-size:14px;font-family:'DM Sans',sans-serif;
      color:${type === "error" ? "#fca5a5" : "#6ee7b7"};
      box-shadow:0 20px 60px rgba(0,0,0,0.5);
      z-index:9999;display:flex;align-items:center;gap:10px;
      min-width:240px;max-width:340px;
    `;
    const icon = document.createElement("span");
    icon.style.cssText = `
      width:22px;height:22px;border-radius:50%;flex-shrink:0;
      background:${type === "error" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)"};
      color:${type === "error" ? "#ef4444" : "#10b981"};
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

  /* ---------- UPDATE COUNT BADGE ---------- */
  function updateCount() {
    if (countEl) {
      const n = allItems.length;
      countEl.textContent = `${n} item${n !== 1 ? "s" : ""}`;
    }
  }

  /* ---------- SYNC LOCALSTORAGE ---------- */
  function syncCache() {
    localStorage.setItem("paytrack_items", JSON.stringify(
      allItems.map(item => ({
        id:          item._id || item.id,
        name:        item.name,
        price:       item.price,
        description: item.description || "",
        image:       item.imageUrl || item.image || "",
        createdAt:   item.createdAt,
      }))
    ));
  }

  /* ---------- RENDER ITEMS LIST ---------- */
  function renderItems() {
    if (!itemsList) return;
    itemsList.innerHTML = "";
    updateCount();

    if (allItems.length === 0) {
      itemsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📦</div>
          <p>No items yet.<br>Add your first product or service above.</p>
        </div>`;
      return;
    }

    const cur = getCurrency();

    allItems.forEach(item => {
      const imageUrl = item.imageUrl || item.image || "";
      const itemId   = item._id || item.id;

      const card = document.createElement("div");
      card.className = "item-card";
      card.innerHTML = `
        <div class="item-image">
          ${imageUrl
            ? `<img src="${imageUrl}" alt="${item.name}"
                style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
            : `<span style="font-size:28px;">📦</span>`}
        </div>
        <div class="item-body">
          <h4 style="margin:0 0 4px;font-size:15px;">${item.name}</h4>
          ${item.description
            ? `<p style="margin:0 0 6px;font-size:12px;color:var(--text-muted,#9ca3af);">${item.description}</p>`
            : ""}
          <div style="font-size:16px;font-weight:700;color:var(--accent,#6366f1);">
            ${cur}${Number(item.price).toFixed(2)}
          </div>
        </div>
        <div class="item-actions">
          <button class="btn-secondary" data-id="${itemId}"
            style="padding:6px 14px;font-size:13px;">
            🗑 Delete
          </button>
        </div>`;

      card.querySelector("[data-id]").addEventListener("click", () => deleteItem(itemId, item.name));
      itemsList.appendChild(card);
    });
  }

  /* ---------- DELETE ---------- */
  async function deleteItem(id, name) {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await window.PayTrackAPI.Items.delete(id);
      allItems = allItems.filter(i => (i._id || i.id) !== id);
      syncCache();
      renderItems();
      showToast("Item deleted");
    } catch (err) {
      showToast("Failed to delete: " + err.message, "error");
    }
  }

  /* ---------- LOAD FROM API ---------- */
  async function loadItems() {
    if (itemsList) {
      itemsList.innerHTML = `
        <div class="empty-state">
          <p style="color:var(--text-muted,#9ca3af);">Loading items…</p>
        </div>`;
    }
    try {
      const res = await window.PayTrackAPI.Items.getAll();
      allItems  = res.data || [];
      syncCache();
      renderItems();
    } catch (err) {
      console.error("Failed to load items:", err);
      const cached = JSON.parse(localStorage.getItem("paytrack_items") || "[]");
      allItems = cached.map(i => ({ ...i, imageUrl: i.imageUrl || i.image || "" }));
      renderItems();
    }
  }

  /* ---------- SAVE ITEM ---------- */
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      e.stopImmediatePropagation(); /* block any other submit listeners */

      const name        = nameInput?.value.trim()  || "";
      const description = descInput?.value.trim()  || "";
      const price       = Number(priceInput?.value  || 0);
      const imageFile   = fileInput?.files?.[0]     || null;
      const imageUrl    = (!imageFile && urlInput?.value.trim()) ? urlInput.value.trim() : "";

      if (!name) {
        showToast("Item name is required.", "error");
        nameInput?.focus();
        return;
      }
      if (!price || price <= 0) {
        showToast("A valid price is required.", "error");
        priceInput?.focus();
        return;
      }

      if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = "Saving…"; }

      try {
        const res  = await window.PayTrackAPI.Items.create(
          { name, description, price, imageUrl },
          imageFile || null
        );
        const item = res.data;

        /* Add to top of list */
        allItems.unshift(item);
        syncCache();
        renderItems();

        /* Reset form */
        form.reset();

        /* Scroll list into view */
        itemsList?.scrollIntoView({ behavior: "smooth", block: "nearest" });

        showToast(`"${item.name}" saved ✓`);

      } catch (err) {
        console.error("Save item error:", err);
        showToast(err.message || "Failed to save item.", "error");
      } finally {
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = "Save Item"; }
      }
    });
  }

  /* ---------- INIT ---------- */
  loadItems();

});
