import { CHARACTER_LIMIT } from "../constants.js";

export function truncateIfNeeded(text: string, label = "results"): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  const truncated = text.slice(0, CHARACTER_LIMIT);
  return (
    truncated +
    `\n\n[TRUNCATED: Response exceeded ${CHARACTER_LIMIT} characters. ` +
    `Use 'offset' or add filters to narrow ${label}.]`
  );
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function jsonOutput(data: unknown): string {
  return truncateIfNeeded(JSON.stringify(data, null, 2));
}
