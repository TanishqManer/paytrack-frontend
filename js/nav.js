/* ============================================================
   PayTrack — Shared Nav Logic  (js/nav.js)
   Handles avatar menu, business branding, and logout
   on ALL pages. Load after api.js.
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  /* ── Avatar letter ── */
  const avatar      = document.getElementById("avatarBtn");
  const profileMenu = document.getElementById("profileMenu");
  const emailEl     = document.getElementById("profileEmailDisplay");
  const userEmail   = localStorage.getItem("paytrack_user") || "";

  if (avatar && userEmail)  avatar.textContent  = userEmail.charAt(0).toUpperCase();
  if (emailEl && userEmail) emailEl.textContent = userEmail;

  /* ── Profile menu toggle ── */
  if (avatar && profileMenu) {
    avatar.addEventListener("click", (e) => {
      e.stopPropagation();
      profileMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      if (!profileMenu.contains(e.target) && !avatar.contains(e.target)) {
        profileMenu.classList.add("hidden");
      }
    });
  }

  /* ── Menu item actions ── */
  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = btn.dataset.action;

      if (action === "profile")         location.href = "profile.html";
      if (action === "settings")        location.href = "settings.html";
      if (action === "manage-business") location.href = "manage-business.html";
      if (action === "logout") {
        localStorage.clear();
        location.href = "login.html";
      }

      profileMenu?.classList.add("hidden");
    });
  });

  /* ── Business branding in header ── */
  const businessWrap = document.getElementById("businessBrandWrap");
  const businessLogo = document.getElementById("businessLogoHeader");
  const businessName = document.getElementById("businessNameHeader");

  /* Apply from cache instantly */
  const cached = localStorage.getItem("paytrack_business");
  if (cached) {
    try {
      const biz = JSON.parse(cached);
      applyBranding(biz);
    } catch (_) {}
  }

  /* Then fetch fresh from API */
  if (window.PayTrackAPI && localStorage.getItem("paytrack_token")) {
    window.PayTrackAPI.Business.get()
      .then(res => {
        const biz = res?.data || {};
        if (biz.saved) {
          const bizData = {
            saved:   true,
            name:    biz.name,
            address: biz.address,
            email:   biz.email,
            phone:   biz.phone,
            logo:    biz.logoUrl,
            stamp:   biz.stampUrl,
          };
          localStorage.setItem("paytrack_business", JSON.stringify(bizData));
          applyBranding(bizData);
        }
      })
      .catch(() => {});
  }

  function applyBranding(biz) {
    if (!biz?.saved) {
      businessWrap?.classList.add("hidden");
      return;
    }
    businessWrap?.classList.remove("hidden");
    if (businessName) businessName.textContent = biz.name || "";
    if (businessLogo && biz.logo) {
      businessLogo.src = biz.logo;
      businessLogo.style.display = "block";
    } else if (businessLogo) {
      businessLogo.style.display = "none";
    }
  }

  window.addEventListener("focus", () => {
    const c = localStorage.getItem("paytrack_business");
    if (c) try { applyBranding(JSON.parse(c)); } catch (_) {}
  });

});