type SaveResult = "downloaded" | "cancelled";

let inFlight: Promise<SaveResult> | null = null;

/** Save arbitrary text via a browser download. */
export function saveTextFile(
  text: string,
  suggestedName: string,
  mime = "text/plain;charset=utf-8",
): Promise<SaveResult> {
  if (inFlight) return inFlight;

  if (!text.trim()) {
    return Promise.resolve("cancelled" as const);
  }

  const run: Promise<SaveResult> = (async (): Promise<SaveResult> => {
    const blob = new Blob([text], { type: mime });
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
