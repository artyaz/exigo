import { mutation } from "./_generated/server";

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("plans").collect();
    if (existing.length > 0) {
      throw new Error("Plans already seeded. Delete existing plans first.");
    }

    const plans = [
      {
        name: "Free",
        slug: "free",
        priceIdSandbox: undefined,
        priceIdLive: undefined,
        accessLevel: 0,
        perks: [
          { text: "3 spaces" },
          { text: "20 knowledge pieces / space" },
          { text: "10 AI tests / month" },
        ],
        basePrice: 0,
      },
      {
        name: "Pro Scholar",
        slug: "pro-monthly",
        priceIdSandbox: process.env.PADDLE_PRICE_PRO_MONTHLY ?? "",
        priceIdLive: process.env.PADDLE_PRICE_PRO_MONTHLY_LIVE ?? "",
        accessLevel: 1,
        perks: [
          { text: "Unlimited spaces" },
          { text: "200 knowledge pieces / space" },
          { text: "100 AI tests / month" },
          { text: "Deep dive analysis", link: "/knowledge-nodes" },
        ],
        basePrice: 900,
      },
      {
        name: "Pro Scholar",
        slug: "pro-annual",
        priceIdSandbox: process.env.PADDLE_PRICE_PRO_ANNUAL ?? "",
        priceIdLive: process.env.PADDLE_PRICE_PRO_ANNUAL_LIVE ?? "",
        accessLevel: 1,
        perks: [
          { text: "Unlimited spaces" },
          { text: "200 knowledge pieces / space" },
          { text: "100 AI tests / month" },
          { text: "Deep dive analysis", link: "/knowledge-nodes" },
        ],
        basePrice: 7500,
      },
      {
        name: "Educator",
        slug: "educator-monthly",
        priceIdSandbox: process.env.PADDLE_PRICE_EDUCATOR_MONTHLY ?? "",
        priceIdLive: process.env.PADDLE_PRICE_EDUCATOR_MONTHLY_LIVE ?? "",
        accessLevel: 2,
        perks: [
          { text: "Unlimited spaces" },
          { text: "Unlimited knowledge pieces" },
          { text: "300 AI tests / month" },
          { text: "Deep dive analysis", link: "/knowledge-nodes" },
        ],
        basePrice: 1900,
      },
      {
        name: "Educator",
        slug: "educator-annual",
        priceIdSandbox: process.env.PADDLE_PRICE_EDUCATOR_ANNUAL ?? "",
        priceIdLive: process.env.PADDLE_PRICE_EDUCATOR_ANNUAL_LIVE ?? "",
        accessLevel: 2,
        perks: [
          { text: "Unlimited spaces" },
          { text: "Unlimited knowledge pieces" },
          { text: "300 AI tests / month" },
          { text: "Deep dive analysis", link: "/knowledge-nodes" },
        ],
        basePrice: 19200,
      },
    ];

    for (const plan of plans) {
      await ctx.db.insert("plans", plan);
    }

    return { seeded: plans.length };
  },
});
