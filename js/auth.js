/* ============================================================
   PayTrack — Frontend Auth  (js/auth.js)
   Handles login + register form submissions
   Works with login.html and register.html
   Depends on js/api.js being loaded first
   ============================================================ */

/* ---------- TOAST ---------- */
function showAuthToast(msg, type = "error") {
  document.querySelectorAll(".auth-toast").forEach(t => t.remove());

  const t = document.createElement("div");
  t.className = "auth-toast";
  t.style.cssText = `
    position: fixed;
    bottom: 28px;
    right: 28px;
    background: #13131f;
    border: 1px solid ${type === "error" ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"};
    border-left: 3px solid ${type === "error" ? "#ef4444" : "#10b981"};
    border-radius: 14px;
    padding: 14px 20px;
    font-size: 14px;
    font-family: 'DM Sans', sans-serif;
    color: ${type === "error" ? "#fca5a5" : "#6ee7b7"};
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    z-index: 9999;
    display: flex;
    align-items: center;
    gap: 10px;
    min-width: 260px;
    max-width: 360px;
  `;

  const icon = document.createElement("span");
  icon.style.cssText = `
    width:24px;height:24px;border-radius:50%;flex-shrink:0;
    background:${type === "error" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)"};
    display:flex;align-items:center;justify-content:center;
    font-size:12px;font-weight:700;`;
  icon.textContent = type === "error" ? "✕" : "✓";

  const text = document.createElement("span");
  text.textContent = msg;
  t.appendChild(icon);
  t.appendChild(text);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/* ---------- SET BUTTON LOADING STATE ---------- */
function setLoading(btn, loading, originalText) {
  btn.disabled = loading;
  btn.textContent = loading ? "Please wait…" : originalText;
}

/* ============================================================
   LOGIN FORM
   ============================================================ */
const loginForm = document.getElementById("loginForm");
if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email    = document.getElementById("email")?.value.trim()    || "";
    const password = document.getElementById("password")?.value.trim() || "";
    const btn      = loginForm.querySelector("button[type='submit']")
                  || loginForm.querySelector(".btn-primary")
                  || loginForm.querySelector("button");

    if (!email || !password) {
      showAuthToast("Email and password are required.");
      return;
    }

    const origText = btn?.textContent || "Sign In";
    if (btn) setLoading(btn, true, origText);

    try {
      await window.PayTrackAPI.Auth.login(email, password);
      /* api.js login() saves token + redirects to dashboard-v2.html */
    } catch (err) {
      showAuthToast(err.message || "Login failed. Please try again.");
      if (btn) setLoading(btn, false, origText);
    }
  });
}

/* ============================================================
   REGISTER FORM
   ============================================================ */
const registerForm = document.getElementById("registerForm");
if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name     = document.getElementById("name")?.value.trim()            || "";
    const email    = document.getElementById("email")?.value.trim()           || "";
    const password = document.getElementById("password")?.value.trim()        || "";
    const confirm  = document.getElementById("confirmPassword")?.value.trim() || "";
    const btn      = registerForm.querySelector("button[type='submit']")
                  || registerForm.querySelector(".btn-primary")
                  || registerForm.querySelector("button");

    /* Validation */
    if (!name) {
      showAuthToast("Full name is required.");
      return;
    }
    if (!email) {
      showAuthToast("Email address is required.");
      return;
    }
    if (!password || password.length < 6) {
      showAuthToast("Password must be at least 6 characters.");
      return;
    }
    if (confirm && password !== confirm) {
      showAuthToast("Passwords do not match.");
      return;
    }

    const origText = btn?.textContent || "Create Account";
    if (btn) setLoading(btn, true, origText);

    try {
      await window.PayTrackAPI.Auth.register(name, email, password);
      /* api.js register() saves token + redirects to dashboard-v2.html */
    } catch (err) {
      showAuthToast(err.message || "Registration failed. Please try again.");
      if (btn) setLoading(btn, false, origText);
    }
  });
}

/* ============================================================
   LOGOUT BUTTON (any page)
   ============================================================ */
const logoutBtn = document.getElementById("logoutBtn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    window.PayTrackAPI.Auth.logout();
  });
}