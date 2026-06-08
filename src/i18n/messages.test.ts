import { test } from "node:test";
import assert from "node:assert/strict";
import nl from "../messages/nl.json" with { type: "json" };
import en from "../messages/en.json" with { type: "json" };

// Flatten a nested message object into dotted keys: { a: { b: 1 } } → ["a.b"].
function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return v && typeof v === "object" && !Array.isArray(v)
      ? flatten(v as Record<string, unknown>, key)
      : [key];
  });
}

test("message catalogs nl/en have identical key sets", () => {
  const nlKeys = new Set(flatten(nl as Record<string, unknown>));
  const enKeys = new Set(flatten(en as Record<string, unknown>));
  const missingInNl = [...enKeys].filter((k) => !nlKeys.has(k));
  const missingInEn = [...nlKeys].filter((k) => !enKeys.has(k));
  assert.deepEqual(missingInNl, [], `keys missing in nl.json: ${missingInNl.join(", ")}`);
  assert.deepEqual(missingInEn, [], `keys missing in en.json: ${missingInEn.join(", ")}`);
});
