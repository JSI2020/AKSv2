# Customer social sign-in

Shoppers stay passwordless. Google, Facebook, Instagram, and TikTok are OAuth. WhatsApp is a one-time code to the customer's phone. A button is shown as live only when its environment variables are set. Nothing in this flow hardcodes an app id or secret.

`AUTH_URL` is the public origin Auth.js uses to build redirect URIs (local: `http://localhost:3000`). Register each URI exactly, including `https` in production.

| Provider  | Redirect URI                             |
| --------- | ---------------------------------------- |
| Google    | `{AUTH_URL}/api/auth/callback/google`    |
| Facebook  | `{AUTH_URL}/api/auth/callback/facebook`  |
| Instagram | `{AUTH_URL}/api/auth/callback/instagram` |
| TikTok    | `{AUTH_URL}/api/auth/callback/tiktok`    |

Staff accounts are refused on every storefront provider. Those people sign in at `/admin/login`. A cancelled consent screen returns the shopper to `/account/login` with a short message; no account is created.

When Facebook, Instagram, or TikTok does not share an email, the account is stored under a non-deliverable placeholder (`fb.`, `ig.`, or `tt.` plus the provider subject, at `@customers.aks.local`). The same subject signs into the same customer later. A real email from the provider links to an existing customer with that address (the same linking Google and Facebook already use).

Live verification needs the developer apps below. Automated tests mock the provider HTTP calls and do not use real keys.

## Facebook

1. Open [Meta for Developers](https://developers.facebook.com/apps) and create an app (type **Business**, or add Facebook Login to the existing WhatsApp app).
2. Add the **Facebook Login** product and choose **Web**.
3. Under Facebook Login → Settings, add the redirect URI from the table.
4. Under App settings → Basic, copy the **App ID** and **App secret**.
5. Set `AUTH_FACEBOOK_ID` and `AUTH_FACEBOOK_SECRET`.
6. Scopes used: `email` and `public_profile`. Override with `AUTH_FACEBOOK_SCOPES` only if you have a reason to.
7. While the app is in Development mode, add the Facebook accounts that will sign in as roles or testers. Switch the app to Live before real customers use it.
8. Meta does not allow a production app to use `localhost` callbacks. Use a separate development app for local sign-in, or a tunnel whose origin matches `AUTH_URL`.

Facebook accounts created with a phone number sometimes have no email. Those shoppers still get an account, keyed by their Facebook id.

## Instagram

Instagram Basic Display is retired. This integration uses **Instagram API with Instagram Login** (Business Login). Meta only completes that handshake for a **professional** Instagram account (Business or Creator). A personal Instagram account is declined by Meta; the shopper lands back on the sign-in page and can use email or WhatsApp instead.

1. In the same Meta app (or a new Business app), add **Instagram** → **API setup with Instagram login**.
2. Open Business login settings and add the Instagram redirect URI from the table. Add `http://localhost:3000/api/auth/callback/instagram` on the development app if you test locally.
3. Copy the **Instagram App ID** and **Instagram App Secret**. These are not the Facebook App ID.
4. Set `AUTH_INSTAGRAM_ID` and `AUTH_INSTAGRAM_SECRET`.
5. Default scope is `instagram_business_basic` (id, username, name, profile picture). Override with `AUTH_INSTAGRAM_SCOPES` if Meta renames the scope.
6. Add Instagram testers while the app is in Development. The Instagram user must switch that account to Professional before the consent screen will succeed.
7. Instagram does not return an email address. The customer row uses the placeholder described above. It does not attach itself to an email account unless you later collect a real address.

## TikTok

1. Open [TikTok for Developers](https://developers.tiktok.com/) and create an app.
2. Add the **Login Kit** product for **Web**.
3. Set the redirect URI from the table. TikTok compares it character for character.
4. Under Scopes, enable `user.info.basic` and `user.info.profile`.
5. Copy the **Client key** and **Client secret**.
6. Set `AUTH_TIKTOK_CLIENT_KEY` and `AUTH_TIKTOK_CLIENT_SECRET`.
7. Leave `AUTH_TIKTOK_SCOPES` unset unless TikTok has approved more scopes. The default is `user.info.basic,user.info.profile`. Add `user.info.email` only after that scope is approved — requesting an unapproved scope makes the whole login fail.
8. Submit the app for review before customers outside your sandbox can sign in. Sandbox users are added in the TikTok developer portal.

Login Kit uses PKCE. The server rewrites Auth.js's `client_id` to TikTok's `client_key` on the token request. Without a real email scope, the account uses the `tt.` placeholder.

## WhatsApp

There is no consumer “Login with WhatsApp” OAuth product. **WhatsApp Embedded Signup** is how a business connects its own WhatsApp Business account to Meta; it is the wrong handshake for a shopper.

Sign-in therefore verifies the phone number with a one-time code sent through the **WhatsApp Cloud API** the house already uses for order messages:

1. In the Meta app, add **WhatsApp** and finish API setup.
2. Copy a system-user or permanent access token into `WHATSAPP_ACCESS_TOKEN`.
3. Copy the sending phone number id into `WHATSAPP_PHONE_NUMBER_ID`.
4. Set `AKS_WHATSAPP_LOGIN=1`. The button stays hidden until the token, the phone number id, and this flag are all present.
5. Create and approve an authentication (copy-code) template, then set `WHATSAPP_TEMPLATE_AUTH` to its name and `WHATSAPP_TEMPLATE_AUTH_LANG` (default `en_US`). Outside Meta's 24-hour customer-care window, a free-form text will not be delivered. The template is what makes a cold sign-in work.
6. Local development (`NODE_ENV` not `production`, and `AKS_ALLOW_DEV_OTP` not `0`) returns the code in the API response and does not call Meta. Production never does that.

The shopper enters the number at `/account/login/whatsapp`, then the six-digit code. A new number creates a customer. A staff phone is not sent a code. A wrong code, a rate limit, or a Meta send failure is shown on the form; closing the form before entering a code does not create an account.

## Privacy, terms, and data deletion

TikTok and Meta ask for public URLs before an app can go live. This shop publishes them in English:

| Page                        | URL                                                       |
| --------------------------- | --------------------------------------------------------- |
| Privacy policy              | `https://www.aks-atelier.com/privacy`                     |
| Terms of service            | `https://www.aks-atelier.com/terms`                       |
| Data deletion instructions  | `https://www.aks-atelier.com/data-deletion`               |
| Meta data-deletion callback | `https://www.aks-atelier.com/api/auth/meta/data-deletion` |

Paste the privacy and terms URLs into the Facebook, Instagram, and TikTok app settings. Paste the callback into the Meta app’s Data Deletion Request URL. The callback checks `signed_request` with `AUTH_FACEBOOK_SECRET`, `AUTH_INSTAGRAM_SECRET`, or `WHATSAPP_APP_SECRET`, then returns a confirmation code. The status page is `https://www.aks-atelier.com/data-deletion/status?code=…`.

The seller’s own name, postal address, email, and phone are still marked `[OWNER: …]` on those pages. Fill them in before you send a reviewer to the site. There is no company registration or VAT number on the pages: the shop is an individual.

`/privacy-policy`, `/datenschutz`, `/terms-of-service`, `/agb`, `/tos`, `/impressum`, and `/imprint` redirect to the English pages. There is no separate German legal notice.

## After changing env

Restart the Next.js server. OAuth clients are built when the Auth.js module loads, so a new key is not picked up by a process that is already running.
