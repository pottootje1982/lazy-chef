import { test } from "node:test";
import assert from "node:assert/strict";
import { isLikelyEnglish, translateWord } from "./nl-dict.ts";

test("isLikelyEnglish: detects English recipes", () => {
  assert.equal(
    isLikelyEnglish(["Garlic butter chicken", "2 cloves garlic", "100g butter", "chicken breast"]),
    true,
  );
});

test("isLikelyEnglish: leaves Dutch recipes alone", () => {
  assert.equal(
    isLikelyEnglish(["Kipfilet met knoflook", "2 tenen knoflook", "100g boter", "ui"]),
    false,
  );
});

test("isLikelyEnglish: a single homograph does not flip a Dutch recipe", () => {
  // "paprika" is in the EN dict but a Dutch recipe of mostly Dutch words stays Dutch.
  assert.equal(isLikelyEnglish(["Paprika met ui en knoflook", "boter", "melk"]), false);
});

test("isLikelyEnglish: no recognizable words → not English", () => {
  assert.equal(isLikelyEnglish(["xyz qqq"]), false);
});

test("translateWord: known English word translates, unknown passes through", () => {
  assert.equal(translateWord("garlic"), "knoflook");
  assert.equal(translateWord("zzz"), "zzz");
});
