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
  const seen = new Map<string, string>();

  for (const plan of plans ?? []) {
    const ingredients = plan?.recipe?.ingredients;
    if (!Array.isArray(ingredients)) continue;
    for (const raw of ingredients) {
      if (typeof raw !== 'string') continue;
      const line = raw.trim();
      if (!line) continue;
      const key = dedupeKey(line);
      if (!key || seen.has(key)) continue;
      seen.set(key, line);
    }
  }

  const buckets: GroceryCategory[] = CATEGORIES.map((c) => ({ name: c.name, emoji: c.emoji, items: [] }));
  for (const [key, line] of seen) {
    buckets[categorise(line)].items.push({ id: key, name: line, checked: !!checked[key] });
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
  assert(all.some((n) => n.includes('320g')), 'amounts are preserved');
  assert(all.filter((n) => n.toLowerCase().includes('chicken breast')).length === 1, 'duplicates merge across plans');
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

  return 'grocery.ts: all checks passed';
}
