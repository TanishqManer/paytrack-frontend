/* ============================================================
   PayTrack — Add Item Logic  (js/add-item.js)
   - Items loaded from MongoDB via API (no localStorage)
   - Image files uploaded to Cloudinary via API multipart
   - Image URL still supported as fallback
   - Delete calls API then removes from list
   - localStorage kept in sync for create-invoice page
   - All original UI card logic preserved
   ============================================================ */

/* ---------- AUTH GUARD ---------- */
(function authGuard() {
  if (!localStorage.getItem("paytrack_token")) {
    window.location.href = "login.html";
  }
})();

/* ---------- WAIT FOR API ---------- */
/* add-item.html loads api.js before this file, but guard anyway */
function getAPI() {
  return window.PayTrackAPI;
}

/* ---------- ELEMENTS ---------- */
const form       = document.getElementById("addItemForm");
const nameInput  = document.getElementById("itemName");
const descInput  = document.getElementById("itemDescription");
const priceInput = document.getElementById("itemPrice");
const fileInput  = document.getElementById("itemImageFile");
const urlInput   = document.getElementById("itemImageUrl");
const itemsList  = document.getElementById("itemsList");

/* ---------- IN-MEMORY STORE ---------- */
/* Keeps a local copy so renderItems() is instant after mutations */
let allItems = [];

/* ---------- TOAST ---------- */
function showToast(msg, type = "success") {
  /* Re-use any existing toast function on the page (add-item.html
     injects one); otherwise create our own */
  if (typeof window.showToast === "function") {
    window.showToast(msg);
    return;
  }
  document.querySelectorAll(".ai-toast").forEach(t => t.remove());
  const t = document.createElement("div");
  t.className = "ai-toast toast";
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
  setTimeout(() => t.remove(), 2800);
}

/* ---------- SYNC LOCALSTORAGE ---------- */
/* create-invoice-v2.js falls back to localStorage if API is slow,
   so we keep it in sync after every mutation */
function syncLocalStorage() {
  localStorage.setItem(
    "paytrack_items",
    JSON.stringify(
      allItems.map(item => ({
        id:          item._id || item.id,
        name:        item.name,
        price:       item.price,
        description: item.description || "",
        image:       item.imageUrl    || item.image || "",
        createdAt:   item.createdAt,
      }))
    )
  );
}

/* ---------- RENDER ITEMS (GRID) ---------- */
/* Card structure fully preserved from original */
function renderItems() {
  if (!itemsList) return;
  itemsList.innerHTML = "";

  /* Update count badge wired in add-item.html */
  const countEl = document.getElementById("itemsCount");
  if (countEl) {
    countEl.textContent = `${allItems.length} item${allItems.length !== 1 ? "s" : ""}`;
  }

  if (allItems.length === 0) {
    itemsList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📦</div>
        <p>No items yet.<br>Add your first product or service above.</p>
      </div>`;
    return;
  }

  allItems.forEach(item => {
    /* Normalise field names — API uses imageUrl, legacy uses image */
    const imageUrl = item.imageUrl || item.image || "";
    const itemId   = item._id     || item.id;

    const card = document.createElement("div");
    card.className = "item-card";

    card.innerHTML = `
      <div class="item-image">
        ${imageUrl
          ? `<img src="${imageUrl}" alt="${item.name}">`
          : `<span class="muted small">No Image</span>`}
      </div>

      <div class="item-body">
        <h4>${item.name}</h4>
        ${item.description
          ? `<p class="item-desc muted">${item.description}</p>`
          : ""}
        <div class="item-price">
          ${JSON.parse(localStorage.getItem("paytrack_settings") || "{}").invoice?.currency || "₹"}${item.price}
        </div>
      </div>

      <div class="item-actions">
        <button class="btn-delete btn-secondary" data-id="${itemId}">
          🗑 Delete
        </button>
      </div>`;

    itemsList.appendChild(card);
  });

  /* Wire delete buttons */
  itemsList.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", () => deleteItem(btn.dataset.id, btn));
  });
}

/* ---------- LOAD ITEMS FROM API ---------- */
async function loadItems() {
  try {
    const { Items } = getAPI();
    const res = await Items.getAll();
    allItems  = res.data || [];
    syncLocalStorage();
    renderItems();
  } catch (err) {
    console.error("Failed to load items:", err);
    /* Fall back to localStorage so page still works */
    const cached = JSON.parse(localStorage.getItem("paytrack_items") || "[]");
    allItems = cached.map(item => ({
      ...item,
      imageUrl: item.imageUrl || item.image || "",
    }));
    renderItems();
  }
}

/* ---------- DELETE ---------- */
async function deleteItem(id, btn) {
  if (!confirm("Delete this item permanently?")) return;

  const originalText = btn?.textContent || "🗑 Delete";
  if (btn) { btn.disabled = true; btn.textContent = "Deleting…"; }

  try {
    const { Items } = getAPI();
    await Items.delete(id);

    /* Remove from local store and re-render */
    allItems = allItems.filter(item => (item._id || item.id) !== id);
    syncLocalStorage();
    renderItems();
    showToast("Item deleted");
  } catch (err) {
    showToast("Failed to delete: " + err.message, "error");
    if (btn) { btn.disabled = false; btn.textContent = originalText; }
  }
}

/* ---------- SUBMIT ---------- */
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name        = nameInput?.value.trim()  || "";
    const description = descInput?.value.trim()  || "";
    const price       = Number(priceInput?.value || 0);

    if (!name || !price) {
      showToast("Item name and price are required.", "error");
      return;
    }

    /* Determine image source:
       1. File upload  → send as multipart to Cloudinary via API
       2. URL input    → send as plain string, API stores as-is
       3. Neither      → no image                                 */
    const imageFile = fileInput?.files?.[0] || null;
    const imageUrl  = (!imageFile && urlInput?.value.trim()) ? urlInput.value.trim() : "";

    /* Loading state */
    const submitBtn = form.querySelector("[type='submit']");
    const origText  = submitBtn?.textContent || "Save Item";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

    try {
      const { Items } = getAPI();

      const itemData = { name, description, price, imageUrl };

      /* Items.create() handles multipart if imageFile is provided */
      const res  = await Items.create(itemData, imageFile || null);
      const item = res.data;

      /* Prepend to local store so it appears at the top */
      allItems.unshift(item);
      syncLocalStorage();
      renderItems();

      form.reset();
      showToast("Item saved successfully ✓");
    } catch (err) {
      showToast(err.message || "Failed to save item.", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
    }
  });
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadItems();
});