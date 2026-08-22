export function validateProfileName(value: string): string {
  const clean = value.trim().replace(/\s+/g, " ");
  if (clean.length < 2) throw new Error("Give this gateway profile a name with at least 2 characters.");
  if (clean.length > 48) throw new Error("Gateway profile names must be 48 characters or fewer.");
  return clean;
}

export function validateConfirmationPin(value: string): string {
  const clean = value.trim();
  if (!/^\d{4,8}$/.test(clean)) throw new Error("Create a 4–8 digit confirmation PIN for gateway dispatches.");
  return clean;
}
