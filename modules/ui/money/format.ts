/**
 * Money: integer minor units (PKR paisa). NEVER floats at the boundary.
 */
export function formatMoney(
  value: number,
  currency: "PKR" = "PKR",
): string {
  if (!Number.isInteger(value)) {
    throw new TypeError("Money value must be an integer (minor units)");
  }

  const negative = value < 0;
  const abs = Math.abs(value);
  const major = Math.trunc(abs / 100);
  const minor = abs % 100;
  const grouped = major.toLocaleString("en-US");
  const decimals = minor.toString().padStart(2, "0");
  const amount = `${grouped}.${decimals}`;

  return negative ? `-${currency} ${amount}` : `${currency} ${amount}`;
}
