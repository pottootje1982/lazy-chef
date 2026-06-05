import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIngredient,
  parseCount,
  isWeightPackage,
  defaultOrderCount,
} from "./ingredient-normalize.ts";

test("normalizeIngredient: parentheticals are dropped", () => {
  // The reported regression: a parenthetical measure must not pollute the key.
  assert.equal(normalizeIngredient("20g (4tsp) orange juice"), "orange juice");
  assert.equal(normalizeIngredient("20g(4tsp) orange juice"), "orange juice"); // no space
  assert.equal(normalizeIngredient("orange juice (freshly squeezed)"), "orange juice"); // trailing
  assert.equal(normalizeIngredient("1 tbsp (15ml) olijfolie"), "olijfolie");
  assert.equal(normalizeIngredient("200g (7oz) plain flour"), "flour");
  // Unclosed paren: the number/unit + stopwords still reduce it sensibly.
  assert.equal(normalizeIngredient("2 cups (about 250g plain flour"), "flour");
});

test("normalizeIngredient: numbers, units and fractions are stripped", () => {
  assert.equal(normalizeIngredient("200g flour"), "flour");
  assert.equal(normalizeIngredient("2 tbsp olive oil"), "olive oil");
  assert.equal(normalizeIngredient("½ onion"), "onion");
  assert.equal(normalizeIngredient("2 large garlic cloves, finely chopped"), "garlic");
  assert.equal(normalizeIngredient("3 sprigs of fresh thyme"), "thyme");
});

test("normalizeIngredient: Dutch units, abbreviations and prep words", () => {
  assert.equal(normalizeIngredient("1 el geperste knoflook"), "knoflook");
  assert.equal(normalizeIngredient("2 theel. kaneel"), "kaneel");
  assert.equal(normalizeIngredient("100 g gewassen spinazie"), "spinazie");
  assert.equal(normalizeIngredient("2 geplette teentjes knoflook"), "knoflook");
  assert.equal(normalizeIngredient("een snufje zout"), "zout");
});

test("parseCount: counts only whole items, never measures", () => {
  assert.equal(parseCount("3 onions"), 3);
  assert.equal(parseCount("12 eggs"), 12);
  assert.equal(parseCount("200g flour"), 1); // glued unit, not a count
  assert.equal(parseCount("2 tbsp oil"), 1); // measure
  assert.equal(parseCount("4 garlic cloves"), 1); // sub-product unit
  assert.equal(parseCount("2 tenen knoflook"), 1); // Dutch clove
  assert.equal(parseCount("3 eetl. roomboter"), 1); // OCR abbreviation
  assert.equal(parseCount("2-3 onions"), 1); // range → conservative
  assert.equal(parseCount("½ onion"), 1); // no leading integer
  assert.equal(parseCount("flour"), 1); // no number
});

test("isWeightPackage: detects weight/volume product units", () => {
  assert.equal(isWeightPackage("500 gram"), true);
  assert.equal(isWeightPackage("500 g"), true);
  assert.equal(isWeightPackage("1 kg"), true);
  assert.equal(isWeightPackage("330 ml"), true);
  assert.equal(isWeightPackage("6 stuks"), false); // piece pack, not weight
  assert.equal(isWeightPackage("per stuk"), false);
  assert.equal(isWeightPackage(null), false);
});

test("defaultOrderCount: item count, but 1 for weight packages", () => {
  // counted item linked to a per-piece product → keep the count
  assert.equal(defaultOrderCount("4 grofgesneden uien", "per stuk"), 4);
  // counted items linked to a gram package → 1 package
  assert.equal(defaultOrderCount("12 raw tiger prawns, deveined", "500 gram"), 1);
  assert.equal(defaultOrderCount("8 raw langoustines", "500 gram"), 1);
  // measures already parse to 1 regardless
  assert.equal(defaultOrderCount("1.5 kg spinazie", "400 gram"), 1);
  // unknown unit → fall back to parsed count
  assert.equal(defaultOrderCount("3 onions", null), 3);
});
