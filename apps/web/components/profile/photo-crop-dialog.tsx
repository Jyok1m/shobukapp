"use client";

import { useEffect, useState } from "react";
import Cropper, { type Area, type Point } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

const MAX_SIDE = 1024;
const MAX_BYTES = 5 * 1024 * 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("image_unreadable"));
    image.src = src;
  });
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/*
 * Draws the crop at its source resolution (never upscaled), capped at 1024 px.
 * Drawing from an <img> keeps the EXIF orientation: browsers apply it to
 * images, and react-easy-crop measures the same oriented image.
 * PNG first (lossless); WebP 0.95 only if the PNG would exceed the 5 MB limit.
 */
export async function exportCrop(src: string, area: Area): Promise<File> {
  const image = await loadImage(src);
  const side = Math.max(1, Math.min(MAX_SIDE, Math.round(area.width)));
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas_unavailable");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, side, side);

  const png = await toBlob(canvas, "image/png");
  if (png && png.size <= MAX_BYTES) return new File([png], "photo.png", { type: "image/png" });
  const webp = await toBlob(canvas, "image/webp", 0.95);
  if (!webp) throw new Error("export_failed");
  return new File([webp], "photo.webp", { type: webp.type });
}

export function PhotoCropDialog({
  file,
  pending,
  error,
  onCancel,
  onConfirm,
}: {
  file: File | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (cropped: File) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // One object URL per picked file, released when the dialog closes or the file changes.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    /* eslint-disable react-hooks/set-state-in-effect -- reset the crop for each new file */
    setSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setArea(null);
    setExportError(null);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function confirm() {
    if (!src || !area) return;
    setExporting(true);
    setExportError(null);
    try {
      onConfirm(await exportCrop(src, area));
    } catch {
      setExportError("Impossible de lire cette image. Essayez une autre photo (JPEG, PNG ou WebP).");
    } finally {
      setExporting(false);
    }
  }

  const busy = pending || exporting;

  return (
    <Dialog
      open={file !== null}
      title="Recadrer la photo"
      description="Déplacez la photo et ajustez le zoom pour cadrer votre visage."
      dismissible={!busy}
      onClose={onCancel}
    >
      <div className="relative aspect-square w-full overflow-hidden rounded-md bg-scrim">
        {src && (
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            minZoom={1}
            maxZoom={4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, pixels) => setArea(pixels)}
          />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="photo-zoom" className="text-sm font-medium text-ink">
          Zoom
        </label>
        <input
          id="photo-zoom"
          type="range"
          min={1}
          max={4}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(Number(event.target.value))}
          className="h-11 w-full accent-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>
      {(exportError || error) && (
        <p role="alert" className="text-sm font-medium text-danger">
          {exportError ?? error}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onCancel} disabled={busy}>
          Annuler
        </Button>
        <Button onClick={confirm} loading={busy} disabled={!area}>
          Enregistrer la photo
        </Button>
      </div>
    </Dialog>
  );
}
