const sentence = (value: string): string =>
  value.replace(/\s+/g, " ").trim().replace(/^./, (c) => c.toUpperCase());

export function buildWhatTheyDoSummary(description?: string, fallbackName?: string): string {
  if (description && description.trim().length > 0) {
    const cleaned = sentence(description);
    return cleaned.length <= 220 ? cleaned : `${cleaned.slice(0, 217)}...`;
  }
  if (fallbackName?.trim()) {
    return `${fallbackName.trim()} appears to be a local service business.`;
  }
  return "Local service business profile.";
}
