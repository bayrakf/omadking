/**
 * A very small Markdown parser, for one job: rendering what a chat model
 * writes back.
 *
 * The coach answers in Markdown and the app was printing it verbatim, so users
 * saw `**sodium, potassium, and magnesium**` and `* **Sodium:** 3,000-5,000 mg`
 * on screen. That is a missing renderer, not a styling problem.
 *
 * Deliberately not a Markdown library. A model produces a narrow subset —
 * paragraphs, bullets, numbered steps, bold, the occasional heading — and a
 * parser small enough to read is worth more here than full CommonMark. Anything
 * it does not recognise survives as plain text rather than disappearing, which
 * is the property that matters: a user must never lose content to the renderer.
 */

export type Span =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string };

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3; spans: Span[] }
  | { type: 'paragraph'; spans: Span[] }
  | { type: 'bullet'; spans: Span[] }
  | { type: 'ordered'; index: number; spans: Span[] };

/** Guards against a pathological reply locking up the render. */
const MAX_BLOCKS = 200;
const MAX_LEN = 20000;

/**
 * Inline spans. Order matters: code first, so `**` inside backticks is left
 * alone, then bold before italic, so `**x**` is not read as two italics.
 */
export function parseInline(input: string): Span[] {
  const text = String(input ?? '');
  if (!text) return [];

  const pattern = /(`[^`\n]+`)|(\*\*(?!\s)([^*]+?)\*\*)|(__(?!\s)([^_]+?)__)|(\*(?!\s)([^*\n]+?)\*)|(_(?!\s)([^_\n]+?)_)/;
  const spans: Span[] = [];
  let rest = text;

  while (rest) {
    const m = rest.match(pattern);
    if (!m || m.index === undefined) break;

    if (m.index > 0) spans.push({ type: 'text', text: rest.slice(0, m.index) });

    if (m[1]) spans.push({ type: 'code', text: m[1].slice(1, -1) });
    else if (m[2]) spans.push({ type: 'bold', text: m[3] });
    else if (m[4]) spans.push({ type: 'bold', text: m[5] });
    else if (m[6]) spans.push({ type: 'italic', text: m[7] });
    else if (m[8]) spans.push({ type: 'italic', text: m[9] });

    rest = rest.slice(m.index + m[0].length);
  }

  if (rest) spans.push({ type: 'text', text: rest });
  // An unmatched marker means the text was never markup — keep it as written.
  return spans.length ? spans : [{ type: 'text', text }];
}

export function parseMarkdown(input: string): Block[] {
  const source = String(input ?? '').slice(0, MAX_LEN);
  if (!source.trim()) return [];

  const blocks: Block[] = [];
  let paragraph: string[] = [];

  const flush = () => {
    if (!paragraph.length) return;
    const joined = paragraph.join(' ').trim();
    if (joined) blocks.push({ type: 'paragraph', spans: parseInline(joined) });
    paragraph = [];
  };

  for (const raw of source.split(/\r?\n/)) {
    if (blocks.length >= MAX_BLOCKS) break;
    const line = raw.trim();

    if (!line) {
      flush();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.*)$/);
    if (heading) {
      flush();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3,
        spans: parseInline(heading[2]),
      });
      continue;
    }

    // A horizontal rule carries no content here; dropping it is not data loss.
    if (/^(\*\s*){3,}$|^(-\s*){3,}$|^(_\s*){3,}$/.test(line)) {
      flush();
      continue;
    }

    const bullet = line.match(/^[-*+]\s+(.*)$/);
    if (bullet) {
      flush();
      blocks.push({ type: 'bullet', spans: parseInline(bullet[1]) });
      continue;
    }

    const ordered = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
    if (ordered) {
      flush();
      blocks.push({ type: 'ordered', index: Number(ordered[1]), spans: parseInline(ordered[2]) });
      continue;
    }

    paragraph.push(line);
  }

  flush();
  return blocks;
}

/** The visible text, markup removed. Used by checks and accessibility labels. */
export function plainText(blocks: Block[]): string {
  return blocks
    .map((b) => b.spans.map((s) => s.text).join(''))
    .join('\n')
    .trim();
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  // The exact shape that was showing raw on screen.
  const real = parseMarkdown(
    'The best electrolytes are plain **sodium, potassium, and magnesium**.\n' +
      '\n' +
      'Target these daily amounts:\n' +
      '* **Sodium:** 3,000-5,000 mg\n' +
      '* **Potassium:** 1,000-2,000 mg\n' +
      '\n' +
      '**Why:** Fasting lowers insulin.'
  );
  assert(real.filter((b) => b.type === 'bullet').length === 2, 'both bullets are recognised');
  assert(real.filter((b) => b.type === 'paragraph').length === 3, 'three paragraphs remain');
  assert(!plainText(real).includes('**'), 'no literal asterisks survive');
  assert(!plainText(real).includes('* '), 'no literal bullet markers survive');
  assert(plainText(real).includes('sodium, potassium, and magnesium'), 'the words themselves survive');

  // Bold, not two italics.
  const bold = parseInline('**hard**');
  assert(bold.length === 1 && bold[0].type === 'bold' && bold[0].text === 'hard', 'double asterisks are bold');
  const italic = parseInline('*soft*');
  assert(italic[0].type === 'italic', 'single asterisks are italic');

  // A label followed by prose keeps both halves.
  const mixed = parseInline('**Sodium:** 3,000-5,000 mg');
  assert(mixed[0].type === 'bold' && mixed[0].text === 'Sodium:', 'the label is bold');
  assert(mixed[1].type === 'text' && mixed[1].text.includes('3,000'), 'the value stays text');

  // Backticks win, so markup inside code is not eaten.
  const code = parseInline('use `a ** b` here');
  assert(code.some((s) => s.type === 'code' && s.text === 'a ** b'), 'code spans are left intact');

  // Nothing is lost when the markup is broken.
  const unbalanced = parseInline('an **unclosed bold');
  assert(plainText([{ type: 'paragraph', spans: unbalanced }]) === 'an **unclosed bold', 'unbalanced markup survives verbatim');
  const lonely = parseInline('2 * 3 = 6');
  assert(plainText([{ type: 'paragraph', spans: lonely }]) === '2 * 3 = 6', 'a stray asterisk is not markup');
  assert(parseInline('**  **')[0].type === 'text', 'markers around whitespace are not emphasis');

  // Headings and numbered steps.
  const h = parseMarkdown('## Electrolytes\ntext');
  assert(h[0].type === 'heading' && h[0].level === 2, 'a heading is a heading');
  const steps = parseMarkdown('1. Season it\n2. Roast it');
  assert(steps.length === 2 && steps.every((b) => b.type === 'ordered'), 'numbered steps are ordered items');
  assert(steps[1].type === 'ordered' && steps[1].index === 2, 'the number is kept');

  // Wrapped prose rejoins; a blank line separates.
  const wrapped = parseMarkdown('one line\ncontinued here\n\nsecond para');
  assert(wrapped.length === 2, `soft wraps rejoin, got ${wrapped.length}`);
  assert(wrapped[0].spans[0].text === 'one line continued here', 'the join inserts a space');

  // A rule carries no content.
  assert(parseMarkdown('a\n\n---\n\nb').length === 2, 'a horizontal rule is dropped, not rendered');

  // Degenerate input must not throw.
  assert(parseMarkdown('').length === 0, 'empty input yields no blocks');
  assert(parseMarkdown('   \n  \n').length === 0, 'whitespace yields no blocks');
  assert(parseMarkdown(null as any).length === 0, 'null does not throw');
  assert(parseInline('').length === 0, 'empty inline yields no spans');

  // Pathological input is bounded rather than hanging the render.
  const huge = parseMarkdown(Array.from({ length: 1000 }, (_, i) => `* item ${i}`).join('\n'));
  assert(huge.length <= 200, `block count is capped, got ${huge.length}`);
  const long = parseMarkdown('*'.repeat(5000));
  assert(Array.isArray(long), 'a wall of asterisks still returns');

  return 'markdown.ts: all checks passed';
}
