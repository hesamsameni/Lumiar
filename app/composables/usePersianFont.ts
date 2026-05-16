/**
 * Returns true when the string contains at least one Arabic/Persian character.
 */
const RTL_REGEX =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasRtlChars(text: string | null | undefined): boolean {
  if (!text) return false;
  return RTL_REGEX.test(text);
}

/**
 * Returns an inline style object that applies Vazirmatn when the text
 * contains Persian/Arabic characters. Use with :style binding.
 */
export function rtlStyle(
  text: string | null | undefined,
): Record<string, string> {
  return hasRtlChars(text) ? { fontFamily: '"Vazirmatn", sans-serif' } : {};
}
