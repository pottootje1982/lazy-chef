// In-memory handoff for the scan importer: the import hub picks a file, then
// navigates (client-side, soft nav) to /recipes/import/scan, which consumes it.
// Module state survives Next.js client-side navigation, so the File passes
// across pages without serializing it (works for large photos and PDFs).
let pending: File | null = null;

export function setPendingScanFile(file: File): void {
  pending = file;
}

// Returns the pending file once, then clears it.
export function takePendingScanFile(): File | null {
  const f = pending;
  pending = null;
  return f;
}
