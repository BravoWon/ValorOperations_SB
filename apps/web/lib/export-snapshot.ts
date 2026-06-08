import type { LocalDbSnapshot } from '@valor/core';

/**
 * Serialize a snapshot to JSON and trigger a browser file download.
 * Uses URL.createObjectURL / revokeObjectURL — browser-only.
 */
export function downloadSnapshot(snapshot: LocalDbSnapshot, filename: string): void {
  const json = JSON.stringify(snapshot, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Read a File object and parse its contents as JSON.
 * Returns the parsed value (caller validates with `isValidSnapshot`).
 */
export function readSnapshotFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(JSON.parse(e.target?.result as string));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
