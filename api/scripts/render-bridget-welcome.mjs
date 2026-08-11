/**
 * Local sample: Bridget Lebers themed Welcome Aboard (Dream · 2026-10-16 · Halloween).
 * Usage from api/: node scripts/render-bridget-welcome.mjs
 * Optional: RESEND_API_KEY + SEND_SAMPLE=1 to email OWNER.
 */
import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { buildWelcomeAboardEmail, resolveWelcomeTheme } = require("../dist/src/lib/welcomeAboard.js");
const { sendEmailResult } = require("../dist/src/lib/email.js");

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../out");
mkdirSync(outDir, { recursive: true });

const theme = resolveWelcomeTheme("disney-dream", "2026-10-16");
const email = buildWelcomeAboardEmail({
  name: "Bridget Lebers",
  shipSlug: "disney-dream",
  shipLabel: "Disney Dream",
  embarkationDate: "2026-10-16",
  unsubUrl: "https://www.cruisingcove.com/newsletter/unsubscribe.html",
});

const htmlPath = join(outDir, "bridget-welcome-sample.html");
const textPath = join(outDir, "bridget-welcome-sample.txt");
writeFileSync(htmlPath, email.html, "utf8");
writeFileSync(textPath, `THEME: ${theme}\nSUBJECT: ${email.subject}\n\n${email.text}`, "utf8");
console.log("Theme:", theme);
console.log("Wrote", htmlPath);
console.log("Subject:", email.subject);

if (process.env.SEND_SAMPLE === "1") {
  const to =
    process.env.NEWSLETTER_NOTIFY_EMAIL ||
    process.env.AGENT_LEAD_NOTIFY_EMAIL ||
    "cgrove0712@gmail.com";
  const result = await sendEmailResult(
    to,
    `[SAMPLE] ${email.subject}`,
    email.html,
    email.text
  );
  console.log("Send to", to, result);
} else {
  console.log("Set SEND_SAMPLE=1 to email the owner sample via Resend.");
}
