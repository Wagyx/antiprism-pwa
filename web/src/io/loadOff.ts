/** Quick check that text looks like an OFF file. */
export function looksLikeOff(text: string): boolean {
  return /^\s*OFF\b/m.test(text);
}

export type LoadedOff = {
  name: string;
  text: string;
};

/** Read a browser File as OFF text; rejects non-OFF content. */
export async function readOffFile(file: File): Promise<LoadedOff> {
  const text = await file.text();
  if (!looksLikeOff(text)) {
    throw new Error(`“${file.name}” is not an OFF file (missing OFF header)`);
  }
  return { name: file.name || "model.off", text };
}
