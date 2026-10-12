import { isHousePlaceholderEmail } from "@/modules/auth/social/identity";

export type SignInInventory = {
  email: string | null;
  phone: string | null;
  providers: string[];
};

/** Ways back into the account. A placeholder inbox does not count. */
export function signInMethodCount(input: SignInInventory): number {
  let count = 0;
  if (input.email && !isHousePlaceholderEmail(input.email)) count += 1;
  if (input.phone?.trim()) count += 1;
  count += new Set(input.providers.filter(Boolean)).size;
  return count;
}

export function canDisconnectProvider(
  input: SignInInventory,
  provider: string,
): boolean {
  if (!input.providers.includes(provider)) return false;
  const next = {
    ...input,
    providers: input.providers.filter((item) => item !== provider),
  };
  return signInMethodCount(next) >= 1;
}

export function canClearPhone(input: SignInInventory): boolean {
  if (!input.phone?.trim()) return true;
  return signInMethodCount({ ...input, phone: null }) >= 1;
}
