"use client";

import { useTranslations } from "next-intl";

// The three file-source buttons for the scan importer (camera / library / PDF).
// Shared between the import hub (which hands the file off and navigates) and the
// scan editor (which re-picks in place). The parent decides what to do with the
// picked File via `onPick`.
export default function ScanFileButtons({
  onPick,
  hasFile = false,
}: {
  onPick: (file: File) => void;
  hasFile?: boolean;
}) {
  const t = useTranslations("import");
  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onPick(f);
    e.currentTarget.value = ""; // allow re-selecting the same file
  }

  return (
    <div className="flex flex-wrap gap-3">
      <label className="btn-primary inline-block cursor-pointer">
        {hasFile ? t("takeNewPhoto") : t("takePhoto")}
        {/* sr-only (not display:none) — some Android webviews won't trigger the
            camera for a display:none input. */}
        <input type="file" accept="image/*" capture="environment" onChange={handle} className="sr-only" />
      </label>
      <label className="btn-secondary inline-block cursor-pointer">
        {t("chooseLibrary")}
        <input type="file" accept="image/*" onChange={handle} className="sr-only" />
      </label>
      <label className="btn-secondary inline-block cursor-pointer">
        {t("uploadPdf")}
        <input type="file" accept="application/pdf" onChange={handle} className="sr-only" />
      </label>
    </div>
  );
}
