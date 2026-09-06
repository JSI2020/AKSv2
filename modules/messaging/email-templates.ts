/**
 * Branded transactional email templates for AKS Atelier.
 *
 * Email clients strip <style>, ignore web fonts, and only reliably render
 * table layouts with inline styles — so these are hand-built that way, with a
 * serif fallback stack (Cormorant is aspirational; Georgia is what most inboxes
 * actually show).
 */

const INK = "#22283a";
const TAUPE = "#8d7e66";
const MUTED = "#565e72";
const GOLD = "#b0894c";
const GROUND = "#f1ece1";
const CARD = "#faf7f0";
const CODE_BG = "#f1ece1";
const LINE = "#e4ddcd";

const SERIF =
  "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS =
  "'Jost', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

/**
 * One-time verification code email — used for both first-time signup and
 * returning sign-in, so the copy stays neutral ("verification code").
 */
export function verificationCodeEmail(code: string): RenderedEmail {
  const spaced = code.split("").join(" "); // hair-spaces for legibility

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${GROUND};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:${CARD};border:1px solid ${LINE};border-radius:2px;">
          <tr>
            <td style="padding:40px 44px 8px;text-align:center;">
              <div style="font-family:${SERIF};font-size:24px;font-weight:500;letter-spacing:.28em;color:${INK};">
                AKS<span style="color:${GOLD};">&#183;</span>ATELIER
              </div>
              <div style="font-family:${SANS};font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:${TAUPE};margin-top:6px;">
                Minimalist luxury &#183; East meets West
              </div>
            </td>
          </tr>
          <tr><td style="padding:0 44px;"><div style="height:1px;background:${LINE};margin:24px 0 4px;"></div></td></tr>
          <tr>
            <td style="padding:20px 44px 0;">
              <div style="font-family:${SANS};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${TAUPE};">
                Verification code
              </div>
              <p style="font-family:${SERIF};font-size:22px;line-height:1.4;color:${INK};margin:12px 0 0;font-weight:400;">
                Use this code to continue to your AKS Atelier account.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 44px 8px;">
              <div style="background:${CODE_BG};border:1px solid ${LINE};border-radius:2px;padding:22px 0;text-align:center;font-family:${SERIF};font-size:38px;font-weight:500;letter-spacing:.18em;color:${INK};">
                ${spaced}
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:6px 44px 40px;">
              <p style="font-family:${SANS};font-size:13px;line-height:1.7;color:${MUTED};margin:12px 0 0;">
                This code expires in 24 hours. Enter it on the page where you asked to sign in.
              </p>
              <p style="font-family:${SANS};font-size:13px;line-height:1.7;color:${MUTED};margin:10px 0 0;">
                Didn&rsquo;t request this? You can safely ignore this email &mdash; no one can sign in without the code.
              </p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;">
          <tr>
            <td style="padding:20px 44px;text-align:center;">
              <div style="font-family:${SANS};font-size:11px;letter-spacing:.04em;color:${TAUPE};line-height:1.6;">
                AKS Atelier &#183; Ready-to-wear, cut to standard sizes<br>
                This is an automated message from a send-only address.
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = [
    "AKS ATELIER",
    "",
    "Verification code",
    "",
    `    ${code}`,
    "",
    "Use this code to continue to your AKS Atelier account.",
    "It expires in 24 hours.",
    "",
    "Didn't request this? You can safely ignore this email — no one can sign in without the code.",
    "",
    "AKS Atelier · Ready-to-wear, cut to standard sizes",
  ].join("\n");

  return {
    subject: `Your AKS Atelier verification code: ${code}`,
    html,
    text,
  };
}
