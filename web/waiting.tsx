// Whatever part of a page is waiting on something: dimmed, with HeroUI's dots
// in its middle, and not to be pressed through until it is done. A wait
// shorter than a blink shows nothing, so a quick answer does not flash.

import { ChatLoader } from "@heroui-pro/react/chat-loader";
import { useEffect, useState } from "react";

const BLINK_MS = 200;

/** Lays itself over the nearest positioned parent while `on`. */
export function WaitingOverlay({ on, label, ground = "surface" }: { on: boolean; label: string; ground?: "surface" | "page" }) {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    if (!on) {
      setSeen(false);
      return;
    }
    const timer = setTimeout(() => setSeen(true), BLINK_MS);
    return () => clearTimeout(timer);
  }, [on]);

  if (!on) return null;
  const dim = ground === "page" ? "bg-[color-mix(in_oklab,var(--background)_72%,transparent)]" : "bg-[color-mix(in_oklab,var(--surface)_72%,transparent)]";
  return (
    <div
      aria-busy="true"
      role="status"
      className={`absolute inset-0 z-30 flex items-center justify-center rounded-[inherit] transition-colors duration-150 ${seen ? dim : "bg-transparent"}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {seen && (
        <span className="flex items-center rounded-full bg-default px-3 py-2 shadow-surface">
          <ChatLoader.Dots aria-label={label} />
        </span>
      )}
    </div>
  );
}
