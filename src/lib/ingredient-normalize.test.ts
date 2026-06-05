import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIngredient, parseCount } from "./ingredient-normalize.ts";

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
