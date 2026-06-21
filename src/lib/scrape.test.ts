import { test } from "node:test";
import assert from "node:assert/strict";
import * as cheerio from "cheerio";
import { cleanTitle, extractFromHtml } from "./scrape.ts";

test("cleanTitle strips a trailing site-name suffix", () => {
  assert.equal(cleanTitle("Ovenschotel met prei en zalm | FOOD&YOU", "FOOD&YOU"), "Ovenschotel met prei en zalm");
  assert.equal(cleanTitle("Recept – Smulweb", "Smulweb"), "Recept");
  assert.equal(cleanTitle("Just a title", "Site"), "Just a title");
  assert.equal(cleanTitle("Title with | pipe"), "Title with | pipe"); // no site → unchanged
});

// Mirrors foodandyou.nl: a WordPress/Elementor article with the recipe as
// headed <ul> lists rather than Recipe JSON-LD.
const SAMPLE = `
<article class="entry-content">
  <p>Een heerlijke ovenschotel.</p>
  <p>Wat heb je nodig?<br>– 4 personen –</p>
  <ul>
    <li>500 gram preiringen</li>
    <li>250 gram zalmfilet</li>
    <li>peper en zout</li>
  </ul>
  <p>&nbsp;</p>
  <p>Bereiding:</p>
  <ul>
    <li>Verwarm de oven voor op 180 graden.</li>
    <li>Bak de prei kort.</li>
    <li>Serveer met een frisse salade.</li>
  </ul>
  <p>Eet smakelijk!</p>
</article>`;

test("extractFromHtml reads headed ingredient/instruction lists + servings", () => {
  const $ = cheerio.load(SAMPLE);
  const r = extractFromHtml($);
  assert.deepEqual(r.ingredients, ["500 gram preiringen", "250 gram zalmfilet", "peper en zout"]);
  assert.deepEqual(r.instructions, [
    "Verwarm de oven voor op 180 graden.",
    "Bak de prei kort.",
    "Serveer met een frisse salade.",
  ]);
  assert.equal(r.servings, "4 personen");
});

test("extractFromHtml: English 'Ingredients'/'Method' headings with <ol> steps", () => {
  const $ = cheerio.load(`
    <main>
      <h2>Ingredients</h2>
      <ul><li>2 eggs</li><li>flour</li></ul>
      <h2>Method</h2>
      <ol><li>Mix.</li><li>Bake.</li></ol>
      <p>Serves 4</p>
    </main>`);
  const r = extractFromHtml($);
  assert.deepEqual(r.ingredients, ["2 eggs", "flour"]);
  assert.deepEqual(r.instructions, ["Mix.", "Bake."]);
  assert.equal(r.servings, "4");
});

// Mirrors bakkriebels.nl: the recipe is <br>-separated lines inside a <p>,
// with a Dutch intro line; ingredients are followed by a blank line + equipment.
test("extractFromHtml reads <br>-separated lines inside a <p> (no list)", () => {
  const $ = cheerio.load(`
    <article>
      <p>Dit heb je nodig voor 12 stuks:<br>6 blaadjes bladerdeeg<br>150 ml melk<br>36 kleine aardbeien<br><br>En verder:<br>ronde uitsteker<br>bakpapier</p>
      <p>Zo ga je te werk:<br>Doe het ei met de suiker in een kom.<br>Verwarm in de magnetron.<br>Laat afkoelen.</p>
    </article>`);
  const r = extractFromHtml($);
  // Stops before the blank line / "En verder:" equipment.
  assert.deepEqual(r.ingredients, ["6 blaadjes bladerdeeg", "150 ml melk", "36 kleine aardbeien"]);
  assert.deepEqual(r.instructions, [
    "Doe het ei met de suiker in een kom.",
    "Verwarm in de magnetron.",
    "Laat afkoelen.",
  ]);
  assert.equal(r.servings, "12 stuks");
});

test("extractFromHtml returns empty when there's no recipe-like content", () => {
  const $ = cheerio.load("<main><p>Just a blog post with no lists.</p></main>");
  const r = extractFromHtml($);
  assert.deepEqual(r.ingredients, []);
  assert.deepEqual(r.instructions, []);
});
