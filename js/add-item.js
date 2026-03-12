/* =====================================
   PayTrack – Add Item Logic (Ecommerce View)
   ===================================== */

/* ---------- AUTH GUARD ---------- */
(function authGuard() {
  const token = localStorage.getItem("paytrack_token");
  if (!token) {
    window.location.href = "login.html";
  }
})();

/* ---------- ELEMENTS ---------- */
const form = document.getElementById("addItemForm");
const nameInput = document.getElementById("itemName");
const descInput = document.getElementById("itemDescription");
const priceInput = document.getElementById("itemPrice");
const fileInput = document.getElementById("itemImageFile");
const urlInput = document.getElementById("itemImageUrl");
const itemsList = document.getElementById("itemsList");

/* ---------- STORAGE ---------- */
function getItems() {
  return JSON.parse(localStorage.getItem("paytrack_items")) || [];
}

function saveItems(items) {
  localStorage.setItem("paytrack_items", JSON.stringify(items));
}

/* ---------- IMAGE FILE ---------- */
function readImageFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ---------- RENDER ITEMS (GRID) ---------- */
function renderItems() {
  const items = getItems();
  itemsList.innerHTML = "";

  if (items.length === 0) {
    itemsList.innerHTML = `<p class="muted">No items added yet.</p>`;
    return;
  }

  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "item-card";

    card.innerHTML = `
      <div class="item-image">
        ${
          item.image
            ? `<img src="${item.image}" alt="${item.name}">`
            : `<span class="muted small">No Image</span>`
        }
      </div>

      <div class="item-body">
        <h4>${item.name}</h4>
        <div class="item-price">₹${item.price}</div>
      </div>

      <div class="item-actions">
        <button class="btn-secondary" data-id="${item.id}">
          🗑 Delete
        </button>
      </div>
    `;

    itemsList.appendChild(card);
  });

  document.querySelectorAll("[data-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      deleteItem(Number(btn.dataset.id));
    });
  });
}

/* ---------- DELETE ---------- */
function deleteItem(id) {
  if (!confirm("Delete this item permanently?")) return;
  const items = getItems().filter(item => item.id !== id);
  saveItems(items);
  renderItems();
}

/* ---------- SUBMIT ---------- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = nameInput.value.trim();
  const description = descInput.value.trim();
  const price = Number(priceInput.value);
  let image = "";

  if (!name || !price) {
    alert("Item name and price are required");
    return;
  }

  if (fileInput.files.length > 0) {
    image = await readImageFile(fileInput.files[0]);
  } else if (urlInput.value.trim()) {
    image = urlInput.value.trim();
  }

  const items = getItems();
  items.push({
    id: Date.now(),
    name,
    description,
    price,
    image,
    createdAt: new Date().toISOString()
  });

  saveItems(items);
  form.reset();
  renderItems();
});

/* ---------- INIT ---------- */
renderItems();
