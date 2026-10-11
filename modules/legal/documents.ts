import { LEGAL_PLACEHOLDERS } from "./placeholders";
import {
  DATA_DELETION_PATH,
  DATA_DELETION_STATUS_PATH,
  META_DATA_DELETION_PATH,
  PRIVACY_PATH,
  PUBLIC_SITE_ORIGIN,
  TERMS_PATH,
} from "./routes";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

export type LegalDocument = {
  path: string;
  title: string;
  updated: string;
  sections: LegalSection[];
};

export const LEGAL_UPDATED = "11 October 2026";

const contactBlock = [
  LEGAL_PLACEHOLDERS.individualName,
  LEGAL_PLACEHOLDERS.postalAddress,
  LEGAL_PLACEHOLDERS.contactEmail,
  LEGAL_PLACEHOLDERS.contactPhone,
].join("\n");

export const privacyDocument: LegalDocument = {
  path: PRIVACY_PATH,
  title: "Privacy policy",
  updated: LEGAL_UPDATED,
  sections: [
    {
      heading: "Who runs this shop",
      paragraphs: [
        `AKS is the shop at aks-atelier.com. It is run by an individual, ${LEGAL_PLACEHOLDERS.individualName}. There is no registered company. This notice is in English, which is the language of the shop.`,
      ],
    },
    {
      heading: "What we use your data for",
      paragraphs: [
        "We use it to take your order, cut and deliver the piece inside Pakistan, take payment in Pakistani rupees (PKR), and keep an account so you can sign in again. We do not sell your data.",
      ],
    },
    {
      heading: "Orders",
      paragraphs: [
        "When you order, we keep the name, phone, delivery address in Pakistan, and the PKR price you agreed at checkout. Those details are copied onto the order and stay on that order so we can deliver it, answer a payment dispute, and keep a record of the sale. Deleting your account does not wipe that order copy.",
      ],
    },
    {
      heading: "Account",
      paragraphs: [
        "If you create an account we store your name, an email when we have one, and a phone when we have one. A sign-in code sent by email or WhatsApp is stored only as a hash and expires after 10 minutes.",
      ],
    },
    {
      heading: "Facebook",
      paragraphs: [
        "If you continue with Facebook, Meta sends us your Facebook id, name, email address when the account has one, and profile picture URL. We use that to open your AKS account and to recognise you the next time. We store the Facebook id and the access token Meta issues for that sign-in. We do not post to Facebook for you. If Facebook shares no email, we store a non-deliverable placeholder address so the account still has a unique key.",
        "We keep this while the account is open. When you ask us to delete it, or Meta sends a deletion request, we remove the Facebook link, the token, and the profile fields, and we disable the account as described under Deletion.",
      ],
    },
    {
      heading: "Instagram",
      paragraphs: [
        "Instagram sign-in works for a professional Instagram account. Meta sends us your Instagram user id, username, name, account type, and profile picture URL. Instagram does not send an email. We store the user id, the access token, and a non-deliverable placeholder address. The purpose, the retention, and the deletion are the same as for Facebook.",
      ],
    },
    {
      heading: "TikTok",
      paragraphs: [
        "If you continue with TikTok, TikTok sends us your open id, display name, avatar URL, and username when the scopes we requested include them. We ask for an email only if TikTok has approved that scope. Otherwise we store a non-deliverable placeholder address. We store the open id and the access token so we can recognise you, and we delete them when the account is deleted. TikTok does not call our deletion endpoint; use the data deletion page.",
      ],
    },
    {
      heading: "WhatsApp",
      paragraphs: [
        "If you sign in with WhatsApp, we send a one-time code to the number you typed, through WhatsApp’s Cloud API. We store the number, and the code only as a hash, for 10 minutes. We do not receive your WhatsApp chats. The same number is how we reach you about an order when you give it at checkout.",
      ],
    },
    {
      heading: "Who else sees it",
      paragraphs: [
        "The courier who delivers inside Pakistan receives the name, phone, and address on the order. The payment service you choose at checkout receives what it needs to take the PKR payment. Meta (for Facebook, Instagram, and WhatsApp) and TikTok receive the sign-in handshake when you use those buttons. Our email sender receives an address when we write to you about an order, or when you join the newsletter. We do not pass your data to anyone else for their own marketing.",
      ],
    },
    {
      heading: "How long we keep it",
      paragraphs: [
        "Account and sign-in data stay while the account is open. When the account is deleted we clear them or replace them with a marker that is not a real inbox. Sign-in codes last 10 minutes. The order copy stays after deletion so the sale can still be delivered and recorded. We do not keep it for a reason beyond the order, a payment dispute, and that record.",
      ],
    },
    {
      heading: "Deletion",
      paragraphs: [
        `You can ask us to delete the account from ${DATA_DELETION_PATH}. Facebook and Instagram can also send a signed deletion request to ${META_DATA_DELETION_PATH}. We then disable the account, clear the name, phone, and email, delete the sign-in links and tokens, and delete saved addresses. The order copy stays, as above. A staff login is not removed by that request.`,
      ],
    },
    {
      heading: "Care of the data",
      paragraphs: [
        "We take reasonable care to stop unauthorised access to this data. Getting into it without permission, copying it, or using someone else’s identity to place an order can be an offence under Pakistan’s Prevention of Electronic Crimes Act, 2016.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [contactBlock],
    },
  ],
};

export const termsDocument: LegalDocument = {
  path: TERMS_PATH,
  title: "Terms of service",
  updated: LEGAL_UPDATED,
  sections: [
    {
      heading: "Who you are buying from",
      paragraphs: [
        `These terms are between you and ${LEGAL_PLACEHOLDERS.individualName}, the individual who runs AKS at aks-atelier.com. There is no registered company behind the shop.`,
      ],
    },
    {
      heading: "The pieces",
      paragraphs: [
        "AKS sells ready-to-wear womenswear in the house sizes shown on each piece (XS–XL). The price on the page is in Pakistani rupees (PKR). The total at checkout, including any shipping amount shown there, is the amount you agree to pay.",
      ],
    },
    {
      heading: "Delivery",
      paragraphs: [
        "We deliver only within Pakistan. We do not ship to an address outside Pakistan. Any shipping charge is the amount shown at checkout before you place the order.",
      ],
    },
    {
      heading: "Payment",
      paragraphs: [
        "You pay by a method offered at checkout. That can include paying the courier on delivery when cash on delivery is offered for the order. A placed order is an agreement to buy that piece at the PKR price you accepted.",
      ],
    },
    {
      heading: "Returns",
      paragraphs: [
        "If a piece arrives and you want to send it back, follow the returns note published on the site and write to the contact below. We will tell you the next step. The address on the order has to be in Pakistan.",
      ],
    },
    {
      heading: "How you use the site",
      paragraphs: [
        "You may browse and order for yourself. You may not try to enter an account, system, or set of data that is not yours, and you may not place an order in someone else’s name or with someone else’s payment. That misuse can be an offence under the Prevention of Electronic Crimes Act, 2016.",
      ],
    },
    {
      heading: "Accounts",
      paragraphs: [
        `Sign-in has no password: a code, or Facebook, Instagram, TikTok, or WhatsApp where those buttons are shown. The privacy policy at ${PRIVACY_PATH} says what each one sends us.`,
      ],
    },
    {
      heading: "Law",
      paragraphs: [
        "These terms follow the laws of Pakistan. A dispute is heard in the courts of Pakistan.",
      ],
    },
    {
      heading: "Contact",
      paragraphs: [contactBlock],
    },
  ],
};

export const dataDeletionDocument: LegalDocument = {
  path: DATA_DELETION_PATH,
  title: "Delete your data",
  updated: LEGAL_UPDATED,
  sections: [
    {
      heading: "Ask us directly",
      paragraphs: [
        `Signed in? Open your account and choose Delete my account. That uses the same removal as a Meta request: the profile, saved addresses, and linked sign-ins are cleared, and you are signed out. Order copies stay.`,
        `You can also email ${LEGAL_PLACEHOLDERS.contactEmail} from the address on the account, or include the phone number you used. Say that you want your AKS account deleted.`,
        `You can also write to ${LEGAL_PLACEHOLDERS.individualName} at ${LEGAL_PLACEHOLDERS.postalAddress}, or call ${LEGAL_PLACEHOLDERS.contactPhone}.`,
      ],
    },
    {
      heading: "Facebook and Instagram",
      paragraphs: [
        `If you signed in with Facebook or Instagram, you can remove AKS in your Facebook or Instagram settings and ask Meta to send a deletion request. We accept that request at ${PUBLIC_SITE_ORIGIN}${META_DATA_DELETION_PATH}. Meta shows you a confirmation code. Open ${PUBLIC_SITE_ORIGIN}${DATA_DELETION_STATUS_PATH} and add ?code= plus that code to see the result.`,
        "The request is signed with the app secret. A request we cannot verify is refused. A request that matches a staff login does not delete that login.",
      ],
    },
    {
      heading: "TikTok and WhatsApp",
      paragraphs: [
        "TikTok sign-in stores the open id and the profile fields described in the privacy policy, plus an email only when TikTok has shared one. WhatsApp sign-in stores the phone number you typed and a code hash that expires after 10 minutes. Neither of those sends Meta’s deletion callback. Email the contact above and name the sign-in you used.",
      ],
    },
    {
      heading: "What we remove, and what stays",
      paragraphs: [
        "We remove the name, email, and phone on the account, the Facebook, Instagram, and TikTok ids and tokens, the WhatsApp number on the profile, and saved addresses.",
        "The order copy stays: the name, address, phone, and PKR amount written onto the order, so we can finish delivery and keep a record of the sale. The privacy policy explains that.",
      ],
    },
  ],
};

export const legalDocuments = [
  privacyDocument,
  termsDocument,
  dataDeletionDocument,
] as const;

export function documentText(doc: LegalDocument): string {
  return [
    doc.title,
    doc.updated,
    ...doc.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
    ]),
  ].join("\n");
}
