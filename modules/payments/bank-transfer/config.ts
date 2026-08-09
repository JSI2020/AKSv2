export type BankTransferConfig = {
  bankName: string;
  accountTitle: string;
  accountNumber: string;
  iban: string;
};

export function readBankTransferConfig(): BankTransferConfig {
  const bankName = process.env.AKS_BANK_NAME?.trim();
  const accountTitle = process.env.AKS_BANK_ACCOUNT_TITLE?.trim();
  const accountNumber = process.env.AKS_BANK_ACCOUNT_NUMBER?.trim();
  const iban = process.env.AKS_BANK_IBAN?.trim();

  if (!bankName || !accountTitle || !accountNumber || !iban) {
    throw new Error(
      "Bank transfer config incomplete — set AKS_BANK_NAME, AKS_BANK_ACCOUNT_TITLE, AKS_BANK_ACCOUNT_NUMBER, AKS_BANK_IBAN.",
    );
  }

  return { bankName, accountTitle, accountNumber, iban };
}

/** Returns null when bank env is incomplete (fail closed — never invent credentials). */
export function readBankTransferConfigOrNull(): BankTransferConfig | null {
  try {
    return readBankTransferConfig();
  } catch {
    return null;
  }
}
