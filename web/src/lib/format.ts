export function initialsOf(name?: string | null) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + last).toUpperCase();
}

const pesoFormatter = new Intl.NumberFormat("en-PH", { maximumFractionDigits: 0 });

export function formatPeso(amount: number) {
  return `₱${pesoFormatter.format(amount)}`;
}
