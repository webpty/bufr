// Choosing a photo: pick a file, move it about inside a circle, and what is
// in the circle is what is kept. The cutting and the shrinking both happen
// here, so what goes up is 512 pixels square and nothing larger leaves the
// device.

import { Button, Modal, Slider } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useT } from "./i18n";

const FRAME = 260;
const OUTPUT = 512;

export function PhotoCropper({ file, onClose, onCut, onError }: { file: File; onClose: () => void; onCut: (blob: Blob) => void; onError: () => void }) {
  const { t } = useT();
  const [url, setUrl] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [at, setAt] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragging = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);

  // The smallest scale that still fills the circle, whichever way round.
  const base = size ? FRAME / Math.min(size.w, size.h) : 1;
  const scale = base * zoom;
  const width = size ? size.w * scale : 0;
  const height = size ? size.h * scale : 0;

  /** Never let an edge come inside the circle. */
  function clamp(next: { x: number; y: number }) {
    return { x: Math.min(0, Math.max(FRAME - width, next.x)), y: Math.min(0, Math.max(FRAME - height, next.y)) };
  }

  useEffect(() => {
    if (size) setAt((current) => clamp(current));
    // Only when the picture or the zoom changes: the clamp depends on both.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, size]);

  async function cut() {
    if (!url || !size) return;
    setBusy(true);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT;
      canvas.height = OUTPUT;
      const paper = canvas.getContext("2d");
      if (!paper) throw new Error("no canvas");
      paper.imageSmoothingQuality = "high";
      const factor = OUTPUT / FRAME;
      paper.drawImage(image, at.x * factor, at.y * factor, width * factor, height * factor);
      const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, "image/jpeg", 0.85));
      if (!blob) throw new Error("no picture");
      onCut(blob);
    } catch {
      setBusy(false);
      onError();
    }
  }

  return (
    <Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
      <Modal.Container placement="auto">
        <Modal.Dialog className="sm:max-w-[340px]">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Heading>{t("photo.title")}</Modal.Heading>
          </Modal.Header>
          <Modal.Body className="flex flex-col items-center gap-5">
            <div
              className="relative touch-none overflow-hidden rounded-full border-2 border-border bg-surface-secondary"
              style={{ width: FRAME, height: FRAME }}
              onPointerDown={(event) => {
                dragging.current = { x: event.clientX - at.x, y: event.clientY - at.y };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (!dragging.current) return;
                setAt(clamp({ x: event.clientX - dragging.current.x, y: event.clientY - dragging.current.y }));
              }}
              onPointerUp={() => {
                dragging.current = null;
              }}
            >
              {url && (
                <img
                  src={url}
                  alt=""
                  draggable={false}
                  onLoad={(event) => setSize({ w: event.currentTarget.naturalWidth, h: event.currentTarget.naturalHeight })}
                  onError={() => onError()}
                  style={{ position: "absolute", left: at.x, top: at.y, width: width || undefined, height: height || undefined, maxWidth: "none" }}
                />
              )}
            </div>
            <Slider
              aria-label={t("photo.zoom")}
              className="w-full"
              value={zoom}
              minValue={1}
              maxValue={3}
              step={0.01}
              onChange={(value) => setZoom(Array.isArray(value) ? value[0] : value)}
            >
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
          </Modal.Body>
          <Modal.Footer className="flex flex-row justify-end gap-2">
            <Button variant="secondary" isDisabled={busy} onPress={onClose}>
              {t("photo.cancel")}
            </Button>
            <Button isPending={busy} isDisabled={!size} onPress={() => void cut()}>
              {t("photo.use")}
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
