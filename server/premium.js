// server/premium.js
// Stub za buduću billing logiku (Stripe / Google Play)

module.exports = {
  async verifyPurchase(payload) {
    // Ovdje će jednog dana ići provjera Google Play / Stripe
    // Trenutno samo vraća "ok: false" kao placeholder.
    return { ok: false, reason: "not-implemented" };
  },
};

