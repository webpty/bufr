// The bar across the top of every screen: what is on the left is the page's
// own, and the light or dark switch is always on the right.

import { Button } from "@heroui/react";
import { Moon, Sun } from "@gravity-ui/icons";
import { useEffect, useState, type ReactNode } from "react";
import { useT } from "./i18n";
import { chosen, isDark, setDark } from "./theme";

export function ThemeToggle() {
  const { t } = useT();
  const [dark, setDarkState] = useState(isDark);

  // Until light or dark is chosen here, the page follows the device, even
  // when it changes its mind while the page is open.
  useEffect(() => {
    const watch = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (chosen()) return;
      document.documentElement.classList.toggle("dark", watch.matches);
      setDarkState(watch.matches);
    };
    watch.addEventListener("change", follow);
    return () => watch.removeEventListener("change", follow);
  }, []);
  return (
    <Button
      isIconOnly
      variant="secondary"
      aria-label={dark ? t("theme.light") : t("theme.dark")}
      onPress={() => {
        setDark(!dark);
        setDarkState(!dark);
      }}
    >
      {dark ? <Sun /> : <Moon />}
    </Button>
  );
}

export function Header({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <header className="flex items-center justify-between gap-3 py-2">
      <div className="flex min-w-0 items-center gap-3">{left}</div>
      <div className="flex shrink-0 items-center gap-2">
        {right}
        <ThemeToggle />
      </div>
    </header>
  );
}
