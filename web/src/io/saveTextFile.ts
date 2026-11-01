type SaveResult = "downloaded" | "cancelled";

let inFlight: Promise<SaveResult> | null = null;

/** Save a blob via a browser download. */
export function saveBlob(blob: Blob, suggestedName: string): Promise<SaveResult> {
  if (inFlight) return inFlight;

  const run: Promise<SaveResult> = (async (): Promise<SaveResult> => {
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return "downloaded";
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    }
  })();

  inFlight = run.finally(() => {
    inFlight = null;
  }) as Promise<SaveResult>;

  return run;
}

/** Save arbitrary text via a browser download. */
export function saveTextFile(
  text: string,
  suggestedName: string,
  mime = "text/plain;charset=utf-8",
): Promise<SaveResult> {
  if (!text.trim()) {
    return Promise.resolve("cancelled" as const);
  }
  return saveBlob(new Blob([text], { type: mime }), suggestedName);
}
