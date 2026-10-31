const DEFAULT_NAME = "polyhedron.off";

let inFlight: Promise<"downloaded" | "cancelled"> | null = null;

/**
 * Save OFF text via a browser download (reliable across Chromium embeds).
 */
export function saveOffFile(
  offText: string,
  suggestedName = DEFAULT_NAME,
): Promise<"downloaded" | "cancelled"> {
  if (inFlight) return inFlight;

  const text = offText;
  if (!text.trim()) {
    return Promise.resolve("cancelled");
  }

  inFlight = (async () => {
    const blob = new Blob([text], { type: "application/off;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = suggestedName.endsWith(".off")
        ? suggestedName
        : `${suggestedName}.off`;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
      return "downloaded";
    } finally {
      // Delay revoke so the browser can start the download
      window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
    }
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
