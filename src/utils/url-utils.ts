/**
 * Returns true if the URL points to a PDF file.
 * Checks the pathname suffix and common query param patterns.
 */
export function isPdfUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.toLowerCase().endsWith(".pdf"))
      return true;
    for (const value of parsed.searchParams.values()) {
      if (value.toLowerCase().endsWith(".pdf"))
        return true;
    }
    return false;
  }
  catch {
    return false;
  }
}
