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
   OTP OVERLAY — shown after register form submit
   ============================================================ */
function showOtpOverlay(email, name, onVerified) {
  /* Remove any existing overlay */
  document.getElementById("otpOverlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "otpOverlay";
  overlay.style.cssText = `
    position:fixed;inset:0;background:rgba(0,0,0,0.7);
    display:flex;align-items:center;justify-content:center;
    z-index:99999;backdrop-filter:blur(4px);
  `;

  overlay.innerHTML = `
    <div style="
      background:#13131f;border:1px solid rgba(99,102,241,0.3);
      border-radius:20px;padding:40px;width:100%;max-width:400px;
      box-shadow:0 40px 100px rgba(0,0,0,0.6);
      font-family:'DM Sans',sans-serif;
    ">
      <div style="text-align:center;margin-bottom:28px;">
        <div style="
          width:56px;height:56px;border-radius:50%;
          background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);
          display:flex;align-items:center;justify-content:center;
          font-size:24px;margin:0 auto 16px;
        ">📧</div>
        <h2 style="margin:0 0 8px;color:#fff;font-size:22px;font-weight:800;letter-spacing:-0.02em;">
          Check your email
        </h2>
        <p style="margin:0;color:#9ca3af;font-size:14px;line-height:1.6;">
          We sent a 6-digit code to<br>
          <strong style="color:#a5b4fc;">${email}</strong>
        </p>
      </div>

      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:24px;" id="otpInputs">
        ${[0,1,2,3,4,5].map(i => `
          <input
            type="text" maxlength="1" inputmode="numeric"
            data-idx="${i}"
            style="
              width:48px;height:56px;text-align:center;
              background:#1a1a2e;border:1.5px solid rgba(99,102,241,0.3);
              border-radius:10px;color:#fff;font-size:22px;font-weight:700;
              outline:none;transition:border-color 0.2s;
              font-family:'DM Sans',sans-serif;
            "
          />
        `).join("")}
      </div>

      <div id="otpError" style="
        color:#fca5a5;font-size:13px;text-align:center;
        margin-bottom:16px;min-height:20px;
      "></div>

      <button id="otpVerifyBtn" style="
        width:100%;padding:14px;background:#6366f1;color:#fff;
        border:none;border-radius:12px;font-size:15px;font-weight:600;
        cursor:pointer;transition:background 0.2s;margin-bottom:16px;
        font-family:'DM Sans',sans-serif;
      ">Verify Code</button>

      <div style="text-align:center;">
        <button id="otpResendBtn" style="
          background:none;border:none;color:#6366f1;font-size:13px;
          cursor:pointer;font-family:'DM Sans',sans-serif;
        ">Resend code</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  /* Auto-focus first input */
  const inputs = overlay.querySelectorAll("input[data-idx]");
  inputs[0]?.focus();

  /* Auto-advance on input */
  inputs.forEach((input, i) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val;
      if (val && i < 5) inputs[i + 1].focus();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && i > 0) {
        inputs[i - 1].focus();
      }
    });

    /* Style on focus */
    input.addEventListener("focus", () => {
      input.style.borderColor = "#6366f1";
      input.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.2)";
    });
    input.addEventListener("blur", () => {
      input.style.borderColor = "rgba(99,102,241,0.3)";
      input.style.boxShadow = "none";
    });
  });

  /* Paste support — paste all 6 digits at once */
  inputs[0].addEventListener("paste", (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "");
    pasted.split("").slice(0, 6).forEach((ch, i) => {
      if (inputs[i]) inputs[i].value = ch;
    });
    inputs[Math.min(pasted.length, 5)].focus();
  });

  /* Collect OTP value */
  function getOtp() {
    return Array.from(inputs).map(i => i.value).join("");
  }

  /* Verify button */
  const verifyBtn = overlay.querySelector("#otpVerifyBtn");
  const errorEl   = overlay.querySelector("#otpError");

  async function doVerify() {
    const otp = getOtp();
    if (otp.length < 6) {
      errorEl.textContent = "Please enter the full 6-digit code.";
      return;
    }

    verifyBtn.disabled    = true;
    verifyBtn.textContent = "Verifying…";
    errorEl.textContent   = "";

    try {
      const data = await window.PayTrackAPI.Auth.verifyOtp(email, otp, name);
      overlay.remove();
      onVerified(data);
    } catch (err) {
      errorEl.textContent   = err.message || "Invalid OTP. Please try again.";
      verifyBtn.disabled    = false;
      verifyBtn.textContent = "Verify Code";
      /* Shake animation */
      inputs.forEach(i => {
        i.style.borderColor = "#ef4444";
        setTimeout(() => i.style.borderColor = "rgba(99,102,241,0.3)", 1000);
      });
    }
  }

  verifyBtn.addEventListener("click", doVerify);

  /* Enter key on any input triggers verify */
  inputs.forEach(i => i.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doVerify();
  }));

  /* Resend button */
  overlay.querySelector("#otpResendBtn").addEventListener("click", async () => {
    try {
      await window.PayTrackAPI.Auth.requestOtp(email);
      showAuthToast("New OTP sent to " + email, "success");
    } catch (err) {
      showAuthToast("Failed to resend OTP.", "error");
    }
  });
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
      window.location.href = "dashboard-v2.html";
    } catch (err) {
      showAuthToast(err.message || "Login failed. Please try again.");
      if (btn) setLoading(btn, false, origText);
    }
  });
}

/* ============================================================
   REGISTER FORM — OTP flow
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
    if (!name) { showAuthToast("Full name is required."); return; }
    if (!email) { showAuthToast("Email address is required."); return; }
    if (!password || password.length < 6) {
      showAuthToast("Password must be at least 6 characters."); return;
    }
    if (confirm && password !== confirm) {
      showAuthToast("Passwords do not match."); return;
    }

    const origText = btn?.textContent || "Create Account";
    if (btn) setLoading(btn, true, origText);

    try {
      /* Step 1: Request OTP */
      await window.PayTrackAPI.Auth.requestOtp(email, name);
      if (btn) setLoading(btn, false, origText);

      /* Step 2: Show OTP overlay */
      /* verifyOtp already creates the user + saves token — just redirect */
      showOtpOverlay(email, name, async () => {
        window.location.href = "dashboard-v2.html";
      });

    } catch (err) {
      showAuthToast(err.message || "Failed to send OTP. Please try again.");
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
