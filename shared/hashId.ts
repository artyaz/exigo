/**
 * Masks an identifier for safe inclusion in logs.
 * Keeps a short prefix/suffix so entries stay correlatable without
 * revealing the full id.
 */
export function hashId(id: string): string {
    if (id.length > 8) return `${id.slice(0, 4)}...${id.slice(-4)}`;
    if (id.length >= 4) return `${id.slice(0, 2)}...${id.slice(-2)}`;
    return "*".repeat(id.length);
}
