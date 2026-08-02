/**
 * Cruising Cove — Curated 10 marketplace shops.
 * Up to 10 featured shops. Add approved partners to SHOPS (max 10).
 * shop shape: { id, name, shopUrl, description, photoUrls: string[] }
 */
window.CC_MAX_SHOPS = 10;
window.CC_SHOPS = [
  // Example when filled:
  // {
  //   id: "example-shop",
  //   name: "Example Shop",
  //   shopUrl: "https://example.com/shop",
  //   description: "Two to three sentences for the directory card.",
  //   photoUrls: ["https://..."]
  // }
];

window.CC_openShopSlots = function () {
  return Math.max(0, (window.CC_MAX_SHOPS || 10) - (window.CC_SHOPS || []).length);
};
