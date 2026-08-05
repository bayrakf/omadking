/**
 * Turning recipe text into UI-ready lists. Pure functions, no React — so the
 * parsing rules can be checked by `demo()` instead of by eye in the simulator.
 */

export type GroceryItem = { id: string; name: string; detail: string | null; checked: boolean };
export type GroceryCategory = { name: string; emoji: string; items: GroceryItem[] };

type PlanLike = { recipe?: { ingredients?: unknown } };

export const CATEGORIES = [
  {
    name: 'Protein',
    emoji: '🥩',
    keywords: ['chicken', 'beef', 'steak', 'pork', 'salmon', 'tuna', 'cod', 'fish', 'tofu', 'tempeh', 'seitan', 'egg', 'whey', 'yogurt', 'yoghurt', 'skyr', 'quark', 'turkey', 'lamb', 'shrimp', 'prawn', 'mince', 'cottage cheese'],
  },
  {
    name: 'Vegetables & fruit',
    emoji: '🥦',
    keywords: ['broccoli', 'spinach', 'carrot', 'kale', 'lettuce', 'tomato', 'cucumber', 'pepper', 'onion', 'garlic', 'zucchini', 'courgette', 'asparagus', 'cauliflower', 'mushroom', 'cabbage', 'aubergine', 'eggplant', 'celery', 'leek', 'apple', 'banana', 'berry', 'berries', 'lemon', 'lime', 'orange', 'avocado', 'rocket', 'arugula'],
  },
  {
    name: 'Carbs',
    emoji: '🍠',
    keywords: ['sweet potato', 'potato', 'rice', 'oat', 'quinoa', 'pasta', 'noodle', 'bread', 'tortilla', 'bean', 'lentil', 'chickpea', 'corn', 'couscous', 'bulgur', 'barley'],
  },
  {
    name: 'Fats & dairy',
    emoji: '🥑',
    keywords: ['olive oil', 'coconut oil', 'butter', 'ghee', 'almond', 'walnut', 'peanut', 'cashew', 'pecan', 'chia', 'flax', 'hemp', 'cheese', 'bacon', 'cream', 'tahini', 'milk', 'oil'],
  },
  {
    name: 'Seasoning & pantry',
    emoji: '🧂',
    keywords: ['salt', 'pepper', 'cinnamon', 'paprika', 'cumin', 'oregano', 'basil', 'thyme', 'rosemary', 'soy sauce', 'vinegar', 'mustard', 'hot sauce', 'stock', 'broth', 'honey', 'herb', 'spice', 'chilli', 'chili', 'ginger', 'turmeric'],
  },
  {
    name: 'Supplements',
    emoji: '💊',
    keywords: ['electrolyte', 'magnesium', 'potassium', 'vitamin', 'creatine', 'omega', 'fish oil'],
  },
] as const;

const PANTRY_INDEX = CATEGORIES.findIndex((c) => c.name === 'Seasoning & pantry');

const UNIT = /^[\d.,/\s-]*(?:g|kg|ml|l|tbsp|tsp|cups?|oz|lb|cloves?|slices?|pieces?|handfuls?)?\b\.?\s*/i;

/**
 * Words that describe how something was prepared, not what it is.
 *
 * The quantity merging added earlier never fired on real data: "560g boneless
 * skinless chicken breast" and "480g raw boneless skinless chicken breast,
 * diced into 2cm cubes" produced different keys, so the shopping list carried
 * both and you bought chicken twice.
 *
 * The real risk here is the opposite one. Over-merging puts a confidently wrong
 * single line where two were correct, and that is harder to notice than a
 * duplicate. So this list holds only words that can never distinguish two
 * things you would buy separately — no ingredient names, no varieties, no
 * "sweet", no "greek".
 */
const PREP_WORDS = new Set([
  // state
  'raw', 'fresh', 'frozen', 'dried', 'cooked', 'uncooked', 'canned', 'tinned',
  // cuts and butchery
  'boneless', 'skinless', 'trimmed', 'peeled', 'cored', 'deseeded', 'pitted',
  // knife work
  'diced', 'chopped', 'sliced', 'minced', 'cubed', 'shredded', 'grated',
  'crushed', 'halved', 'quartered', 'julienned',
  // cooking
  'marinated', 'seasoned', 'steamed', 'roasted', 'grilled', 'baked', 'seared',
  'boiled', 'poached', 'toasted',
  // grade and packaging noise
  'organic', 'ripe', 'plain', 'unsweetened', 'unsalted', 'lean', 'quality',
  // form words that survive the cut
  'florets', 'fillet', 'fillets', 'breasts', 'pieces',
]);

/** Everything after these markers is preparation detail or an alternative. */
function coreOf(line: string): string {
  return line
    .split(',')[0]          // "chicken breast, diced into 2cm cubes"
    .split(/\s+or\s+/i)[0]  // "chicken breast or crispy tofu"
    .split('(')[0]          // "greek yogurt (0% fat)"
    .trim();
}

/** True when a whitespace token is preparation rather than identity. */
function isPrep(token: string): boolean {
  const parts = token.toLowerCase().replace(/[^a-z-]/g, '').split('-').filter(Boolean);
  return parts.length > 0 && parts.some((part) => PREP_WORDS.has(part));
}

/**
 * Splits a line into what you are buying and how it will be used.
 *
 * "480g raw boneless skinless chicken breast, diced into 2cm cubes" needed two
 * lines for the name alone, which nobody reads standing in a shop. The core is
 * what goes on the shelf label; the rest belongs underneath, quietly.
 *
 * Original casing and word order are kept — this is display text, not a key.
 */
export function splitDisplay(line: string): { core: string; detail: string | null } {
  const text = String(line ?? '').replace(UNIT, '').trim();
  if (!text) return { core: '', detail: null };

  // Everything past the first comma, " or " or bracket is already detail.
  const cut = text.search(/,|\s+or\s+|\(/i);
  const head = (cut === -1 ? text : text.slice(0, cut)).trim();
  const tail = (cut === -1 ? '' : text.slice(cut))
    .replace(/^[,(]\s*/, '')
    .replace(/^or\s+/i, '')
    .replace(/\)\s*$/, '')
    .trim();

  const core: string[] = [];
  const prep: string[] = [];
  for (const token of head.split(/\s+/)) {
    if (!token) continue;
    (isPrep(token) ? prep : core).push(token);
  }

  // A line that is nothing but preparation still needs a name.
  if (core.length === 0) return { core: head, detail: tail || null };

  const detail = [prep.join(' ').trim(), tail].filter(Boolean).join(', ');
  return { core: core.join(' '), detail: detail || null };
}

/**
 * The identity of a shop item: amount, preparation and alternatives removed.
 * If stripping everything would leave nothing, the original wins — a key is
 * worth more than a perfect key.
 */
export function dedupeKey(line: string): string {
  const base = coreOf(String(line ?? ''))
    .toLowerCase()
    .replace(UNIT, '')
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const kept: string[] = [];
  for (const token of base.split(' ')) {
    if (!token) continue;
    const parts = token.split('-').filter(Boolean);
    if (!parts.length) continue;
    // "herb-marinated" is preparation as a whole. Listing "herb" on its own
    // would be wrong — herbs are a real thing to buy — but a compound built
    // around a preparation word never names a different product.
    if (parts.some((part) => PREP_WORDS.has(part))) continue;
    kept.push(...parts);
  }

  const key = kept.join(' ').trim();
  // If stripping would leave nothing, keep the line's own words: a rough key
  // is worth more than none.
  return key || base.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Units we understand. `factor` converts to the canonical unit, so kilograms
 * and grams can be added together. Anything not listed here is left alone
 * rather than guessed at — a wrong conversion on a shopping list is worse than
 * two separate lines.
 */
const UNITS: Record<string, { canon: string; factor: number }> = {
  g: { canon: 'g', factor: 1 }, gr: { canon: 'g', factor: 1 },
  gram: { canon: 'g', factor: 1 }, grams: { canon: 'g', factor: 1 },
  kg: { canon: 'g', factor: 1000 }, kilo: { canon: 'g', factor: 1000 },
  kilos: { canon: 'g', factor: 1000 }, kilogram: { canon: 'g', factor: 1000 },
  kilograms: { canon: 'g', factor: 1000 },

  ml: { canon: 'ml', factor: 1 }, millilitre: { canon: 'ml', factor: 1 },
  millilitres: { canon: 'ml', factor: 1 }, milliliter: { canon: 'ml', factor: 1 },
  milliliters: { canon: 'ml', factor: 1 },
  l: { canon: 'ml', factor: 1000 }, litre: { canon: 'ml', factor: 1000 },
  litres: { canon: 'ml', factor: 1000 }, liter: { canon: 'ml', factor: 1000 },
  liters: { canon: 'ml', factor: 1000 },

  tbsp: { canon: 'tbsp', factor: 1 }, tablespoon: { canon: 'tbsp', factor: 1 },
  tablespoons: { canon: 'tbsp', factor: 1 },
  tsp: { canon: 'tsp', factor: 1 }, teaspoon: { canon: 'tsp', factor: 1 },
  teaspoons: { canon: 'tsp', factor: 1 },
  cup: { canon: 'cup', factor: 1 }, cups: { canon: 'cup', factor: 1 },
  clove: { canon: 'clove', factor: 1 }, cloves: { canon: 'clove', factor: 1 },
  slice: { canon: 'slice', factor: 1 }, slices: { canon: 'slice', factor: 1 },
  piece: { canon: 'piece', factor: 1 }, pieces: { canon: 'piece', factor: 1 },
  handful: { canon: 'handful', factor: 1 }, handfuls: { canon: 'handful', factor: 1 },
  oz: { canon: 'oz', factor: 1 }, lb: { canon: 'lb', factor: 1 }, lbs: { canon: 'lb', factor: 1 },
};

/** Units that never take a plural 's'. */
const INVARIANT = new Set(['tbsp', 'tsp', 'oz', 'lb']);

export type ParsedAmount = { value: number; canon: string; rest: string };

/**
 * Reads a leading amount off an ingredient line.
 *
 * A bare number is a count, not a unit: "2 eggs" is two eggs, so `eggs` stays
 * part of the ingredient. Returns null when the line has no amount at all
 * ("Sea salt, to taste"), which is the signal to leave that line untouched.
 */
export function parseAmount(line: string): ParsedAmount | null {
  const m = String(line ?? '').match(/^\s*(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?\.?\s*(.*)$/);
  if (!m) return null;

  const value = parseFloat(m[1].replace(',', '.'));
  if (!isFinite(value) || value <= 0) return null;

  const token = (m[2] ?? '').toLowerCase();
  const unit = UNITS[token];
  if (unit) return { value: value * unit.factor, canon: unit.canon, rest: m[3].trim() };

  // Not a unit we know — it belongs to the ingredient name.
  const rest = [m[2], m[3]].filter(Boolean).join(' ').trim();
  return rest ? { value, canon: 'count', rest } : null;
}

/** Drops meaningless trailing zeros: 1.50 -> 1.5, 720.0 -> 720. */
function tidy(n: number): string {
  return String(Math.round(n * 100) / 100);
}

/** Renders a summed amount back into a line a human would write. */
export function formatAmount(value: number, canon: string, rest: string): string {
  if (canon === 'g' || canon === 'ml') {
    const big = canon === 'g' ? 'kg' : 'l';
    // Only step up once it actually reads better: 1820g -> 1.82kg.
    return value >= 1000
      ? `${tidy(value / 1000)}${big} ${rest}`.trim()
      : `${tidy(value)}${canon} ${rest}`.trim();
  }
  if (canon === 'count') return `${tidy(value)} ${rest}`.trim();
  const unit = INVARIANT.has(canon) || value === 1 ? canon : `${canon}s`;
  return `${tidy(value)} ${unit} ${rest}`.trim();
}

/** Longest matching keyword wins, so "sweet potato" beats "potato". */
export function categorise(line: string): number {
  const lower = line.toLowerCase();
  let bestIdx = PANTRY_INDEX;
  let bestLen = 0;
  CATEGORIES.forEach((cat, idx) => {
    for (const kw of cat.keywords) {
      if (kw.length > bestLen && lower.includes(kw)) {
        bestLen = kw.length;
        bestIdx = idx;
      }
    }
  });
  return bestIdx;
}

/**
 * Builds the shopping list from real ingredient lines, keeping amounts.
 * The previous version keyword-matched the raw plan JSON and produced bare
 * words like "Chicken" with no quantity attached.
 */
export function buildGroceryList(
  plans: PlanLike[],
  checked: Record<string, boolean> = {}
): GroceryCategory[] {
  // Grouped by ingredient *and* unit: two plans measuring the same thing
  // differently (2 tbsp vs 30ml oil) stay as separate lines rather than being
  // silently mis-added.
  type Group = { key: string; canon: string; value: number; rest: string; raw: string };
  const groups = new Map<string, Group>();

  for (const plan of plans ?? []) {
    const ingredients = plan?.recipe?.ingredients;
    if (!Array.isArray(ingredients)) continue;
    for (const raw of ingredients) {
      if (typeof raw !== 'string') continue;
      const line = raw.trim();
      if (!line) continue;
      const key = dedupeKey(line);
      if (!key) continue;

      const amount = parseAmount(line);
      const canon = amount?.canon ?? 'none';
      const id = `${key}|${canon}`;
      const existing = groups.get(id);

      if (existing && amount) {
        existing.value += amount.value;
        // Keep the most informative wording: the first occurrence is often the
        // barest one, and dropping "diced into 2cm cubes" loses real guidance.
        if (!splitDisplay(existing.raw).detail && splitDisplay(line).detail) existing.raw = line;
      } else if (!existing) {
        groups.set(id, {
          key: id,
          canon,
          value: amount?.value ?? 0,
          rest: amount?.rest ?? '',
          raw: line,
        });
      }
      // An amount-less duplicate ("Sea salt, to taste" twice) needs no merging.
    }
  }

  const buckets: GroceryCategory[] = CATEGORIES.map((c) => ({ name: c.name, emoji: c.emoji, items: [] }));
  for (const g of groups.values()) {
    const display = splitDisplay(g.raw);
    const name =
      g.canon === 'none'
        ? display.core || g.raw
        : formatAmount(g.value, g.canon, display.core);
    // Fall back to the old plain-key tick so an existing list is not un-ticked
    // by this change.
    const wasChecked = checked[g.key] ?? checked[g.key.split('|')[0]];
    buckets[categorise(g.raw)].items.push({ id: g.key, name, detail: display.detail, checked: !!wasChecked });
  }

  return buckets
    .filter((b) => b.items.length > 0)
    .map((b) => ({ ...b, items: [...b.items].sort((a, z) => a.name.localeCompare(z.name)) }));
}

/**
 * Splits "1. Do this. 2. Do that." into steps.
 * The old regex split on every ". ", which cut "heat at 800W for 2.5 mins"
 * in half and produced fragments like "5 mins" as their own step.
 */
export function splitSteps(text: string | null | undefined): string[] {
  const raw = (text ?? '').trim();
  if (!raw) return [];

  const numbered = raw
    .split(/(?:^|\s)\d{1,2}[.)]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (numbered.length > 1) return numbered;

  return raw
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  // Amounts survive, and the same ingredient across plans appears once.
  const list = buildGroceryList([
    { recipe: { ingredients: ['320g chicken breast', '350g sweet potato', '2 tbsp olive oil'] } },
    { recipe: { ingredients: ['400g chicken breast', '250g broccoli'] } },
  ]);
  const all = list.flatMap((c) => c.items.map((i) => i.name));
  assert(all.filter((n) => n.toLowerCase().includes('chicken breast')).length === 1, 'duplicates merge across plans');
  // The whole point: 320g + 400g is 720g, not 320g.
  assert(all.some((n) => n.startsWith('720g')), `amounts are summed, got: ${all.join(' | ')}`);
  assert(all.length === 4, `four distinct items, got ${all.length}: ${all.join(' | ')}`);

  // Longest-keyword wins.
  assert(CATEGORIES[categorise('350g sweet potato')].name === 'Carbs', 'sweet potato is a carb');
  assert(CATEGORIES[categorise('2 tbsp olive oil')].name === 'Fats & dairy', 'olive oil is a fat');
  assert(CATEGORIES[categorise('320g chicken breast')].name === 'Protein', 'chicken is protein');
  assert(CATEGORIES[categorise('1 tsp smoked paprika')].name === 'Seasoning & pantry', 'paprika is pantry');
  // "cottage cheese" (14) must beat "cheese" (6) even though both match.
  assert(CATEGORIES[categorise('200g cottage cheese')].name === 'Protein', 'cottage cheese is protein, not dairy fat');

  // Unknown ingredients land in pantry rather than being dropped.
  const odd = buildGroceryList([{ recipe: { ingredients: ['1 packet of nori sheets'] } }]);
  assert(odd.flatMap((c) => c.items).length === 1, 'unrecognised ingredient still listed');

  // Malformed plans must not throw.
  assert(buildGroceryList([{}, { recipe: {} }, null as any]).length === 0, 'malformed plans yield empty list');
  assert(buildGroceryList([{ recipe: { ingredients: [null, 42, '', '  '] } } as any]).length === 0, 'junk entries skipped');

  // Checked state carries through by key.
  const checkedList = buildGroceryList(
    [{ recipe: { ingredients: ['320g chicken breast'] } }],
    { 'chicken breast': true }
  );
  assert(checkedList[0].items[0].checked === true, 'checked state restores by normalised key');

  // Steps.
  const steps = splitSteps('1. Sear the protein. 2. Microwave at 800W for 2.5 mins. 3. Serve.');
  assert(steps.length === 3, `numbered split gives 3 steps, got ${steps.length}`);
  assert(steps[1].includes('2.5 mins'), 'decimal inside a step is not split');

  const sentences = splitSteps('Sear the protein. Rest it for 5 minutes. Serve hot.');
  assert(sentences.length === 3, 'unnumbered text splits on sentences');

  assert(splitSteps('').length === 0, 'empty text yields no steps');
  assert(splitSteps(null).length === 0, 'null text yields no steps');
  assert(splitSteps('Just one instruction').length === 1, 'single step stays single');

  // --- amounts -------------------------------------------------------------

  const amount = (s: string) => parseAmount(s);
  assert(amount('320g chicken breast')?.value === 320, 'grams parse');
  assert(amount('1.5 kg beef')?.value === 1500, 'kilograms convert to grams');
  assert(amount('1,5 kg beef')?.value === 1500, 'a decimal comma parses too');
  assert(amount('250 ml milk')?.value === 250, 'millilitres parse');
  assert(amount('2 l water')?.value === 2000, 'litres convert to millilitres');
  assert(amount('2 tbsp olive oil')?.canon === 'tbsp', 'spoons keep their own unit');
  assert(amount('320g chicken breast')?.rest === 'chicken breast', 'the ingredient survives the amount');

  // A bare number counts the item; the next word is not a unit.
  const eggs = amount('2 eggs');
  assert(eggs?.canon === 'count' && eggs.rest === 'eggs', 'a bare number is a count, not a unit');

  // No amount at all is the signal to leave a line alone.
  assert(amount('Sea salt, to taste') === null, 'an amount-less line parses to null');
  assert(amount('Olive oil as needed') === null, 'vague quantities are not invented');
  assert(amount('') === null, 'an empty line has no amount');

  // Formatting steps up only when it reads better.
  assert(formatAmount(720, 'g', 'chicken breast') === '720g chicken breast', 'grams stay grams');
  assert(formatAmount(1820, 'g', 'beef') === '1.82kg beef', 'a kilo and more reads as kg');
  assert(formatAmount(1000, 'ml', 'water') === '1l water', 'a litre reads as l');
  assert(formatAmount(2, 'tbsp', 'olive oil') === '2 tbsp olive oil', 'tbsp never pluralises');
  assert(formatAmount(1, 'clove', 'garlic') === '1 clove garlic', 'one clove stays singular');
  assert(formatAmount(3, 'clove', 'garlic') === '3 cloves garlic', 'three become cloves');
  assert(formatAmount(5, 'count', 'eggs') === '5 eggs', 'a count needs no unit word');

  // --- summing across plans ------------------------------------------------

  const named = (plans: any[]) =>
    buildGroceryList(plans).flatMap((c) => c.items.map((i) => i.name));

  // Mixed units for the same ingredient must NOT be added together.
  const mixed = named([
    { recipe: { ingredients: ['2 tbsp olive oil'] } },
    { recipe: { ingredients: ['30ml olive oil'] } },
  ]);
  assert(mixed.length === 2, `incompatible units stay separate, got: ${mixed.join(' | ')}`);

  // Compatible units are reconciled before adding.
  const compatible = named([
    { recipe: { ingredients: ['800g beef'] } },
    { recipe: { ingredients: ['1.2 kg beef'] } },
  ]);
  assert(compatible.length === 1 && compatible[0] === '2kg beef', `kg and g add up, got: ${compatible.join(' | ')}`);

  // Counts add up.
  const counted = named([
    { recipe: { ingredients: ['2 eggs'] } },
    { recipe: { ingredients: ['3 eggs'] } },
  ]);
  assert(counted.length === 1 && counted[0] === '5 eggs', `counts add up, got: ${counted.join(' | ')}`);

  // Amount-less duplicates collapse to one line and keep their wording.
  const vague = named([
    { recipe: { ingredients: ['Sea salt, to taste'] } },
    { recipe: { ingredients: ['Sea salt, to taste'] } },
  ]);
  assert(vague.length === 1 && vague[0] === 'Sea salt', `an amount-less line keeps its name, got: ${vague.join(' | ')}`);

  // Three plans, so summing is not a two-item special case.
  const three = named([
    { recipe: { ingredients: ['100g oats'] } },
    { recipe: { ingredients: ['150g oats'] } },
    { recipe: { ingredients: ['200g oats'] } },
  ]);
  assert(three.length === 1 && three[0] === '450g oats', `three plans sum, got: ${three.join(' | ')}`);

  // --- display split -------------------------------------------------------

  const long = splitDisplay('480g raw boneless skinless chicken breast, diced into 2cm cubes');
  assert(long.core === 'chicken breast', `the core is what you buy, got: ${long.core}`);
  assert(long.detail === 'raw boneless skinless, diced into 2cm cubes', `the rest is detail, got: ${long.detail}`);

  const alt = splitDisplay('293g Herb-Marinated Chicken Breast or Crispy Tofu');
  assert(alt.core === 'Chicken Breast', `casing is preserved for display, got: ${alt.core}`);
  assert(!!alt.detail?.includes('Crispy Tofu'), `the alternative is kept as detail, got: ${alt.detail}`);

  const plainLine = splitDisplay('250g broccoli');
  assert(plainLine.core === 'broccoli' && plainLine.detail === null, 'a plain line has no detail');

  const vagueLine = splitDisplay('Sea salt, to taste');
  assert(vagueLine.core === 'Sea salt' && vagueLine.detail === 'to taste', `vague lines split too, got: ${JSON.stringify(vagueLine)}`);

  // Nothing but preparation must still produce a name rather than an empty row.
  const allPrep = splitDisplay('300g diced');
  assert(allPrep.core.length > 0, 'an all-preparation line still shows something');
  assert(splitDisplay('').core === '', 'an empty line splits to nothing');

  // A later, richer line wins the detail; the barest one usually comes first.
  const richer = buildGroceryList([
    { recipe: { ingredients: ['320g chicken breast'] } },
    { recipe: { ingredients: ['400g raw chicken breast, diced into 2cm cubes'] } },
  ]);
  const merged = richer[0].items[0];
  assert(merged.name === '720g chicken breast', `amounts still sum, got: ${merged.name}`);
  assert(!!merged.detail?.includes('diced into 2cm cubes'), `the richer detail survives, got: ${merged.detail}`);

  // The detail never swallows the amount.
  const amounts = buildGroceryList([{ recipe: { ingredients: ['480g raw chicken breast, diced'] } }]);
  assert(amounts[0].items[0].name.startsWith('480g'), `the amount stays on the name, got: ${amounts[0].items[0].name}`);
  assert(!amounts[0].items[0].detail?.includes('480'), 'the amount is not repeated in the detail');

  // --- preparation words ---------------------------------------------------

  // The three lines that shipped as three separate items on a real list.
  const chicken = named([
    { recipe: { ingredients: ['560g boneless skinless chicken breast'] } },
    { recipe: { ingredients: ['480g raw boneless skinless chicken breast, diced into 2cm cubes'] } },
    { recipe: { ingredients: ['293g Herb-Marinated Chicken Breast or Crispy Tofu'] } },
  ]);
  assert(chicken.length === 1, `preparation words no longer split an item, got: ${chicken.join(' | ')}`);
  assert(chicken[0].startsWith('1.33kg'), `and the amounts add up, got: ${chicken[0]}`);

  assert(dedupeKey('480g raw boneless skinless chicken breast, diced into 2cm cubes') === 'chicken breast', 'the key is the item itself');
  assert(
    dedupeKey('293g Herb-Marinated Chicken Breast or Crispy Tofu') === 'chicken breast',
    `a hyphenated preparation compound drops whole, got: ${dedupeKey('293g Herb-Marinated Chicken Breast or Crispy Tofu')}`
  );
  // ...but the ingredient itself must survive when it stands alone.
  assert(dedupeKey('20g fresh herbs') === 'herbs', `herbs are still buyable, got: ${dedupeKey('20g fresh herbs')}`);

  // --- and the guard that matters more: things that must NOT merge ---------

  const mustDiffer: [string, string][] = [
    ['350g sweet potato', '350g potato'],
    ['300g chicken breast', '300g chicken thigh'],
    ['30ml olive oil', '30ml coconut oil'],
    ['200g greek yogurt', '200g yogurt'],
    ['100g brown rice', '100g white rice'],
    ['2 egg whites', '2 eggs'],
    ['150g salmon fillet', '150g cod fillet'],
  ];
  for (const [a, b] of mustDiffer) {
    assert(
      dedupeKey(a) !== dedupeKey(b),
      `"${a}" and "${b}" must stay separate, both keyed as "${dedupeKey(a)}"`
    );
    const pair = named([{ recipe: { ingredients: [a] } }, { recipe: { ingredients: [b] } }]);
    assert(pair.length === 2, `"${a}" and "${b}" produce two lines, got: ${pair.join(' | ')}`);
  }

  // Stripping everything must still leave a usable key.
  assert(dedupeKey('300g diced raw') !== '', 'an all-preparation line still keys to something');
  assert(dedupeKey('') === '', 'an empty line keys to nothing');

  return 'grocery.ts: all checks passed';
}
