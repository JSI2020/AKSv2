export type BankTransferConfig = {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
};

export function readBankTransferConfig(): BankTransferConfig {
  const bankName = process.env.AKS_BANK_NAME;
  const accountTitle = process.env.AKS_BANK_ACCOUNT_TITLE;
  const accountNumber = process.env.AKS_BANK_ACCOUNT_NUMBER;
  const iban = process.env.AKS_BANK_IBAN;

  if (!bankName || !accountTitle || !accountNumber || !iban) {
    throw new Error(
      "Bank transfer config incomplete — set AKS_BANK_NAME, AKS_BANK_ACCOUNT_TITLE, AKS_BANK_ACCOUNT_NUMBER, AKS_BANK_IBAN.",
    );
  }

  return { bankName, accountTitle, accountNumber, iban };
}

export function readBankTransferConfigOrDefaults(): BankTransferConfig {
  return {
    bankName: process.env.AKS_BANK_NAME ?? "Meezan Bank",
    accountTitle: process.env.AKS_BANK_ACCOUNT_TITLE ?? "AKS Studio",
    accountNumber: process.env.AKS_BANK_ACCOUNT_NUMBER ?? "01234567890123",
    iban: process.env.AKS_BANK_IBAN ?? "PK00MEZN0000000123456789",
  };
}
