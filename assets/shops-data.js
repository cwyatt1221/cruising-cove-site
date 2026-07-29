/**
 * Cruising Cove — Curated 10 marketplace shops.
 * Up to 10 featured Etsy shops. Add approved partners to SHOPS (max 10).
 * shop shape: { id, name, etsyUrl, description, photoUrls: string[] }
 */
window.CC_MAX_SHOPS = 10;
window.CC_SHOPS = [
  // Example when filled:
  // {
  //   id: "example-shop",
  //   name: "Example Shop",
  //   etsyUrl: "https://www.etsy.com/shop/Example",
  //   description: "Two to three sentences for the directory card.",
  //   photoUrls: ["https://..."]
  // }
];

window.CC_openShopSlots = function () {
  return Math.max(0, (window.CC_MAX_SHOPS || 10) - (window.CC_SHOPS || []).length);
};
