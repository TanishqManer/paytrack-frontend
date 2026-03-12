/* ============================================================
   PayTrack — Add Item Logic  (js/add-item.js)
   - Items loaded from MongoDB via API
   - Image files uploaded to Cloudinary via API multipart
   - Image URL still supported as fallback
   - Delete calls API then removes from list
   - localStorage kept in sync for create-invoice page
   ============================================================ */

/* ---------- AUTH GUARD ---------- */
(function authGuard() {
  if (!localStorage.getItem("paytrack_token")) {
    window.location.href = "login.html";
  }
})();

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
let allItems = [];

/* ---------- TOAST ---------- */
function showItemToast(msg, type = "success") {
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

/* ---------- RENDER ITEMS ---------- */
function renderItems() {
  if (!itemsList) return;
  itemsList.innerHTML = "";

  /* Update count badge */
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
    const imageUrl = item.imageUrl || item.image || "";
    const itemId   = item._id     || item.id;

    const card = document.createElement("div");
    card.className = "item-card";

    card.innerHTML = `
      <div class="item-image">
        ${imageUrl
          ? `<img src="${imageUrl}" alt="${item.name}" style="width:100%;height:100%;object-fit:cover;border-radius:8px;">`
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
    /* Fall back to localStorage */
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

    allItems = allItems.filter(item => (item._id || item.id) !== id);
    syncLocalStorage();
    renderItems();
    showItemToast("Item deleted");
  } catch (err) {
    showItemToast("Failed to delete: " + err.message, "error");
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
      showItemToast("Item name and price are required.", "error");
      return;
    }

    const imageFile = fileInput?.files?.[0] || null;
    const imageUrl  = (!imageFile && urlInput?.value.trim()) ? urlInput.value.trim() : "";

    const submitBtn = form.querySelector("[type='submit']");
    const origText  = submitBtn?.textContent || "Save Item";
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = "Saving…"; }

    try {
      const { Items } = getAPI();
      const itemData = { name, description, price, imageUrl };

      const res  = await Items.create(itemData, imageFile || null);
      const item = res.data;

      /* Prepend to local store so it appears at the top */
      allItems.unshift(item);
      syncLocalStorage();
      renderItems();

      form.reset();
      showItemToast("Item saved successfully ✓");

      /* Scroll to items list so user sees the new item */
      itemsList?.scrollIntoView({ behavior: "smooth", block: "start" });

    } catch (err) {
      showItemToast(err.message || "Failed to save item.", "error");
    } finally {
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
    }
  });
}

/* ---------- INIT ---------- */
document.addEventListener("DOMContentLoaded", () => {
  loadItems();
});
