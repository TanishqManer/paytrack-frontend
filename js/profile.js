/* ============================================================
   PayTrack — Profile Logic  (js/profile.js)
   Requires js/api.js to be loaded first
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

  /* ---------- AUTH GUARD ---------- */
  if (!localStorage.getItem("paytrack_token")) {
    window.location.href = "login.html";
    return;
  }

  /* ---------- ELEMENTS ---------- */
  const emailInput        = document.getElementById("profileEmail");
  const darkToggle        = document.getElementById("darkModeToggle");
  const changePasswordBtn = document.getElementById("changePasswordBtn");
  const passwordSuccess   = document.getElementById("passwordSuccess");
  const avatarEl          = document.getElementById("profileAvatarLarge");
  const displayName       = document.getElementById("profileDisplayName");
  const displayEmail      = document.getElementById("profileDisplayEmail");
  const logoutBtn         = document.getElementById("logoutBtn");

  /* ---------- LOAD USER ---------- */
  const userEmail = localStorage.getItem("paytrack_user") || "";
  const userName  = localStorage.getItem("paytrack_user_name") || "";

  if (emailInput && userEmail) emailInput.value = userEmail;

  if (avatarEl)     avatarEl.textContent     = (userName || userEmail).charAt(0).toUpperCase();
  if (displayName)  displayName.textContent  = userName || userEmail.split("@")[0];
  if (displayEmail) displayEmail.textContent = userEmail;

  /* ---------- DARK MODE ---------- */
  if (darkToggle) {
    const theme = localStorage.getItem("paytrack_theme");
    if (theme === "dark" || (!theme && true)) {
      document.body.classList.add("dark");
      darkToggle.checked = true;
    }

    darkToggle.addEventListener("change", () => {
      document.body.classList.toggle("dark");
      localStorage.setItem(
        "paytrack_theme",
        document.body.classList.contains("dark") ? "dark" : "light"
      );
    });
  }

  /* ---------- CHANGE PASSWORD ---------- */
  if (changePasswordBtn) {
    changePasswordBtn.addEventListener("click", async () => {
      const currentPass = document.getElementById("currentPassword")?.value?.trim() || "";
      const newPass     = document.getElementById("newPassword")?.value?.trim()     || "";
      const confirmPass = document.getElementById("confirmPassword")?.value?.trim() || "";

      if (!newPass) {
        showProfileToast("Please enter a new password.", "error"); return;
      }
      if (newPass.length < 6) {
        showProfileToast("Password must be at least 6 characters.", "error"); return;
      }
      if (newPass !== confirmPass) {
        showProfileToast("Passwords do not match.", "error"); return;
      }

      const origText = changePasswordBtn.textContent;
      changePasswordBtn.disabled    = true;
      changePasswordBtn.textContent = "Updating…";

      try {
        await window.PayTrackAPI.Auth.changePassword(currentPass, newPass);

        if (passwordSuccess) {
          passwordSuccess.style.display = "block";
          setTimeout(() => passwordSuccess.style.display = "none", 3000);
        }

        /* Clear fields */
        const cpEl = document.getElementById("currentPassword");
        const npEl = document.getElementById("newPassword");
        const cfEl = document.getElementById("confirmPassword");
        if (cpEl) cpEl.value = "";
        if (npEl) npEl.value = "";
        if (cfEl) cfEl.value = "";

        showProfileToast("Password updated successfully ✓", "success");
      } catch (err) {
        showProfileToast(err.message || "Failed to update password.", "error");
      } finally {
        changePasswordBtn.disabled    = false;
        changePasswordBtn.textContent = origText;
      }
    });
  }

  /* ---------- LOGOUT ---------- */
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      window.PayTrackAPI.Auth.logout();
    });
  }

  /* ---------- TOAST ---------- */
  function showProfileToast(msg, type = "success") {
    document.querySelectorAll(".profile-toast").forEach(t => t.remove());
    const t = document.createElement("div");
    t.className = "profile-toast toast";
    t.style.borderLeftColor = type === "error" ? "var(--danger)" : "var(--success)";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
});
