/**
 * Turning recipe text into UI-ready lists. Pure functions, no React — so the
 * parsing rules can be checked by `demo()` instead of by eye in the simulator.
 */

export type GroceryItem = { id: string; name: string; checked: boolean };
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

/** Strips leading amounts so "320g chicken breast" and "400g chicken breast" merge. */
export function dedupeKey(line: string): string {
  return line
    .toLowerCase()
    .replace(UNIT, '')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
    const name = g.canon === 'none' ? g.raw : formatAmount(g.value, g.canon, g.rest);
    // Fall back to the old plain-key tick so an existing list is not un-ticked
    // by this change.
    const wasChecked = checked[g.key] ?? checked[g.key.split('|')[0]];
    buckets[categorise(g.raw)].items.push({ id: g.key, name, checked: !!wasChecked });
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
  assert(vague.length === 1 && vague[0] === 'Sea salt, to taste', `vague lines survive intact, got: ${vague.join(' | ')}`);

  // Three plans, so summing is not a two-item special case.
  const three = named([
    { recipe: { ingredients: ['100g oats'] } },
    { recipe: { ingredients: ['150g oats'] } },
    { recipe: { ingredients: ['200g oats'] } },
  ]);
  assert(three.length === 1 && three[0] === '450g oats', `three plans sum, got: ${three.join(' | ')}`);

  return 'grocery.ts: all checks passed';
}
