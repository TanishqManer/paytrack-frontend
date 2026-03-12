document.addEventListener("DOMContentLoaded", () => {

  /* ---------- AUTH GUARD ---------- */
  if (!localStorage.getItem("paytrack_token")) {
    window.location.href = "login.html";
    return;
  }

  /* ---------- ELEMENTS ---------- */
  const emailInput = document.getElementById("profileEmail");
  const darkToggle = document.getElementById("darkModeToggle");
  const changePasswordBtn = document.getElementById("changePasswordBtn");

  /* ---------- LOAD USER ---------- */
  const userEmail = localStorage.getItem("paytrack_user");
  if (emailInput && userEmail) {
    emailInput.value = userEmail;
  }

  /* ---------- DARK MODE ---------- */
  if (darkToggle) {
    if (localStorage.getItem("paytrack_theme") === "dark") {
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
    changePasswordBtn.addEventListener("click", () => {
      const newPass = document.getElementById("newPassword")?.value;
      const confirmPass = document.getElementById("confirmPassword")?.value;

      if (!newPass || newPass !== confirmPass) {
        alert("Passwords do not match");
        return;
      }

      alert("Password updated (backend will handle this later)");
    });
  }

});
