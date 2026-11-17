// The lists the settings page offers, worked out from what the browser knows
// rather than kept as a data file that would go stale.

/** Every two-letter region the browser can name, as code and name. */
export function countries(language: string): { code: string; name: string }[] {
  const names = new Intl.DisplayNames([language], { type: "region" });
  const out: { code: string; name: string }[] = [];
  for (let a = 65; a <= 90; a++) {
    for (let b = 65; b <= 90; b++) {
      const code = String.fromCharCode(a, b);
      let name: string | undefined;
      try {
        name = names.of(code);
      } catch {
        continue;
      }
      // A region the browser does not know comes back as its own code.
      if (name && name !== code) out.push({ code, name });
    }
  }
  return out.sort((x, y) => x.name.localeCompare(y.name, language));
}

/** A language's name in itself, capitalised: "English", "Español", "Français". */
export function languageName(code: string): string {
  try {
    const name = new Intl.DisplayNames([code], { type: "language" }).of(code) ?? code;
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
  } catch {
    return code;
  }
}
