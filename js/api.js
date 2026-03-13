/* ============================================================
   PayTrack — API Utility  (js/api.js)
   Load this FIRST on every page before any other JS file.
   ============================================================ */

const API_BASE = "https://paytrack-backend-sigma.vercel.app/api";

/* ════════════════════════════════════════
   TOKEN / USER HELPERS
   ════════════════════════════════════════ */
const getToken = () => localStorage.getItem("paytrack_token");
const saveToken = (token) => localStorage.setItem("paytrack_token", token);
const saveUser  = (user) => {
  localStorage.setItem("paytrack_user",      user.email || "");
  localStorage.setItem("paytrack_user_id",   user.id || user._id || "");
  localStorage.setItem("paytrack_user_name", user.name  || "");
};
const clearAuth = () => {
  ["paytrack_token","paytrack_user","paytrack_user_id","paytrack_user_name"]
    .forEach(k => localStorage.removeItem(k));
};

/* ════════════════════════════════════════
   CORE FETCH — JSON requests
   ════════════════════════════════════════ */
async function apiFetch(path, options = {}) {
  const token = getToken();

  /* Never set Content-Type for FormData — browser adds boundary automatically */
  const isFormData = options.body instanceof FormData;

  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers || {}),
  };

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method:  options.method || "GET",
      headers,
      body: isFormData
        ? options.body
        : (options.body ? JSON.stringify(options.body) : undefined),
    });
  } catch (networkErr) {
    throw new Error("Network error — please check your connection.");
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("Invalid response from server.");
  }

  if (!res.ok) {
    if (res.status === 401) {
      clearAuth();
      window.location.href = "login.html";
      return;
    }
    throw new Error(data.message || `API error (${res.status})`);
  }

  return data;
}

/* ════════════════════════════════════════
   AUTH
   ════════════════════════════════════════ */
const Auth = {
  async register(name, email, password) {
    const data = await apiFetch("/auth/register", {
      method: "POST",
      body:   { name, email, password },
    });
    saveToken(data.token);
    saveUser(data.user);
    return data;
  },

  async login(email, password) {
    const data = await apiFetch("/auth/login", {
      method: "POST",
      body:   { email, password },
    });
    saveToken(data.token);
    saveUser(data.user);
    window.location.href = "dashboard-v2.html";
    return data;
  },

  async requestOtp(email, name) {
    return apiFetch("/auth/otp/request", {
      method: "POST",
      body:   { email, name: name || "" },
    });
  },

  async verifyOtp(email, otp, name, password = "") {
    const data = await apiFetch("/auth/otp/verify", {
      method: "POST",
      body:   { email, otp, name: name || "", password: password || "" },
    });
    if (data.token) {
      saveToken(data.token);
      saveUser(data.user);
    }
    return data;
  },

  async changePassword(currentPassword, newPassword) {
    return apiFetch("/auth/change-password", {
      method: "POST",
      body:   { currentPassword, newPassword },
    });
  },

  logout() {
    clearAuth();
    window.location.href = "login.html";
  },

  isLoggedIn()  { return !!getToken(); },
  getEmail()    { return localStorage.getItem("paytrack_user")      || ""; },
  getName()     { return localStorage.getItem("paytrack_user_name") || ""; },
  getUserId()   { return localStorage.getItem("paytrack_user_id")   || ""; },
};

/* ════════════════════════════════════════
   INVOICES
   ════════════════════════════════════════ */
const Invoices = {
  getAll(status = "") {
    const qs = status ? `?status=${status}` : "";
    return apiFetch(`/invoices${qs}`);
  },
  getOne(id)   { return apiFetch(`/invoices/${id}`); },
  create(data) { return apiFetch("/invoices", { method: "POST", body: data }); },
  markPaid(id, paymentMethod) {
    return apiFetch(`/invoices/${id}`, {
      method: "PATCH",
      body:   { status: "paid", paymentMethod },
    });
  },
  savePdfUrl(id, pdfUrl) {
    return apiFetch(`/invoices/${id}`, { method: "PATCH", body: { pdfUrl } });
  },
  delete(id) { return apiFetch(`/invoices/${id}`, { method: "DELETE" }); },
};

/* ════════════════════════════════════════
   ITEMS
   ════════════════════════════════════════ */
const Items = {
  getAll() { return apiFetch("/items"); },

  create(itemData, imageFile = null) {
    if (imageFile) {
      /* Multipart — browser sets Content-Type with boundary automatically */
      const fd = new FormData();
      fd.append("name",        itemData.name);
      fd.append("description", itemData.description || "");
      fd.append("price",       String(itemData.price));
      fd.append("image",       imageFile);
      return apiFetch("/items", { method: "POST", body: fd });
    }
    /* Plain JSON — no file */
    return apiFetch("/items", { method: "POST", body: itemData });
  },

  delete(id) { return apiFetch(`/items/${id}`, { method: "DELETE" }); },
};

/* ════════════════════════════════════════
   BUSINESS
   ════════════════════════════════════════ */
const Business = {
  get() { return apiFetch("/business"); },

  save(bizData, logoFile = null, stampFile = null) {
    if (logoFile || stampFile) {
      /* Multipart — browser sets Content-Type with boundary automatically */
      const fd = new FormData();
      fd.append("name",    bizData.name);
      fd.append("address", bizData.address || "");
      fd.append("email",   bizData.email   || "");
      fd.append("phone",   bizData.phone   || "");
      if (logoFile)  fd.append("logo",  logoFile);
      if (stampFile) fd.append("stamp", stampFile);
      return apiFetch("/business", { method: "POST", body: fd });
    }
    /* Plain JSON — no files */
    return apiFetch("/business", { method: "POST", body: bizData });
  },
};

/* ════════════════════════════════════════
   SETTINGS
   ════════════════════════════════════════ */
const Settings = {
  get()          { return apiFetch("/settings"); },
  save(data)     { return apiFetch("/settings", { method: "POST", body: data }); },
};

/* ════════════════════════════════════════
   CLIENTS
   ════════════════════════════════════════ */
const Clients = {
  getAll() { return apiFetch("/clients"); },
};

/* ════════════════════════════════════════
   PAYMENTS
   ════════════════════════════════════════ */
const Payments = {
  createOrder(invoiceId) {
    return apiFetch("/payments/create-order", { method: "POST", body: { invoiceId } });
  },
  verify(data) {
    return apiFetch("/payments/verify", { method: "POST", body: data });
  },
  sendInvoice(invoiceId, pdfBase64 = null) {
    return apiFetch("/payments/send-invoice", { method: "POST", body: { invoiceId, pdfBase64 } });
  },
};

/* ════════════════════════════════════════
   EXPORT
   ════════════════════════════════════════ */
window.PayTrackAPI = {
  _base: API_BASE,
  Auth, Invoices, Items, Business, Settings, Clients, Payments,
};
