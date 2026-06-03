"use client";

import { useState } from "react";
import { setAutoWeekPlanSettings } from "@/lib/week-plan-actions";

export default function WeekPlanSettings({
  enabled: initialEnabled,
  minRecipes: initialMin,
}: {
  enabled: boolean;
  minRecipes: number;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [min, setMin] = useState(initialMin);

  function save(nextEnabled: boolean, nextMin: number) {
    void setAutoWeekPlanSettings(nextEnabled, nextMin).catch(() => {});
  }

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save(e.target.checked, min);
          }}
          className="h-4 w-4 flex-none accent-brand-600"
        />
        <span className="text-sm text-stone-700">
          Automatically save ordered recipes as a week plan
        </span>
      </label>

      <div className={`flex items-center gap-2 text-sm ${enabled ? "" : "opacity-50"}`}>
        <span className="text-stone-600">Only when ordering at least</span>
        <input
          type="number"
          min={1}
          max={50}
          value={min}
          disabled={!enabled}
          onChange={(e) => setMin(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          onBlur={() => save(enabled, min)}
          className="input w-16 !py-1 text-center text-sm"
        />
        <span className="text-stone-600">recipe{min === 1 ? "" : "s"}</span>
      </div>
    </div>
  );
}
