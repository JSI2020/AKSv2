/**
 * Facts we do not have. The shop name AKS and the site aks-atelier.com are
 * already public. The seller is an individual with no registered business,
 * so there is no VAT ID and no company registration number to print.
 * Replace each marker before relying on these pages with a customer.
 */
export const LEGAL_PLACEHOLDERS = {
  individualName: "[OWNER: your full name]",
  postalAddress: "[OWNER: postal address in Pakistan]",
  contactEmail: "[OWNER: contact email]",
  contactPhone: "[OWNER: phone number, if you want one published]",
} as const;

export const LEGAL_PLACEHOLDER_LIST = Object.values(LEGAL_PLACEHOLDERS);
