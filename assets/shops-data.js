/**
 * Cruising Cove — Curated 10 marketplace shops.
 * Up to 10 featured shops. Add approved partners to SHOPS (max 10).
 * shop shape: { id, name, shopUrl, description, photoUrls, categories?, socialProofQuotes?, visitCount? }
 */
window.CC_MAX_SHOPS = 10;
window.CC_SHOPS = [
  {
    id: "shimmering-ever-after",
    name: "Shimmering Ever After",
    shopUrl: "https://www.etsy.com/shop/shimmeringeverafter",
    description:
      "Hiya Pals! Come check out our shop over on Etsy, Shimmering Ever After for all your magical needs. We specialize in sparkly sequin mouse ears and embroidered apparel. It’s the perfect touch for any trip.",
    categories: ["Apparel", "Mouse Ears"],
    socialProofQuotes: [
      {
        quote:
          "Asked the seller one week prior to my unexpected Disney trip if she can get it to me on time. She told me about the rush order and worked her magic and within two days it was on its way to me. Not only did it come on time but the quality is top notch. I got so many compliments! Will purchase from this seller again! 11/10",
      },
    ],
    visitCount: 0,
    photoUrls: [
      "https://cruisingcovelogs.blob.core.windows.net/seller-photos/05c0c047-e24b-470b-989e-3c94f0eaef26.jpg?sv=2026-06-06&spr=https&se=2036-08-10T20%3A27%3A23Z&sr=b&sp=r&sig=8LTP7wJalaz0%2F0NqKCWoXu0pdM2lglzqGiXUUbEYiYQ%3D",
    ],
  },
  {
    id: "bels-castle-creations",
    name: "Bels Castle Creations",
    shopUrl: "https://belscastlecreations.etsy.com/",
    description:
      "At Bels Castle Creations, we create custom Disney cruise door magnets, fish extender gifts, cabin décor, and personalized keepsakes designed to make every sailing extra special. From one-of-a-kind family door decorations to thoughtful cruise gifts and celebration décor, our handcrafted designs help you make unforgettable memories from embarkation day to disembarkation.",
    categories: [
      "Door magnets",
      "Fish extender gifts",
      "Cabin décor",
      "Personalized keepsakes",
      "Celebration / birthday",
    ],
    socialProofQuotes: [
      {
        quote: "Our door magnets made embarkation day feel magical — and the fish extender gifts were a hit with the whole sailing.",
        name: "Sarah",
      },
    ],
    visitCount: 0,
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
