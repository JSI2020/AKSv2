/**
 * Branded transactional email templates for AKS Atelier.
 *
 * Email clients strip <style>, ignore web fonts, and only reliably render
 * table layouts with inline styles — so these are hand-built that way, with a
 * serif fallback stack (Cormorant is aspirational; Georgia is what most inboxes
 * actually show). The AKS logo is referenced by absolute URL; images are often
 * blocked by default, so a typographic wordmark sits alongside it as a fallback.
 */

const INK = "#22283a";
const TAUPE = "#8d7e66";
const MUTED = "#565e72";
const GOLD = "#b0894c";
const GROUND = "#f1ece1";
const CARD = "#faf7f0";
const CODE_BG = "#f1ece1";
const LINE = "#e4ddcd";

const SERIF = "'Cormorant Garamond', Georgia, 'Times New Roman', serif";
const SANS =
  "'Jost', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    "https://aks-atelier.com"
  );
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Logo lockup: image (blocked → alt text) over a typographic wordmark + tagline. */
function headerBlock(): string {
  const logo = `${siteBase()}/brand/aks-logo.png`;
  return `
          <tr>
            <td style="padding:38px 44px 6px;text-align:center;">
              <img src="${logo}" width="150" alt="AKS Atelier"
                   style="display:block;margin:0 auto 6px;width:150px;max-width:60%;height:auto;border:0;outline:none;text-decoration:none;">
              <div style="font-family:${SERIF};font-size:20px;font-weight:500;letter-spacing:.28em;color:${INK};">
                AKS<span style="color:${GOLD};">&#183;</span>ATELIER
              </div>
              <div style="font-family:${SANS};font-size:9px;letter-spacing:.24em;text-transform:uppercase;color:${TAUPE};margin-top:6px;">
                Ready to wear &#183; cut by hand
              </div>
            </td>
          </tr>
          <tr><td style="padding:0 44px;"><div style="height:1px;background:${LINE};margin:22px 0 4px;"></div></td></tr>`;
}

function footerBlock(): string {
  return `
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;">
          <tr>
            <td style="padding:20px 44px;text-align:center;">
              <div style="font-family:${SANS};font-size:11px;letter-spacing:.04em;color:${TAUPE};line-height:1.7;">
                AKS Atelier &#183; Ready to wear, cut to standard sizes<br>
                Questions? Reply on WhatsApp and we&rsquo;ll help.<br>
                This is an automated message from a send-only address.
              </div>
            </td>
          </tr>
        </table>`;
}

/** Full outer shell around a block of inner <tr> rows. */
function shell(innerRows: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:${GROUND};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${GROUND};">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="width:520px;max-width:100%;background:${CARD};border:1px solid ${LINE};border-radius:2px;">
${headerBlock()}
${innerRows}
        </table>
${footerBlock()}
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function eyebrowRow(text: string): string {
  return `
          <tr>
            <td style="padding:20px 44px 0;">
              <div style="font-family:${SANS};font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:${TAUPE};">
                ${esc(text)}
              </div>`;
}

function headingHtml(text: string): string {
  return `
              <p style="font-family:${SERIF};font-size:24px;line-height:1.35;color:${INK};margin:12px 0 0;font-weight:400;">
                ${esc(text)}
              </p>
            </td>
          </tr>`;
}

function paragraphsRows(lines: string[]): string {
  if (lines.length === 0) return "";
  const ps = lines
    .filter((l) => l.trim())
    .map(
      (l, i) =>
        `<p style="font-family:${SANS};font-size:14px;line-height:1.75;color:${MUTED};margin:${i === 0 ? "16" : "12"}px 0 0;">${esc(l)}</p>`,
    )
    .join("\n              ");
  return `
          <tr>
            <td style="padding:2px 44px 0;">
              ${ps}
            </td>
          </tr>`;
}

/** Big centred value box — an OTP code or a tracking/AWB number. */
function highlightRow(value: string, opts?: { spaced?: boolean }): string {
  const shown = opts?.spaced ? esc(value).split("").join(" ") : esc(value);
  return `
          <tr>
            <td style="padding:22px 44px 4px;">
              <div style="background:${CODE_BG};border:1px solid ${LINE};border-radius:2px;padding:20px 0;text-align:center;font-family:${SERIF};font-size:34px;font-weight:500;letter-spacing:.16em;color:${INK};">
                ${shown}
              </div>
            </td>
          </tr>`;
}

export type DetailRow = { label: string; value: string };

/** Label / value rows in a bordered card (order number, courier, total…). */
function detailRows(rows: DetailRow[]): string {
  if (rows.length === 0) return "";
  const body = rows
    .map(
      (r) =>
        `<tr>
                  <td style="padding:9px 0;font-family:${SANS};font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:${TAUPE};white-space:nowrap;">${esc(r.label)}</td>
                  <td style="padding:9px 0;font-family:${SANS};font-size:14px;color:${INK};text-align:right;font-weight:500;">${esc(r.value)}</td>
                </tr>`,
    )
    .join("\n                ");
  return `
          <tr>
            <td style="padding:20px 44px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${LINE};border-bottom:1px solid ${LINE};">
                ${body}
              </table>
            </td>
          </tr>`;
}

/** Filled ink button (bulletproof-ish via padding on the anchor). */
function ctaRow(label: string, href: string): string {
  return `
          <tr>
            <td style="padding:26px 44px 4px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="border-radius:2px;background:${INK};">
                    <a href="${esc(href)}" style="display:inline-block;padding:13px 30px;font-family:${SANS};font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:${CARD};text-decoration:none;">
                      ${esc(label)}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
}

function noteRow(text: string): string {
  return `
          <tr>
            <td style="padding:18px 44px 40px;">
              <p style="font-family:${SANS};font-size:12.5px;line-height:1.7;color:${MUTED};margin:0;">
                ${esc(text)}
              </p>
            </td>
          </tr>`;
}

function tailPadRow(): string {
  return `
          <tr><td style="padding:0 44px 40px;"></td></tr>`;
}

export type BrandedEmailOpts = {
  eyebrow: string;
  heading: string;
  bodyLines?: string[];
  highlight?: { value: string; spaced?: boolean };
  details?: DetailRow[];
  cta?: { label: string; href: string };
  note?: string;
};

/** Compose the branded shell from structured content. */
export function renderBrandedEmail(opts: BrandedEmailOpts): string {
  let inner = eyebrowRow(opts.eyebrow) + headingHtml(opts.heading);
  if (opts.bodyLines?.length) inner += paragraphsRows(opts.bodyLines);
  if (opts.highlight)
    inner += highlightRow(opts.highlight.value, { spaced: opts.highlight.spaced });
  if (opts.details?.length) inner += detailRows(opts.details);
  if (opts.cta) inner += ctaRow(opts.cta.label, opts.cta.href);
  if (opts.note) inner += noteRow(opts.note);
  else inner += tailPadRow();
  return shell(inner);
}

/**
 * One-time verification code email — used for both first-time signup and
 * returning sign-in, so the copy stays neutral ("verification code").
 */
export function verificationCodeEmail(code: string): RenderedEmail {
  const html = renderBrandedEmail({
    eyebrow: "Verification code",
    heading: "Use this code to continue to your AKS Atelier account.",
    highlight: { value: code, spaced: true },
    note: "This code expires in 10 minutes. Enter it on the page where you asked to sign in. Didn’t request it? You can safely ignore this email — no one can sign in without the code.",
  });

  const text = [
    "AKS ATELIER",
    "",
    "Verification code",
    "",
    `    ${code}`,
    "",
    "Use this code to continue to your AKS Atelier account.",
    "It expires in 10 minutes.",
    "",
    "Didn't request this? You can safely ignore this email — no one can sign in without the code.",
    "",
    "AKS Atelier · Ready to wear, cut to standard sizes",
  ].join("\n");

  return {
    subject: `Your AKS Atelier verification code: ${code}`,
    html,
    text,
  };
}

// ---------------------------------------------------------------------------
// Order-notification presentation catalog
//
// Maps each order-status template key to how its EMAIL should be laid out:
// an eyebrow, a serif heading, and whether to attach a "Track order" button
// or a courier/AWB detail box. The paragraph copy comes from the rendered
// message template body (editable in admin), so email and WhatsApp stay in
// sync; the catalog only adds the branded structure around it.
// ---------------------------------------------------------------------------

type Presentation = {
  eyebrow: string;
  heading: (v: Record<string, string>) => string;
  track?: boolean;
  courierBox?: boolean;
};

const NOTIFICATION_PRESENTATION: Record<string, Presentation> = {
  "order.received": {
    eyebrow: "Order received",
    heading: () => "Thank you — we have your order.",
    track: true,
  },
  "order.confirmed": {
    eyebrow: "Order confirmed",
    heading: () => "Your order is confirmed.",
    track: true,
  },
  "order.measurements_verified": {
    eyebrow: "Order confirmed",
    heading: () => "Confirmed, and being prepared.",
    track: true,
  },
  "order.cutting": {
    eyebrow: "In the atelier",
    heading: () => "Your pieces are being prepared.",
    track: true,
  },
  "order.stitching": {
    eyebrow: "In the atelier",
    heading: () => "Being finished by hand.",
    track: true,
  },
  "order.embroidery": {
    eyebrow: "In the atelier",
    heading: () => "The detailing stage.",
    track: true,
  },
  "order.finishing": {
    eyebrow: "In the atelier",
    heading: () => "The last quiet details.",
    track: true,
  },
  "order.quality_check": {
    eyebrow: "Final check",
    heading: () => "One last look before it ships.",
    track: true,
  },
  "order.packed": {
    eyebrow: "Packed",
    heading: () => "Packed, and ready to travel.",
    track: true,
  },
  "order.dispatched": {
    eyebrow: "On its way",
    heading: () => "Your order is on its way.",
    track: true,
    courierBox: true,
  },
  "order.delivered": {
    eyebrow: "Delivered",
    heading: () => "Delivered. We hope you love it.",
    track: false,
  },
  "order.completed": {
    eyebrow: "Complete",
    heading: () => "Yours, and only yours.",
    track: false,
  },
  "order.cancelled": {
    eyebrow: "Order cancelled",
    heading: () => "Your order has been cancelled.",
    track: false,
  },
  "order.refund_pending": {
    eyebrow: "Refund in progress",
    heading: () => "We’re processing your refund.",
    track: false,
  },
  "order.refunded": {
    eyebrow: "Refund complete",
    heading: () => "Your refund is complete.",
    track: false,
  },
  "order.delivery_refused": {
    eyebrow: "Delivery update",
    heading: () => "We couldn’t complete your delivery.",
    track: true,
  },
  "track.otp": {
    eyebrow: "Tracking code",
    heading: () => "Your order tracking code.",
    track: false,
  },
};

/** Strip lines the branded layout renders as a button or detail box, so they
 *  don't also appear as body paragraphs. */
function bodyLinesFor(templateKey: string, bodyText: string): string[] {
  const drop = (l: string) => {
    const t = l.trim();
    if (!t) return true;
    if (/^track (it|the order)/i.test(t)) return true;
    if (/^follow the parcel/i.test(t)) return true;
    if (/^courier\s*:/i.test(t)) return true;
    if (/^tracking\s*\/?\s*(awb)?\s*:/i.test(t)) return true;
    return false;
  };
  return bodyText
    .split(/\n{2,}/)
    .map((para) =>
      para
        .split("\n")
        .filter((l) => !drop(l))
        .join(" ")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * Branded HTML for an order-status email. Falls back to a generic branded
 * wrapper (subject as heading, body as paragraphs) for any key without a
 * catalog entry, so every notification is branded regardless.
 */
export function orderNotificationEmail(input: {
  templateKey: string;
  subject: string;
  bodyText: string;
  vars: Record<string, string>;
}): string {
  const p = NOTIFICATION_PRESENTATION[input.templateKey];
  const vars = input.vars;
  const bodyLines = bodyLinesFor(input.templateKey, input.bodyText);

  if (!p) {
    return renderBrandedEmail({
      eyebrow: "AKS Atelier",
      heading: input.subject || "An update on your order.",
      bodyLines,
    });
  }

  const opts: BrandedEmailOpts = {
    eyebrow: p.eyebrow,
    heading: p.heading(vars),
    bodyLines,
  };

  const details: DetailRow[] = [];
  if (vars.orderNumber) details.push({ label: "Order", value: vars.orderNumber });
  if (p.courierBox) {
    if (vars.courierName)
      details.push({ label: "Courier", value: vars.courierName });
    if (vars.trackingNumber && vars.trackingNumber !== "—")
      details.push({ label: "Tracking / AWB", value: vars.trackingNumber });
  }
  if (input.templateKey === "track.otp" && vars.code) {
    opts.highlight = { value: vars.code, spaced: true };
  }
  if (details.length) opts.details = details;

  if (p.track && vars.trackUrl) {
    opts.cta = { label: "Track your order", href: vars.trackUrl };
  }

  return renderBrandedEmail(opts);
}
