import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeIngredient,
  parseCount,
  isWeightPackage,
  defaultOrderCount,
  parseNeededAmount,
  parsePackSize,
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

test("parseNeededAmount: weight/volume win over count", () => {
  assert.deepEqual(parseNeededAmount("1.5 kg spinazie"), { kind: "mass", value: 1500 });
  assert.deepEqual(parseNeededAmount("200g flour"), { kind: "mass", value: 200 });
  assert.deepEqual(parseNeededAmount("1,5 kg aardappel"), { kind: "mass", value: 1500 });
  // first weight wins; the parenthetical tsp is ignored
  assert.deepEqual(parseNeededAmount("20g (4tsp) orange juice"), { kind: "mass", value: 20 });
  assert.deepEqual(parseNeededAmount("750 ml milk"), { kind: "volume", value: 750 });
  assert.deepEqual(parseNeededAmount("1 l water"), { kind: "volume", value: 1000 });
  // no weight/volume unit → count
  assert.deepEqual(parseNeededAmount("12 dried figs"), { kind: "count", value: 12 });
  assert.deepEqual(parseNeededAmount("2 limes"), { kind: "count", value: 2 });
  assert.deepEqual(parseNeededAmount("5 garlic cloves"), { kind: "count", value: 1 });
});

test("parsePackSize: pieces, weight, volume and multipacks", () => {
  assert.deepEqual(parsePackSize("4 stuks"), { count: 4 });
  assert.deepEqual(parsePackSize("10 stuks S/M/L"), { count: 10 });
  assert.deepEqual(parsePackSize("per stuk"), { count: 1 });
  assert.deepEqual(parsePackSize("1 stuk"), { count: 1 });
  assert.deepEqual(parsePackSize("12 blokjes"), { count: 12 });
  assert.deepEqual(parsePackSize("500 gram"), { grams: 500 });
  assert.deepEqual(parsePackSize("1 kilo"), { grams: 1000 });
  assert.deepEqual(parsePackSize("750 ml"), { ml: 750 });
  // multipacks: count + total amount
  assert.deepEqual(parsePackSize("2 stuks à 125 gram"), { count: 2, grams: 250 });
  assert.deepEqual(parsePackSize("6 x 500 ml"), { count: 6, ml: 3000 });
  // hybrid: last "N stuks" + parenthetical weight
  assert.deepEqual(parsePackSize("2 of 3 stuks (ca 250g)"), { count: 3, grams: 250 });
  assert.deepEqual(parsePackSize("1 stuk • ca. 300 gram"), { count: 1, grams: 300 });
  // a bunch is not a divisible piece count
  assert.deepEqual(parsePackSize("1 bosje"), {});
  assert.deepEqual(parsePackSize(null), {});
});

test("defaultOrderCount: packages = ceil(amount needed / pack size)", () => {
  // count ÷ piece count
  assert.equal(defaultOrderCount("12 dried figs halved", "4 stuks"), 3);
  assert.equal(defaultOrderCount("6 eggs boiled for 7 mins", "10 stuks S/M/L"), 1);
  assert.equal(defaultOrderCount("4 grofgesneden uien", "2 stuks"), 2);
  assert.equal(defaultOrderCount("2 stock cubes", "12 blokjes"), 1);
  // weight ÷ weight, volume ÷ volume
  assert.equal(defaultOrderCount("1.5 kg spinazie", "400 gram"), 4);
  assert.equal(defaultOrderCount("750 ml milk", "250 ml"), 3);
  assert.equal(defaultOrderCount("200 ml melk", "1 liter"), 1);
  // counted item linked to a per-piece product → keep the count
  assert.equal(defaultOrderCount("4 grofgesneden uien", "per stuk"), 4);
  // count need + weight-only pack can't be divided → 1 (unchanged)
  assert.equal(defaultOrderCount("12 raw tiger prawns, deveined", "500 gram"), 1);
  assert.equal(defaultOrderCount("8 raw langoustines", "500 gram"), 1);
  // a bunch already holds many → one bunch, never multiply by the count
  assert.equal(defaultOrderCount("6 spring onions finely sliced", "1 bosje"), 1);
  assert.equal(defaultOrderCount("4 green onions, chopped", "1 bos"), 1);
  // unknown unit → fall back to parsed count
  assert.equal(defaultOrderCount("3 onions", null), 3);
});
