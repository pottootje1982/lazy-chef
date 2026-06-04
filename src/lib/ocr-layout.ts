// Pure, DOM-free geometry/text helpers shared by the scan importer (client) and
// tests. All coordinates are in the image's NATURAL pixel space — the caller is
// responsible for converting display (CSS) pixels to natural pixels first.

export type OcrWord = { text: string; x: number; y: number; w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };

// Keep words whose bounding-box CENTER falls inside the rectangle. Using the
// center (rather than full containment) is tolerant of words that slightly
// overflow the hand-drawn box.
export function wordsInRect(words: OcrWord[], rect: Rect): OcrWord[] {
  const x2 = rect.x + rect.w;
  const y2 = rect.y + rect.h;
  return words.filter((word) => {
    const cx = word.x + word.w / 2;
    const cy = word.y + word.h / 2;
    return cx >= rect.x && cx <= x2 && cy >= rect.y && cy <= y2;
  });
}

// Clean up OCR text: Vision emits punctuation and hyphen fragments as separate
// tokens, so a naive space-join produces "( optional )", "salt , pepper ." and
// words broken across a line ("choco- late"). This fixes the spacing and
// rejoins hyphenated line breaks.
export function tidyText(s: string): string {
  return s
    .replace(/\s+/g, " ")
    // Rejoin a word hyphenated across a line break: "choco- late" → "chocolate".
    // Only when a letter is glued to the hyphen (the line-break signature), so
    // intentional dashes ("salt - to taste") and "free-range" are left alone.
    .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
    // No space after an opening bracket.
    .replace(/([([{])\s+/g, "$1")
    // No space before closing brackets or sentence punctuation.
    .replace(/\s+([)\]}.,;:!?%])/g, "$1")
    .trim();
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Cluster words into text lines (top-to-bottom), then order each line
// left-to-right and join with spaces. A new line starts when a word's top edge
// drops more than 0.6× the median word height below the first word of the
// current line — enough to separate single-spaced printed lines while merging
// the small vertical jitter Vision emits within one line.
export function groupIntoLines(words: OcrWord[]): string[] {
  if (words.length === 0) return [];

  const threshold = 0.6 * median(words.map((w) => w.h));
  const byY = [...words].sort((a, b) => a.y - b.y);

  const lines: OcrWord[][] = [];
  let current: OcrWord[] = [];
  let lineTop = byY[0].y;

  for (const word of byY) {
    if (current.length === 0) {
      current.push(word);
      lineTop = word.y;
    } else if (word.y - lineTop > threshold) {
      lines.push(current);
      current = [word];
      lineTop = word.y;
    } else {
      current.push(word);
    }
  }
  if (current.length) lines.push(current);

  return lines
    .map((line) => tidyText([...line].sort((a, b) => a.x - b.x).map((w) => w.text).join(" ")))
    .filter(Boolean);
}

// All lines joined into one tidy string (rejoins hyphenation across line breaks).
function joinLines(words: OcrWord[]): string {
  return tidyText(groupIntoLines(words).join(" "));
}

// Title region → a single string (multi-line titles collapse to one line).
export function joinAsTitle(words: OcrWord[]): string {
  return joinLines(words);
}

// A multi-line region collapsed into one paragraph (e.g. directions = 1 step).
export function joinAsParagraph(words: OcrWord[]): string {
  return joinLines(words);
}

// Ingredients region → one array element per detected line.
export function linesFromWords(words: OcrWord[]): string[] {
  return groupIntoLines(words);
}
