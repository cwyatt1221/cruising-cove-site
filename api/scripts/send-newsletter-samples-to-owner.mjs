/**
 * Send [SAMPLE] themed Welcome Aboard / Welcome to the Cove emails for every
 * active NewsletterSignups person to the owner inbox (never to subscribers).
 *
 * Usage from api/:
 *   RESEND_API_KEY=... RESEND_FROM_EMAIL=... node scripts/send-newsletter-samples-to-owner.mjs
 */
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const {
  buildNewsletterWelcomeEmail,
  resolveNewsletterWelcomeTheme,
} = require("../dist/src/lib/welcomeAboard.js");
const { sendEmailResult } = require("../dist/src/lib/email.js");

const OWNER = "cgrove0712@gmail.com";
const SITE = "https://www.cruisingcove.com";

const SIGNUPS = [
  {
    email: "belebers814@gmail.com",
    name: "Bridget Lebers",
    embarkationDate: "2026-10-16",
    shipLabel: "Disney Dream",
    shipSlug: "disney-dream",
  },
  {
    email: "laurajones940@hotmail.com",
    name: "Laura Daniel",
    embarkationDate: "2026-12-26",
    shipLabel: "Disney Treasure",
    shipSlug: "disney-treasure",
  },
  {
    email: "martina@magicmomtravel.com",
    name: "Martina Yost",
    embarkationDate: "",
    shipLabel: "",
    shipSlug: "",
  },
  {
    email: "nicujenni@gmail.com",
    name: "J Klick",
    embarkationDate: "2026-10-24",
    shipLabel: "Disney Destiny",
    shipSlug: "disney-destiny",
  },
  {
    email: "you@example.com",
    name: "Test",
    embarkationDate: "2026-10-16",
    shipLabel: "Disney Wish",
    shipSlug: "disney-wish",
  },
];

const unsubUrl = `${SITE}/newsletter/unsubscribe.html`;
const results = [];

for (const signup of SIGNUPS) {
  const theme = resolveNewsletterWelcomeTheme(signup.shipSlug, signup.embarkationDate);
  const content = buildNewsletterWelcomeEmail({
    name: signup.name,
    shipSlug: signup.shipSlug,
    shipLabel: signup.shipLabel,
    embarkationDate: signup.embarkationDate,
    unsubUrl,
  });

  const subject = `[SAMPLE · ${signup.name} · ${theme}] ${content.subject}`;
  const banner = `<div style="background:#F4E9D8;padding:10px 16px;font-family:Arial,sans-serif;font-size:12px;color:#0B2545;border-bottom:1px solid #E0D6C2;">
    <strong>SAMPLE ONLY</strong> — would go to ${signup.email} (${signup.name})${
      signup.shipLabel && signup.embarkationDate
        ? ` · ${signup.shipLabel} · ${signup.embarkationDate} · theme=${theme}`
        : ` · Welcome to the Cove · theme=${theme}`
    }. Not sent to the subscriber.
  </div>`;
  const html = banner + content.html;
  const text = `SAMPLE ONLY — would go to ${signup.email} (${signup.name}) · theme=${theme}\n\n${content.text}`;

  const result = await sendEmailResult(OWNER, subject, html, text);
  results.push({
    name: signup.name,
    email: signup.email,
    theme,
    ok: result.ok,
    detail: result.ok ? "sent" : result.reason,
  });
  console.log(signup.name, theme, result.ok ? "OK" : result.reason);
  await new Promise((r) => setTimeout(r, 400));
}

console.log(JSON.stringify(results, null, 2));
