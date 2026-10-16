export function cx(...parts: unknown[]) {
  return parts.filter((part): part is string => typeof part === "string" && part.length > 0).join(" ");
}
