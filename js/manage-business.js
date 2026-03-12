/* ============================================================
   PayTrack — Manage Business Logic  (js/manage-business.js)
   Requires js/api.js to be loaded first
   ============================================================ */

document.addEventListener("DOMContentLoaded", async () => {

  /* ── Auth guard ── */
  if (!window.PayTrackAPI.Auth.isLoggedIn()) {
    location.href = "login.html"; return;
  }

  const { Business } = window.PayTrackAPI;

  /* ── Elements ── */
  const nameEl      = document.getElementById("businessName");
  const addressEl   = document.getElementById("businessAddress");
  const emailEl     = document.getElementById("businessEmail");
  const phoneEl     = document.getElementById("businessPhone");
  const logoInput   = document.getElementById("logoInput");
  const stampInput  = document.getElementById("stampInput");
  const logoCard    = document.getElementById("logoCard");
  const stampCard   = document.getElementById("stampCard");
  const logoPreview  = document.getElementById("logoPreview");
  const stampPreview = document.getElementById("stampPreview");
  const saveBtn     = document.getElementById("saveBtn");

  let logoFile  = null;
  let stampFile = null;
  let isSaved   = false;

  /* ── Load existing data from API ── */
  async function loadData() {
    try {
      const res = await Business.get();
      const biz = res.data || {};

      if (!biz.saved) return;

      isSaved = true;
      if (nameEl)    nameEl.value    = biz.name    || "";
      if (addressEl) addressEl.value = biz.address || "";
      if (emailEl)   emailEl.value   = biz.email   || "";
      if (phoneEl)   phoneEl.value   = biz.phone   || "";

      if (biz.logoUrl && logoPreview) {
        logoPreview.src = biz.logoUrl;
        logoCard?.classList.add("has-image");
      }

      if (biz.stampUrl && stampPreview) {
        stampPreview.src = biz.stampUrl;
        stampCard?.classList.add("has-image");
      }

      /* Cache for PDF generation */
      localStorage.setItem("paytrack_business", JSON.stringify({
        saved:   true,
        name:    biz.name,
        address: biz.address,
        email:   biz.email,
        phone:   biz.phone,
        logo:    biz.logoUrl,
        stamp:   biz.stampUrl,
      }));

      lockForm(true);
    } catch (err) {
      console.error("Failed to load business:", err);
    }
  }

  function lockForm(lock) {
    [nameEl, addressEl, emailEl, phoneEl].forEach(i => { if (i) i.disabled = lock; });
    if (saveBtn) saveBtn.textContent = lock ? "Update Details" : "Save Business Details";
  }

  /* ── File uploads ── */
  if (logoCard)  logoCard.onclick  = () => !isSaved && logoInput?.click();
  if (stampCard) stampCard.onclick = () => !isSaved && stampInput?.click();

  if (logoInput) {
    logoInput.onchange = () => {
      logoFile = logoInput.files[0];
      if (!logoFile) return;
      if (logoPreview) logoPreview.src = URL.createObjectURL(logoFile);
      logoCard?.classList.add("has-image");
    };
  }

  if (stampInput) {
    stampInput.onchange = () => {
      stampFile = stampInput.files[0];
      if (!stampFile) return;
      if (stampPreview) stampPreview.src = URL.createObjectURL(stampFile);
      stampCard?.classList.add("has-image");
    };
  }

  /* ── Save ── */
  if (saveBtn) {
    saveBtn.onclick = async () => {

      /* Toggle to edit mode */
      if (isSaved) {
        isSaved = false;
        lockForm(false);
        logoCard.onclick  = () => logoInput?.click();
        stampCard.onclick = () => stampInput?.click();
        return;
      }

      if (!nameEl?.value.trim()) {
        alert("Business name is required");
        return;
      }

      saveBtn.disabled    = true;
      saveBtn.textContent = "Saving...";

      try {
        const bizData = {
          name:    nameEl.value.trim(),
          address: addressEl?.value.trim() || "",
          email:   emailEl?.value.trim()   || "",
          phone:   phoneEl?.value.trim()   || "",
        };

        const res = await Business.save(bizData, logoFile, stampFile);
        const biz = res.data;

        /* Update cache for PDF generation */
        localStorage.setItem("paytrack_business", JSON.stringify({
          saved:   true,
          name:    biz.name,
          address: biz.address,
          email:   biz.email,
          phone:   biz.phone,
          logo:    biz.logoUrl,
          stamp:   biz.stampUrl,
        }));

        /* Update previews with Cloudinary URLs */
        if (biz.logoUrl  && logoPreview)  logoPreview.src  = biz.logoUrl;
        if (biz.stampUrl && stampPreview) stampPreview.src = biz.stampUrl;

        isSaved   = true;
        logoFile  = null;
        stampFile = null;
        lockForm(true);

      } catch (err) {
        alert("Failed to save: " + err.message);
      } finally {
        saveBtn.disabled = false;
      }
    };
  }

  await loadData();
});