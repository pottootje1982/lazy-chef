"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createRecipe } from "@/app/actions";
import RecipeForm, { type RecipeFormValues } from "@/components/RecipeForm";
import {
  wordsInRect,
  joinAsTitle,
  joinAsParagraph,
  linesFromWords,
  type OcrWord,
  type Rect,
} from "@/lib/ocr-layout";

type RegionType = "TITLE" | "INGREDIENTS" | "DIRECTIONS" | "IMAGE";
type DrawnRect = Rect & { id: number; type: RegionType };
type OcrResult = { width: number; height: number; words: OcrWord[] };

const REGIONS: {
  type: RegionType;
  label: string;
  border: string;
  bg: string;
  chip: string;
  single: boolean;
}[] = [
  { type: "TITLE", label: "Title", border: "border-blue-500", bg: "bg-blue-500/10", chip: "bg-blue-600", single: true },
  { type: "INGREDIENTS", label: "Ingredients", border: "border-emerald-500", bg: "bg-emerald-500/10", chip: "bg-emerald-600", single: false },
  { type: "DIRECTIONS", label: "Directions", border: "border-amber-500", bg: "bg-amber-500/10", chip: "bg-amber-600", single: false },
  { type: "IMAGE", label: "Image", border: "border-purple-500", bg: "bg-purple-500/10", chip: "bg-purple-600", single: true },
];
const REGION = Object.fromEntries(REGIONS.map((r) => [r.type, r])) as Record<
  RegionType,
  (typeof REGIONS)[number]
>;

const MIN_DRAG = 8; // ignore tiny accidental drags (display px)

// Corner resize handles. Each drags one corner while the opposite corner stays
// anchored. `w`/`n` flag whether this corner controls the west/north edge.
const CORNERS: { k: string; west: boolean; north: boolean; pos: React.CSSProperties; cursor: string }[] = [
  { k: "nw", west: true, north: true, pos: { left: -6, top: -6 }, cursor: "nwse-resize" },
  { k: "ne", west: false, north: true, pos: { right: -6, top: -6 }, cursor: "nesw-resize" },
  { k: "sw", west: true, north: false, pos: { left: -6, bottom: -6 }, cursor: "nesw-resize" },
  { k: "se", west: false, north: false, pos: { right: -6, bottom: -6 }, cursor: "nwse-resize" },
];

export default function ScanImportClient() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocr, setOcr] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageNote, setImageNote] = useState<string | null>(null);

  const [rects, setRects] = useState<DrawnRect[]>([]);
  const [activeLabel, setActiveLabel] = useState<RegionType>("TITLE");
  const [drag, setDrag] = useState<{ x: number; y: number; cx: number; cy: number } | null>(null);
  // While resizing: the rect being edited + its anchored (opposite) corner, in natural px.
  const [resize, setResize] = useState<{ id: number; anchorX: number; anchorY: number } | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [saveOriginal, setSaveOriginal] = useState(true);
  const [values, setValues] = useState<RecipeFormValues | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);
  const idRef = useRef(0);

  // Revoke the object URL when it changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function reset() {
    setRects([]);
    setOcr(null);
    setError(null);
    setImageNote(null);
    setValues(null);
    setDrag(null);
  }

  function onChooseFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    reset();
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    void runOcr(f);
  }

  async function runOcr(f: File) {
    setOcrLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", f);
      const res = await fetch("/api/recipes/scan", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Could not read text from that image.");
        setOcr(null);
        return;
      }
      setOcr(data);
    } catch {
      setError("Something went wrong reading that image.");
      setOcr(null);
    } finally {
      setOcrLoading(false);
    }
  }

  // ── Coordinate transforms (display CSS px ↔ natural image px) ─────────────
  function scale() {
    const img = imgRef.current;
    if (!img || !img.clientWidth || !img.clientHeight) return { sx: 1, sy: 1 };
    return { sx: img.naturalWidth / img.clientWidth, sy: img.naturalHeight / img.clientHeight };
  }
  function pointerToDisplay(e: React.PointerEvent) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const r = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(e.clientX - r.left, img.clientWidth)),
      y: Math.max(0, Math.min(e.clientY - r.top, img.clientHeight)),
    };
  }

  // ── Drawing ───────────────────────────────────────────────────────────────
  function onPointerDown(e: React.PointerEvent) {
    if (!previewUrl) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const p = pointerToDisplay(e);
    setDrag({ x: p.x, y: p.y, cx: p.x, cy: p.y });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const p = pointerToDisplay(e);
    setDrag((d) => (d ? { ...d, cx: p.x, cy: p.y } : d));
  }
  function onPointerUp() {
    if (!drag) return;
    const dispX = Math.min(drag.x, drag.cx);
    const dispY = Math.min(drag.y, drag.cy);
    const dispW = Math.abs(drag.cx - drag.x);
    const dispH = Math.abs(drag.cy - drag.y);
    setDrag(null);
    if (dispW < MIN_DRAG || dispH < MIN_DRAG) return;

    const { sx, sy } = scale();
    const rect: DrawnRect = {
      id: idRef.current++,
      type: activeLabel,
      x: Math.round(dispX * sx),
      y: Math.round(dispY * sy),
      w: Math.round(dispW * sx),
      h: Math.round(dispH * sy),
    };
    setRects((prev) => {
      // Title & Image are single-instance — a new one replaces the old.
      const filtered = REGION[activeLabel].single ? prev.filter((r) => r.type !== activeLabel) : prev;
      return [...filtered, rect];
    });
  }
  function removeRect(id: number) {
    setRects((prev) => prev.filter((r) => r.id !== id));
  }

  // ── Resizing an existing box by a corner handle ────────────────────────────
  function startResize(e: React.PointerEvent, rect: DrawnRect, corner: (typeof CORNERS)[number]) {
    e.stopPropagation(); // don't start a new draw
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    // Anchor = the corner opposite the one being dragged (natural px).
    setResize({
      id: rect.id,
      anchorX: corner.west ? rect.x + rect.w : rect.x,
      anchorY: corner.north ? rect.y + rect.h : rect.y,
    });
  }
  function onResizeMove(e: React.PointerEvent) {
    if (!resize) return;
    const { sx, sy } = scale();
    const p = pointerToDisplay(e);
    const nx = p.x * sx;
    const ny = p.y * sy;
    const x = Math.round(Math.min(resize.anchorX, nx));
    const y = Math.round(Math.min(resize.anchorY, ny));
    const w = Math.round(Math.abs(nx - resize.anchorX));
    const h = Math.round(Math.abs(ny - resize.anchorY));
    setRects((prev) => prev.map((r) => (r.id === resize.id ? { ...r, x, y, w, h } : r)));
  }
  function onResizeUp() {
    setResize(null);
  }

  // ── Per-region extraction (memoized; reuses cached OCR words) ──────────────
  function wordsForType(type: RegionType): OcrWord[] {
    if (!ocr) return [];
    const seen = new Set<OcrWord>();
    for (const r of rects.filter((r) => r.type === type)) {
      for (const w of wordsInRect(ocr.words, r)) seen.add(w);
    }
    return [...seen];
  }
  const preview = useMemo(
    () => ({
      title: joinAsTitle(wordsForType("TITLE")),
      ingredients: linesFromWords(wordsForType("INGREDIENTS")),
      // Directions from a photo become a single step — line breaks in the
      // image are layout, not separate steps.
      directions: joinAsParagraph(wordsForType("DIRECTIONS")),
      hasImage: rects.some((r) => r.type === "IMAGE"),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ocr, rects],
  );

  // ── Extract → prefilled RecipeForm ─────────────────────────────────────────
  async function extract() {
    setExtracting(true);
    setError(null);
    setImageNote(null);
    try {
      let imageUrl = "";
      let sourceImageUrl = "";
      const imageRect = rects.find((r) => r.type === "IMAGE");
      // Only upload when there's something to store: the original (opt-in) or a crop.
      if (file && (saveOriginal || imageRect)) {
        const fd = new FormData();
        fd.append("image", file);
        if (saveOriginal) fd.append("saveSource", "1");
        if (imageRect) {
          fd.append("x", String(imageRect.x));
          fd.append("y", String(imageRect.y));
          fd.append("w", String(imageRect.w));
          fd.append("h", String(imageRect.h));
        }
        const res = await fetch("/api/recipes/scan/image", { method: "POST", body: fd });
        const data = await res.json();
        if (res.ok) {
          imageUrl = data.imageUrl ?? "";
          sourceImageUrl = data.sourceImageUrl ?? "";
        } else {
          // Non-fatal: keep the extracted text, just skip the photo.
          setImageNote(data.error ?? "Couldn't save the scan image — you can add one later.");
        }
      }

      const next: RecipeFormValues = {
        title: preview.title,
        description: "",
        imageUrl,
        sourceImageUrl,
        sourceUrl: "",
        servings: "",
        prepTime: "",
        cookTime: "",
        ingredients: preview.ingredients,
        instructions: preview.directions ? [preview.directions] : [],
        tags: [],
      };
      setValues(next);
    } catch {
      setError("Something went wrong preparing the recipe.");
    } finally {
      setExtracting(false);
    }
  }

  // ── Render: prefilled form once extracted ──────────────────────────────────
  if (values) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Read from your photo — review the details below and save.
          <button
            onClick={() => setValues(null)}
            className="ml-2 text-green-700 underline hover:text-green-900"
          >
            Back to the scan
          </button>
        </div>
        {imageNote ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {imageNote}
          </div>
        ) : null}
        <RecipeForm action={createRecipe} initial={values} submitLabel="Save recipe" />
      </div>
    );
  }

  const { sx, sy } = scale();
  const hasAnything =
    preview.title || preview.ingredients.length || preview.directions || preview.hasImage;

  return (
    <div className="space-y-5">
      {/* Step 1 — choose a photo */}
      <label className="btn-primary inline-block cursor-pointer">
        {file ? "Choose a different photo" : "Choose or take a photo"}
        <input
          type="file"
          accept="image/*"
          onChange={onChooseFile}
          className="hidden"
        />
      </label>

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {previewUrl ? (
        <>
          {/* Toolbar: pick the region to draw next */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-stone-500">Draw a box for:</span>
            {REGIONS.map((r) => (
              <button
                key={r.type}
                onClick={() => setActiveLabel(r.type)}
                className={`rounded-full px-3 py-1 text-xs font-medium text-white ${r.chip} ${
                  activeLabel === r.type ? "ring-2 ring-offset-1 ring-stone-400" : "opacity-70 hover:opacity-100"
                }`}
              >
                {r.label}
              </button>
            ))}
            {ocrLoading ? <span className="text-xs text-stone-400">Reading text…</span> : null}
          </div>
          <p className="-mt-2 text-xs text-stone-400">
            Drag on the image to draw a box. Drag a box&apos;s corner handles to resize it, or ✕ to remove it.
          </p>

          {/* Image + draw overlay */}
          <div className="relative inline-block max-w-full select-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={previewUrl}
              alt="Recipe scan"
              draggable={false}
              className="block max-w-full rounded-lg border border-stone-200"
            />
            <div
              className="absolute inset-0 cursor-crosshair"
              style={{ touchAction: "none" }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            >
              {/* Committed rectangles */}
              {rects.map((r) => {
                const cfg = REGION[r.type];
                return (
                  <div
                    key={r.id}
                    className={`absolute border-2 ${cfg.border} ${cfg.bg}`}
                    style={{ left: r.x / sx, top: r.y / sy, width: r.w / sx, height: r.h / sy }}
                  >
                    {/* Label + delete, floating just above the box */}
                    <div
                      className="absolute -top-5 left-0 flex items-center gap-1"
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <span className={`px-1 text-[10px] font-medium text-white ${cfg.chip}`}>
                        {cfg.label}
                      </span>
                      <button
                        onClick={() => removeRect(r.id)}
                        className={`h-4 w-4 rounded text-[10px] leading-4 text-white ${cfg.chip}`}
                        aria-label={`Remove ${cfg.label} box`}
                      >
                        ✕
                      </button>
                    </div>
                    {/* Corner resize handles */}
                    {CORNERS.map((corner) => (
                      <span
                        key={corner.k}
                        onPointerDown={(e) => startResize(e, r, corner)}
                        onPointerMove={onResizeMove}
                        onPointerUp={onResizeUp}
                        className={`absolute h-3 w-3 rounded-sm border border-white ${cfg.chip}`}
                        style={{ ...corner.pos, cursor: corner.cursor, touchAction: "none" }}
                        aria-label={`Resize ${cfg.label} box`}
                      />
                    ))}
                  </div>
                );
              })}
              {/* In-progress drag rectangle */}
              {drag ? (
                <div
                  className={`absolute border-2 border-dashed ${REGION[activeLabel].border} ${REGION[activeLabel].bg}`}
                  style={{
                    left: Math.min(drag.x, drag.cx),
                    top: Math.min(drag.y, drag.cy),
                    width: Math.abs(drag.cx - drag.x),
                    height: Math.abs(drag.cy - drag.y),
                  }}
                />
              ) : null}
            </div>
          </div>

          {/* Live preview of what will be extracted */}
          <div className="card space-y-3 p-4">
            <h2 className="text-sm font-semibold text-stone-700">Preview</h2>
            <RegionPreview label="Title" empty={!preview.title}>
              {preview.title}
            </RegionPreview>
            <RegionPreview label="Ingredients" empty={preview.ingredients.length === 0}>
              <ul className="list-disc pl-5">
                {preview.ingredients.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </RegionPreview>
            <RegionPreview label="Directions" empty={!preview.directions}>
              <p className="whitespace-pre-wrap">{preview.directions}</p>
            </RegionPreview>
            <RegionPreview label="Image" empty={!preview.hasImage}>
              {preview.hasImage ? "Marked — will be cropped and saved." : null}
            </RegionPreview>
          </div>

          <label className="flex items-center gap-2 text-sm text-stone-600">
            <input
              type="checkbox"
              checked={saveOriginal}
              onChange={(e) => setSaveOriginal(e.target.checked)}
              className="h-4 w-4 rounded border-stone-300"
            />
            Save the original photo with the recipe
          </label>

          <button
            onClick={extract}
            disabled={extracting || !hasAnything}
            className="btn-primary"
          >
            {extracting ? "Extracting…" : "Extract & review"}
          </button>
        </>
      ) : null}
    </div>
  );
}

function RegionPreview({
  label,
  empty,
  children,
}: {
  label: string;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="text-sm">
      <span className="label">{label}</span>
      {empty ? (
        <p className="text-stone-400">(draw a box to capture this)</p>
      ) : (
        <div className="text-stone-700">{children}</div>
      )}
    </div>
  );
}
