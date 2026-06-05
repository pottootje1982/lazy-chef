"use client";

import { useRouter } from "next/navigation";
import ScanFileButtons from "@/components/ScanFileButtons";
import { setPendingScanFile } from "@/lib/pending-scan";

// On the import hub: pick a file here, then jump straight to the scan editor
// with that file (handed off via module state across the client navigation).
export default function ScanFilePicker() {
  const router = useRouter();
  return (
    <ScanFileButtons
      onPick={(file) => {
        setPendingScanFile(file);
        router.push("/recipes/import/scan");
      }}
    />
  );
}
