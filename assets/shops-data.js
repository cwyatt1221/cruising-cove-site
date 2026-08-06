/**
 * Cruising Cove — Curated 10 marketplace shops.
 * Up to 10 featured shops. Add approved partners to SHOPS (max 10).
 * shop shape: { id, name, shopUrl, description, photoUrls: string[] }
 */
window.CC_MAX_SHOPS = 10;
window.CC_SHOPS = [
  {
    id: "bels-castle-creations",
    name: "Bels Castle Creations",
    shopUrl: "https://belscastlecreations.etsy.com/",
    description:
      "At Bels Castle Creations, we create custom Disney cruise door magnets, fish extender gifts, cabin décor, and personalized keepsakes designed to make every sailing extra special. From one-of-a-kind family door decorations to thoughtful cruise gifts and celebration décor, our handcrafted designs help you make unforgettable memories from embarkation day to disembarkation.",
    photoUrls: [
      "https://cruisingcovelogs.blob.core.windows.net/seller-photos/05cfe01c-b107-4bd2-844a-bb7101431e9c.jpg?sv=2026-06-06&spr=https&se=2036-08-06T00%3A38%3A41Z&sr=b&sp=r&sig=4b87vOZOu2cJd92jVcywl2lbJbq7GGO4yej%2FGHWBL7I%3D",
      "https://cruisingcovelogs.blob.core.windows.net/seller-photos/7ff34f23-20d7-47e2-a831-45d2b4d10abb.jpg?sv=2026-06-06&spr=https&se=2036-08-06T00%3A38%3A43Z&sr=b&sp=r&sig=iQi9O1QW%2FGpUUbEJLuvOpSK4NlHpkWKyTUYmydD%2FudI%3D",
      "https://cruisingcovelogs.blob.core.windows.net/seller-photos/9bbea3fd-b355-4285-ac35-ef5779b5c77c.jpg?sv=2026-06-06&spr=https&se=2036-08-06T00%3A38%3A44Z&sr=b&sp=r&sig=6WLu88PYaZy%2Fy7kIiqvPv48NHgH2IXnpHQ%2FP7wXKw04%3D",
      "https://cruisingcovelogs.blob.core.windows.net/seller-photos/f474ae77-caf4-4016-9e2d-5819ca68c01a.jpg?sv=2026-06-06&spr=https&se=2036-08-06T00%3A38%3A45Z&sr=b&sp=r&sig=9S1nxl5G7GGD%2B4jPaB9MxlsbcXNG6T4TlwVhisZ46OI%3D",
    ],
  },
];

window.CC_openShopSlots = function () {
  return Math.max(0, (window.CC_MAX_SHOPS || 10) - (window.CC_SHOPS || []).length);
};
