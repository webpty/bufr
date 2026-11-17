// Light or dark, remembered per browser; until chosen, the device's. The same
// rule runs in index.html before anything paints.

const KEY = "bufr:theme";

export function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

export function setDark(dark: boolean): void {
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(KEY, dark ? "dark" : "light");
  } catch {
    // Nothing remembered; the page still shows what was asked for.
  }
}

/** Whether light or dark was chosen here, rather than following the device. */
export function chosen(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}
