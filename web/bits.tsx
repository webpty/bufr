// The small pieces every screen uses, so a card, a face or a question looks
// the same wherever it turns up.

import { Button, ListBox, Modal, Surface } from "@heroui/react";
import { CellSelect } from "@heroui-pro/react/cell-select";
import type { ReactNode } from "react";

export function Card({ className = "", children }: { className?: string; children: ReactNode }) {
  return <Surface className={`relative flex flex-col gap-4 p-4 ${className}`}>{children}</Surface>;
}

export function initials(name: string, email: string): string {
  const words = (name.trim() || email.split("@")[0]).split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return "?";
  return (words[0][0] + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

/** Faces without a photo, coloured by who it is, so a person keeps theirs. */
const GRADIENTS = [
  ["#6366f1", "#1e3a8a"],
  ["#ec4899", "#7c3aed"],
  ["#06b6d4", "#1e40af"],
  ["#f59e0b", "#b45309"],
  ["#a78bfa", "#4c1d95"],
];

function gradient(seed: string): string {
  const n = [...seed].reduce((sum, c) => sum + c.charCodeAt(0), 0) % GRADIENTS.length;
  return `linear-gradient(140deg, ${GRADIENTS[n][0]}, ${GRADIENTS[n][1]})`;
}

/** A person's round face: their photo, or their initials. */
export function Face({ name, email, url, size = 40 }: { name: string; email: string; url?: string; size?: number }) {
  if (url) {
    return (
      <img
        src={url}
        alt=""
        draggable={false}
        className="shrink-0 select-none rounded-full border-2 border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 select-none items-center justify-center rounded-full border-2 border-border font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: gradient(email) }}
    >
      {initials(name, email)}
    </span>
  );
}

export interface Choice {
  id: string;
  label: string;
}

export function Picker({
  label,
  value,
  items,
  onChange,
  isDisabled,
}: {
  label: string;
  value: string;
  items: Choice[];
  onChange: (value: string) => void;
  isDisabled?: boolean;
}) {
  return (
    <CellSelect aria-label={label} value={value} isDisabled={isDisabled} onChange={(key) => onChange(String(key ?? ""))}>
      <CellSelect.Trigger>
        <CellSelect.Label>{label}</CellSelect.Label>
        <CellSelect.Value />
        <CellSelect.Indicator />
      </CellSelect.Trigger>
      <CellSelect.Popover>
        <ListBox>
          {items.map((item) => (
            <ListBox.Item key={item.id} id={item.id} textValue={item.label}>
              {item.label}
              <ListBox.ItemIndicator />
            </ListBox.Item>
          ))}
        </ListBox>
      </CellSelect.Popover>
    </CellSelect>
  );
}

/** Asked in a window of its own before anything is removed. */
export function Confirm({
  isOpen,
  title,
  confirmLabel,
  keepLabel,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  confirmLabel: string;
  keepLabel: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-[360px]">
          <Modal.Header>
            <Modal.Heading>{title}</Modal.Heading>
          </Modal.Header>
          <Modal.Footer className="flex flex-row justify-end gap-2">
            <Button variant="secondary" onPress={onClose}>
              {keepLabel}
            </Button>
            <Button variant="danger" onPress={onConfirm}>
              {confirmLabel}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}

/** A line that is always there, empty or not, so nothing moves when it fills. */
export function StatusLine({ text, tone = "muted" }: { text: string; tone?: "muted" | "danger" }) {
  return (
    <p role="status" className={`reserve-line min-w-0 text-sm ${tone === "danger" ? "text-danger" : "text-muted"}`}>
      {text}
    </p>
  );
}
