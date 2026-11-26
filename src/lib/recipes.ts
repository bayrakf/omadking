import {
  DEFAULT_PROFILE,
  dailyTargets,
  mealTiming,
  type AdaptiveMode,
  type Goal,
  type Macros,
  type Training,
  type UserProfile,
} from './nutrition';
import { buildGroceryList } from './grocery';
import type { Lang } from './i18n';

export type RecipeTier = 'standard' | 'premium';
export type RecipeSource = 'standard' | 'premium';
export type MealComplexity = 'quick' | 'balanced' | 'chef';
export type DietaryTag = 'meat' | 'poultry' | 'fish' | 'dairy' | 'eggs' | 'nuts' | 'gluten' | 'soy' | 'spicy';
export type VolumeProfile = 'compact' | 'normal' | 'high_volume';

export type Recipe = {
  id?: string;
  title: string;
  ingredients: string[];
  instructions: string;
  reheat_instructions: string | null;
  prep_time_min: number;
  is_meal_prep: boolean;
};

export type RecipeEnergyContext = {
  mode?: AdaptiveMode;
  plateauStalled?: boolean;
  dietBreakDue?: boolean;
  proteinAdherenceLow?: boolean;
  budgetDeficitActive?: boolean;
  adjustedTargets?: Macros;
};

export type MealPlan = {
  date: string;
  eating_window_start: string;
  eating_window_end: string;
  total_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  pre_training_snack_time: string | null;
  main_meal_time: string;
  ai_reasoning: string;
  timing_warning: string | null;
  training_burn_kcal: number;
  recipe_source: RecipeSource;
  recipe_note: string | null;
  timing_pattern: 'pre' | 'post' | 'overlap';
  training_start_time: string | null;
  training_duration_min: number;
  complexity: MealComplexity;
  recipe: Recipe;
};

export type RecipeTemplate = {
  id: string;
  tier: RecipeTier;
  complexity: MealComplexity;
  title: { de: string; en: string };
  prep_time_min: number;
  is_meal_prep: boolean;
  tags: DietaryTag[];
  volume: VolumeProfile;
  fitGoals: Goal[];
  carbFocus: 'high' | 'moderate' | 'low';
  highProteinEfficiency?: boolean;
  proteinSpec: {
    name: { de: string; en: string };
    proteinPer100g: number;
    fatPer100g: number;
    carbsPer100g: number;
    minG: number;
    maxG: number;
  };
  carbSpec: {
    name: { de: string; en: string };
    carbsPer100g: number;
    proteinPer100g: number;
    fatPer100g: number;
    dryRatio?: number;
    minG: number;
    maxG: number;
  };
  fatSpec: {
    name: { de: string; en: string };
    fatPer100g: number;
    unit?: 'ml' | 'g';
    minG: number;
    maxG: number;
  };
  extraIngredients: { de: string[]; en: string[] };
  instructions: { de: string; en: string };
  reheat: { de: string; en: string };
};

export const STANDARD_TEMPLATES: RecipeTemplate[] = [
  {
    id: 'std-chicken-rice',
    tier: 'standard',
    complexity: 'quick',
    title: { de: 'Zitronen-Hähnchenbrust mit Jasminreis & Brokkoli', en: 'Lemon Chicken Breast with Jasmine Rice & Broccoli' },
    prep_time_min: 15,
    is_meal_prep: true,
    tags: ['poultry'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Hähnchenbrust (Rohgewicht)', en: 'chicken breast (raw)' }, proteinPer100g: 23, fatPer100g: 1.5, carbsPer100g: 0, minG: 160, maxG: 700 },
    carbSpec: { name: { de: 'Jasminreis (gekocht)', en: 'cooked jasmine rice' }, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, dryRatio: 2.5, minG: 120, maxG: 900 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 60 },
    extraIngredients: {
      de: ['250g Brokkoli in Röschen', '1 TL Meersalz, Knoblauch & frische Zitrone'],
      en: ['250g broccoli florets', '1 tsp sea salt, garlic & fresh lemon'],
    },
    instructions: {
      de: '1. Hähnchen würfeln, mit Salz und Knoblauch würzen und 5 Min. in heißer Pfanne goldbraun braten. 2. Brokkoli die letzten 4 Min. mitdünsten. 3. Mit heißem Jasminreis anrichten und Zitrone sowie Olivenöl darüber geben.',
      en: '1. Cube chicken, season with salt and garlic, sear 5 min per side until golden. 2. Steam broccoli with a splash of water for the last 4 min. 3. Plate over hot jasmine rice and finish with olive oil and fresh lemon.',
    },
    reheat: {
      de: 'Pfanne: 3 Min. bei mittlerer Hitze mit 1 EL Wasser aufdampfen; Mikrowelle abgedeckt 2,5 Min. bei 800W.',
      en: 'Skillet: 3 min over medium heat with 1 tbsp water; microwave covered 2.5 min at 800W.',
    },
  },
  {
    id: 'std-salmon-potato',
    tier: 'standard',
    complexity: 'balanced',
    title: { de: 'Lachsfilet aus dem Ofen mit Süßkartoffel & Blattspinat', en: 'Baked Salmon with Sweet Potato & Spinach' },
    prep_time_min: 28,
    is_meal_prep: true,
    tags: ['fish'],
    volume: 'normal',
    fitGoals: ['performance', 'weight_loss', 'muscle_gain'],
    carbFocus: 'moderate',
    proteinSpec: { name: { de: 'Lachsfilet (Rohgewicht)', en: 'salmon fillet (raw)' }, proteinPer100g: 20, fatPer100g: 13, carbsPer100g: 0, minG: 160, maxG: 650 },
    carbSpec: { name: { de: 'Süßkartoffeln', en: 'sweet potato' }, carbsPer100g: 20, proteinPer100g: 1.6, fatPer100g: 0.1, minG: 150, maxG: 900 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 5, maxG: 45 },
    extraIngredients: {
      de: ['200g frischer Blattspinat', '1 TL Meersalz, Rosmarin & schwarzer Pfeffer'],
      en: ['200g fresh baby spinach', '1 tsp sea salt, rosemary & black pepper'],
    },
    instructions: {
      de: '1. Süßkartoffel würfeln, mit Olivenöl und Rosmarin 22 Min. bei 200°C rösten. 2. Lachs würzen und die letzten 12 Min. mit in den Ofen legen. 3. Spinat in der warmen Restwärme zusammenfallen lassen.',
      en: '1. Cube sweet potato, toss with oil and rosemary, roast at 200°C for 22 min. 2. Season salmon and bake alongside for the final 12 min. 3. Fold spinach into the hot tray until wilted.',
    },
    reheat: {
      de: 'Heißluftfritteuse 170°C 4 Min. für Lachs; Pfanne hält den Spinat saftig.',
      en: 'Air fryer 170°C for 4 min keeps the skin crisp without drying.',
    },
  },
  {
    id: 'std-beef-potato',
    tier: 'standard',
    complexity: 'quick',
    title: { de: 'Mageres Rinderhack mit Ofenkartoffeln & grünen Bohnen', en: 'Lean Beef Skillet with Crispy Potatoes & Green Beans' },
    prep_time_min: 22,
    is_meal_prep: true,
    tags: ['meat'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    proteinSpec: { name: { de: 'Rinderhack (max. 5% Fett)', en: 'extra-lean ground beef' }, proteinPer100g: 21, fatPer100g: 5, carbsPer100g: 0, minG: 160, maxG: 750 },
    carbSpec: { name: { de: 'festkochende Kartoffeln', en: 'waxy potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 200, maxG: 1100 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 55 },
    extraIngredients: {
      de: ['220g grüne Bohnen', '1 TL Paprika edelsüß, Knoblauch & Meersalz'],
      en: ['220g green beans', '1 tsp smoked paprika, garlic & sea salt'],
    },
    instructions: {
      de: '1. Kartoffelwürfel 20 Min. knusprig anbraten oder im Airfryer backen. 2. Rinderhack krümelig scharf anbraten, Bohnen 5 Min. mitschwenken und würzen.',
      en: '1. Crisp diced potatoes in air fryer or skillet for 20 min. 2. Brown ground beef with garlic and paprika, toss green beans for 5 min.',
    },
    reheat: {
      de: 'In beschichteter Pfanne 4 Min. bei mittlerer Hitze schwenken.',
      en: 'Reheat in skillet for 4 min over medium heat.',
    },
  },
  {
    id: 'std-turkey-quinoa',
    tier: 'standard',
    complexity: 'quick',
    title: { de: 'Putenbrust-Sättigungsbowl mit Quinoa & Zucchini', en: 'Turkey High-Satiety Bowl with Quinoa & Zucchini' },
    prep_time_min: 15,
    is_meal_prep: true,
    tags: ['poultry'],
    volume: 'high_volume',
    fitGoals: ['weight_loss', 'performance'],
    carbFocus: 'moderate',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Putenbrustfilet (Rohgewicht)', en: 'turkey breast (raw)' }, proteinPer100g: 24, fatPer100g: 1, carbsPer100g: 0, minG: 160, maxG: 700 },
    carbSpec: { name: { de: 'Quinoa (gekocht)', en: 'cooked quinoa' }, carbsPer100g: 21, proteinPer100g: 4.4, fatPer100g: 1.9, dryRatio: 2.8, minG: 100, maxG: 750 },
    fatSpec: { name: { de: 'Avocado oder Olivenöl', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 50 },
    extraIngredients: {
      de: ['300g Zucchini & Rucola', '1 TL Meersalz, Kräuter & Zitronensaft'],
      en: ['300g zucchini & arugula', '1 tsp sea salt, herbs & lemon juice'],
    },
    instructions: {
      de: '1. Putenstreifen scharf anbraten, gewürfelte Zucchini zugeben und bissfest garen. 2. Mit gekochter Quinoa und Rucola vermengen, Olivenöl drüberträufeln.',
      en: '1. Sear turkey strips, add diced zucchini until tender-crisp. 2. Fold over cooked quinoa and arugula with olive oil and lemon.',
    },
    reheat: {
      de: 'Kalt als Protein-Salat essbar oder 2 Min. in Pfanne wärmen.',
      en: 'Great cold or lightly warmed in skillet for 2 min.',
    },
  },
  {
    id: 'std-tofu-wok',
    tier: 'standard',
    complexity: 'balanced',
    title: { de: 'Knuspriger Sesam-Tofu mit Basmatireis & Pak Choi', en: 'Crispy Sesame Tofu with Basmati Rice & Pak Choi' },
    prep_time_min: 22,
    is_meal_prep: true,
    tags: ['soy'],
    volume: 'high_volume',
    fitGoals: ['weight_loss', 'performance', 'muscle_gain'],
    carbFocus: 'moderate',
    proteinSpec: { name: { de: 'fester Naturtofu', en: 'extra-firm tofu' }, proteinPer100g: 15, fatPer100g: 8, carbsPer100g: 2, minG: 200, maxG: 800 },
    carbSpec: { name: { de: 'Basmatireis (gekocht)', en: 'cooked basmati rice' }, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, dryRatio: 2.5, minG: 120, maxG: 850 },
    fatSpec: { name: { de: 'Sesamöl / Rapsöl', en: 'sesame & olive oil' }, fatPer100g: 100, unit: 'ml', minG: 8, maxG: 45 },
    extraIngredients: {
      de: ['250g Pak Choi & Champignons', 'Tamari (glutenfrei), Ingwer & Knoblauch'],
      en: ['250g bok choy & mushrooms', 'Gluten-free tamari, ginger & garlic'],
    },
    instructions: {
      de: '1. Tofu trocken tupfen, würfeln und mit Öl 8 Min. kross braten. 2. Pak Choi, Pilze und Ingwer 4 Min. im Wok schwenken. 3. Auf heißem Basmatireis servieren.',
      en: '1. Press tofu dry, cube and sear 8 min until crisp. 2. Stir-fry bok choy, mushrooms and ginger for 4 min. 3. Serve over basmati rice with tamari.',
    },
    reheat: {
      de: 'Im Airfryer bei 190°C 4 Min. wieder knusprig machen.',
      en: 'Re-crisp in air fryer at 190°C for 4 min.',
    },
  },
  {
    id: 'std-eggs-skyr',
    tier: 'standard',
    complexity: 'quick',
    title: { de: 'Kräuter-Rührei & Röstkartoffeln mit Protein-Skyr', en: 'Herb Eggs & Crispy Potatoes with High-Protein Yogurt' },
    prep_time_min: 14,
    is_meal_prep: false,
    tags: ['eggs', 'dairy'],
    volume: 'normal',
    fitGoals: ['weight_loss', 'muscle_gain'],
    carbFocus: 'moderate',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Magerquark / Skyr + 3 Eier', en: 'Greek skyr + 3 eggs' }, proteinPer100g: 11, fatPer100g: 2, carbsPer100g: 4, minG: 250, maxG: 900 },
    carbSpec: { name: { de: 'Ofenkartoffeln (gewürfelt)', en: 'diced roasted potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 150, maxG: 900 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 8, maxG: 45 },
    extraIngredients: {
      de: ['200g Cherrytomaten & Spinat', 'Schnittlauch, Meersalz & Pfeffer'],
      en: ['200g cherry tomatoes & spinach', 'Chives, sea salt & black pepper'],
    },
    instructions: {
      de: '1. Kartoffelwürfel im Öl goldbraun braten. 2. Eier direkt in die Pfanne zu Spinat & Tomaten rühren. 3. Mit Schnittlauch-Skyr kalt oder lauwarm servieren.',
      en: '1. Crisp diced potatoes in olive oil. 2. Scramble eggs right into the skillet with tomatoes and spinach. 3. Serve alongside seasoned herb skyr.',
    },
    reheat: {
      de: 'Frisch in 14 Min. zubereitet — am besten direkt genießen.',
      en: 'Best cooked fresh in 14 min.',
    },
  },
  {
    id: 'std-chickpea-buckwheat',
    tier: 'standard',
    complexity: 'quick',
    title: { de: 'Kichererbsen-Buchweizen-Pfanne mit Röstgemüse & Hanfsamen', en: 'Roasted Chickpea & Buckwheat Bowl with Hemp Seeds' },
    prep_time_min: 18,
    is_meal_prep: true,
    tags: [], // Safe fallback with zero top-9 allergens (no meat, poultry, fish, dairy, eggs, nuts, gluten, soy)
    volume: 'high_volume',
    fitGoals: ['weight_loss', 'performance', 'muscle_gain'],
    carbFocus: 'moderate',
    proteinSpec: { name: { de: 'Kichererbsen + Erbsenprotein-Flocken', en: 'chickpeas & pea protein crumble' }, proteinPer100g: 20, fatPer100g: 3, carbsPer100g: 14, minG: 200, maxG: 800 },
    carbSpec: { name: { de: 'Buchweizen (gekocht)', en: 'cooked buckwheat' }, carbsPer100g: 20, proteinPer100g: 3.4, fatPer100g: 0.6, dryRatio: 2.5, minG: 120, maxG: 800 },
    fatSpec: { name: { de: 'Olivenöl & Hanfsamen', en: 'olive oil & hemp seeds' }, fatPer100g: 80, unit: 'g', minG: 12, maxG: 65 },
    extraIngredients: {
      de: ['280g Brokkoli & Paprika', 'Kreuzkümmel, Zitrone & Meersalz'],
      en: ['280g broccoli & bell pepper', 'Cumin, fresh lemon & sea salt'],
    },
    instructions: {
      de: '1. Buchweizen kochen. 2. Kichererbsen mit Paprika, Brokkoli und Kreuzkümmel in Öl rösten. 3. Mit Buchweizen und Hanfsamen mischen.',
      en: '1. Simmer buckwheat until tender. 2. Roast chickpeas with peppers, broccoli and cumin in olive oil. 3. Toss together with hemp seeds and lemon.',
    },
    reheat: {
      de: 'In Pfanne 3 Min. anwärmen — auch ideal als kaltes Meal-Prep.',
      en: 'Warm 3 min in skillet or eat cold.',
    },
  },
];

export const PREMIUM_TEMPLATES: RecipeTemplate[] = [
  // --- Chef Level & Strict 1h Compact --------------------------------------
  {
    id: 'pro-chef-herb-salmon',
    tier: 'premium',
    complexity: 'chef',
    title: { de: 'Kräuterkrusten-Lachs mit Miso-Süßkartoffel & grünem Spargel', en: 'Herb-Crusted Salmon with Miso Sweet Potato & Asparagus' },
    prep_time_min: 32,
    is_meal_prep: true,
    tags: ['fish', 'soy'],
    volume: 'compact',
    fitGoals: ['performance', 'muscle_gain'],
    carbFocus: 'moderate',
    proteinSpec: { name: { de: 'Wildlachsfilet (Rohgewicht)', en: 'wild salmon fillet (raw)' }, proteinPer100g: 21, fatPer100g: 11, carbsPer100g: 0, minG: 180, maxG: 620 },
    carbSpec: { name: { de: 'Süßkartoffelstampf', en: 'sweet potato puree' }, carbsPer100g: 21, proteinPer100g: 1.8, fatPer100g: 0.2, minG: 160, maxG: 850 },
    fatSpec: { name: { de: 'natives Olivenöl & Sesam', en: 'olive oil & toasted sesame' }, fatPer100g: 95, unit: 'g', minG: 8, maxG: 45 },
    extraIngredients: {
      de: ['220g grüner Spargel', '1 TL weiße Miso-Paste, Dill & Zitronenabrieb'],
      en: ['220g green asparagus', '1 tsp white miso paste, fresh dill & lemon zest'],
    },
    instructions: {
      de: '1. Süßkartoffel dämpfen und mit Miso glatt stampfen. 2. Lachs mit Dill-Zitronen-Mix bei 195°C 13 Min. backen. 3. Spargel in derselben Zeit mitbraten.',
      en: '1. Steam sweet potato and mash smoothly with miso. 2. Roast salmon topped with dill and zest at 195°C for 13 min. 3. Pan-sear asparagus crisp.',
    },
    reheat: {
      de: 'Sanft abgedeckt bei 150°C im Ofen 8 Min. erwärmen — hält Fisch zart.',
      en: 'Gently warm covered at 150°C for 8 min to keep salmon silky.',
    },
  },
  {
    id: 'pro-chef-rump-chimichurri',
    tier: 'premium',
    complexity: 'chef',
    title: { de: 'Rumpsteak Chimichurri mit Rosmarin-Drillingen', en: 'Seared Rump Steak Chimichurri with Crispy Baby Potatoes' },
    prep_time_min: 30,
    is_meal_prep: false,
    tags: ['meat'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    proteinSpec: { name: { de: 'Rumpsteak (mager, Rohgewicht)', en: 'lean sirloin steak (raw)' }, proteinPer100g: 22, fatPer100g: 6, carbsPer100g: 0, minG: 180, maxG: 650 },
    carbSpec: { name: { de: 'Drillinge (Kartoffeln)', en: 'baby potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 200, maxG: 1000 },
    fatSpec: { name: { de: 'Olivenöl für Chimichurri', en: 'olive oil (for chimichurri)' }, fatPer100g: 100, unit: 'ml', minG: 15, maxG: 65 },
    extraIngredients: {
      de: ['200g Romanasalat & Rucola', 'Petersilie, Oregano, Rotweinessig & Knoblauch'],
      en: ['200g romaine & arugula', 'Flat-leaf parsley, oregano, red wine vinegar & garlic'],
    },
    instructions: {
      de: '1. Drillinge halbieren und 25 Min. mit Rosmarin knusprig rösten. 2. Steak in heißer Gusseisenpfanne je 3 Min. braten, 5 Min. ruhen lassen. 3. Frisches Chimichurri darüber geben.',
      en: '1. Halve baby potatoes and roast crisp with rosemary for 25 min. 2. Sear steak 3 min per side, rest 5 min. 3. Spoon fresh herb chimichurri over sliced beef.',
    },
    reheat: {
      de: 'Reste dünn aufgeschnitten lauwarm über den Salat geben.',
      en: 'Slice thin and serve warm over the greens.',
    },
  },
  {
    id: 'pro-chef-chicken-orzo',
    tier: 'premium',
    complexity: 'chef',
    title: { de: 'Zitronen-Kräuter-Hähnchen auf Orzo mit Feta & Oliven', en: 'Mediterranean Chicken Thigh & Orzo with Feta' },
    prep_time_min: 30,
    is_meal_prep: true,
    tags: ['poultry', 'gluten', 'dairy'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    proteinSpec: { name: { de: 'Hähnchenbrust / -innenfilet', en: 'chicken tenderloin' }, proteinPer100g: 23, fatPer100g: 2, carbsPer100g: 0, minG: 170, maxG: 650 },
    carbSpec: { name: { de: 'Orzo-Nudeln (gekocht)', en: 'cooked orzo pasta' }, carbsPer100g: 28, proteinPer100g: 4.5, fatPer100g: 0.5, dryRatio: 2.3, minG: 130, maxG: 800 },
    fatSpec: { name: { de: 'Feta + natives Olivenöl', en: 'feta cheese + olive oil' }, fatPer100g: 50, unit: 'g', minG: 20, maxG: 90 },
    extraIngredients: {
      de: ['200g Kirschtomaten & Spinat', 'Kalamata-Oliven, Oregano & Zitrone'],
      en: ['200g cherry tomatoes & spinach', 'Kalamata olives, oregano & fresh lemon'],
    },
    instructions: {
      de: '1. Hähnchen mit Oregano scharf anbraten. 2. Gekochten Orzo mit Tomaten und Spinat in einer Pfanne verbinden. 3. Mit zerbröckeltem Feta und Olivenöl verfeinern.',
      en: '1. Sear oregano-seasoned chicken cleanly. 2. Fold cooked orzo, blistered tomatoes and spinach in one pan. 3. Top with feta and olive oil.',
    },
    reheat: {
      de: 'Pfanne mit 2 EL Brühe 3 Min. cremig aufwärmen.',
      en: 'Warm in skillet with 2 tbsp broth for 3 min.',
    },
  },
  {
    id: 'pro-chef-thai-shrimp',
    tier: 'premium',
    complexity: 'chef',
    title: { de: 'Thai Limetten-Garnelen mit Basmatireis & Zuckerschoten', en: 'Thai Lime-Ginger Prawns with Jasmine Rice' },
    prep_time_min: 20,
    is_meal_prep: true,
    tags: ['fish', 'spicy'],
    volume: 'compact',
    fitGoals: ['weight_loss', 'performance', 'muscle_gain'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Riesengarnelen (geschält)', en: 'raw king prawns' }, proteinPer100g: 21, fatPer100g: 1, carbsPer100g: 0, minG: 180, maxG: 750 },
    carbSpec: { name: { de: 'Jasminreis (gekocht)', en: 'cooked jasmine rice' }, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, dryRatio: 2.5, minG: 120, maxG: 850 },
    fatSpec: { name: { de: 'Kokosöl / Kokoscreme', en: 'coconut oil / cream' }, fatPer100g: 85, unit: 'g', minG: 10, maxG: 55 },
    extraIngredients: {
      de: ['220g Zuckerschoten & Koriander', 'Limette, frischer Ingwer & rote Chili'],
      en: ['220g sugar snap peas & cilantro', 'Lime, fresh ginger & chili flakes'],
    },
    instructions: {
      de: '1. Ingwer und Chili im Kokosöl anrösten, Garnelen 3 Min. scharf braten. 2. Zuckerschoten zugeben und mit Limette ablöschen. 3. Auf heißem Jasminreis servieren.',
      en: '1. Bloom ginger and chili in oil, sear prawns 3 min. 2. Toss snap peas in and deglaze with lime juice. 3. Spoon cleanly over hot jasmine rice.',
    },
    reheat: {
      de: 'Kurz in der Pfanne bei mittlerer Hitze 2 Min. wenden.',
      en: 'Flash-warm in skillet for 2 min so prawns stay snappy.',
    },
  },
  {
    id: 'pro-chef-moroccan-lamb',
    tier: 'premium',
    complexity: 'chef',
    title: { de: 'Marokkanisches Lammfilet mit Gewürz-Quinoa & Minze', en: 'Moroccan Spiced Lamb with Herb Quinoa' },
    prep_time_min: 30,
    is_meal_prep: true,
    tags: ['meat'],
    volume: 'normal',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'moderate',
    proteinSpec: { name: { de: 'Lammfilet / mageres Lamm', en: 'lean lamb tenderloin' }, proteinPer100g: 21, fatPer100g: 6, carbsPer100g: 0, minG: 170, maxG: 650 },
    carbSpec: { name: { de: 'Quinoa (gekocht)', en: 'cooked quinoa' }, carbsPer100g: 21, proteinPer100g: 4.4, fatPer100g: 1.9, dryRatio: 2.8, minG: 130, maxG: 750 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 55 },
    extraIngredients: {
      de: ['220g Aubergine & Granatapfel/Minze', 'Ras el Hanout & Meersalz'],
      en: ['220g eggplant & fresh mint', 'Ras el Hanout spice & sea salt'],
    },
    instructions: {
      de: '1. Lamm mit Ras el Hanout 4 Min. je Seite braten und 4 Min. ruhen lassen. 2. Aubergine würfeln und rösten. 3. Mit Quinoa und frischer Minze servieren.',
      en: '1. Sear spiced lamb 4 min per side, rest 4 min. 2. Roast eggplant cubes cleanly. 3. Serve over quinoa finished with fresh mint and olive oil.',
    },
    reheat: {
      de: 'In Pfanne bei schwacher Hitze 4 Min. durchwärmen.',
      en: 'Warm over low heat for 4 min.',
    },
  },
  {
    id: 'pro-chef-teriyaki-tofu',
    tier: 'premium',
    complexity: 'chef',
    title: { de: 'Glasierter Teriyaki-Tofu auf Edamame-Reis & Pak Choi', en: 'Glazed Teriyaki Tofu over Edamame Rice & Bok Choy' },
    prep_time_min: 28,
    is_meal_prep: true,
    tags: ['soy', 'gluten'],
    volume: 'high_volume',
    fitGoals: ['weight_loss', 'performance', 'muscle_gain'],
    carbFocus: 'moderate',
    proteinSpec: { name: { de: 'Tofu + geschälte Edamame', en: 'firm tofu + shelled edamame' }, proteinPer100g: 14, fatPer100g: 7, carbsPer100g: 5, minG: 220, maxG: 850 },
    carbSpec: { name: { de: 'Sushi-/Jasminreis (gekocht)', en: 'cooked jasmine rice' }, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, dryRatio: 2.5, minG: 130, maxG: 850 },
    fatSpec: { name: { de: 'geröstetes Sesamöl', en: 'toasted sesame oil' }, fatPer100g: 100, unit: 'ml', minG: 8, maxG: 45 },
    extraIngredients: {
      de: ['250g Pak Choi & Frühlingszwiebel', 'Ingwer, Knoblauch & Sojasauce'],
      en: ['250g bok choy & scallions', 'Fresh ginger, garlic & soy glaze'],
    },
    instructions: {
      de: '1. Tofu kross anbraten und mit Ingwer-Soja-Glasur karamellisieren. 2. Edamame und Pak Choi 4 Min. mitdünsten. 3. Auf heißem Reis mit Sesamöl servieren.',
      en: '1. Crisp tofu in skillet and glaze with ginger-soy reduction. 2. Wilt bok choy and edamame 4 min. 3. Serve over hot rice with sesame drizzle.',
    },
    reheat: {
      de: 'Mikrowelle 2 Min. oder 4 Min. im Wok.',
      en: 'Wok 4 min or microwave 2 min.',
    },
  },

  // --- Post-Calisthenics & Training Reload (High Carbs / Compact) ----------
  {
    id: 'pro-cali-beef-rice',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Post-Calisthenics Rind & Honig-Sesam-Reis', en: 'Post-Training Beef & Honey-Sesame Rice' },
    prep_time_min: 15,
    is_meal_prep: true,
    tags: ['meat'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'mageres Rinderhack / -hüfte', en: 'lean minced sirloin' }, proteinPer100g: 22, fatPer100g: 5, carbsPer100g: 0, minG: 170, maxG: 700 },
    carbSpec: { name: { de: 'weißer Jasminreis (gekocht)', en: 'cooked white jasmine rice' }, carbsPer100g: 29, proteinPer100g: 2.6, fatPer100g: 0.2, dryRatio: 2.5, minG: 160, maxG: 950 },
    fatSpec: { name: { de: 'Sesamöl / Avocado', en: 'sesame oil' }, fatPer100g: 100, unit: 'ml', minG: 8, maxG: 45 },
    extraIngredients: {
      de: ['180g gedämpfte Karotten & Gurke', '1 TL Honig, Ingwer & Meersalz (Elektrolyt)'],
      en: ['180g steamed carrots & cucumber', '1 tsp honey, fresh ginger & sea salt'],
    },
    instructions: {
      de: '1. Rind scharf anbraten, mit Salz und Ingwer würzen. 2. Mit kleinem Tropfen Honig glasieren. 3. Mit heißem Jasminreis und gedämpftem Gemüse für schnelle Glykogenaufnahme servieren.',
      en: '1. Sear beef hot with sea salt and ginger. 2. Glaze briefly with honey. 3. Plate with fast-digesting jasmine rice for glycogen reload.',
    },
    reheat: {
      de: 'Perfekt als Meal-Prep — 2,5 Min. Pfanne oder Mikrowelle.',
      en: 'Reheats cleanly in 2.5 min.',
    },
  },
  {
    id: 'pro-cali-chicken-gnocchi',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Blitz-Hähnchen-Gnocchi-Pfanne mit Spinat & Pesto', en: 'One-Pan Chicken & Gnocchi Skillet' },
    prep_time_min: 14,
    is_meal_prep: true,
    tags: ['poultry', 'gluten', 'dairy'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    proteinSpec: { name: { de: 'Hähnchenbruststreifen', en: 'sliced chicken breast' }, proteinPer100g: 23, fatPer100g: 1.5, carbsPer100g: 0, minG: 170, maxG: 700 },
    carbSpec: { name: { de: 'Kartoffel-Gnocchi', en: 'potato gnocchi' }, carbsPer100g: 32, proteinPer100g: 3.5, fatPer100g: 0.5, minG: 140, maxG: 750 },
    fatSpec: { name: { de: 'Olivenöl + Parmesan', en: 'olive oil + parmesan' }, fatPer100g: 60, unit: 'g', minG: 12, maxG: 65 },
    extraIngredients: {
      de: ['180g Kirschtomaten & Blattspinat', 'Basilikum, Knoblauch & Meersalz'],
      en: ['180g cherry tomatoes & spinach', 'Fresh basil, garlic & sea salt'],
    },
    instructions: {
      de: '1. Gnocchi direkt in der Pfanne mit Öl 6 Min. knusprig braten. 2. Hähnchen parallel goldbraun garen, Spinat und Tomaten unterheben. 3. Parmesan darüber.',
      en: '1. Pan-roast gnocchi in olive oil 6 min until crisp. 2. Sear chicken strips alongside, fold in spinach and tomatoes. 3. Finish with parmesan.',
    },
    reheat: {
      de: 'Pfanne 3 Min. bei mittlerer Hitze — Gnocchi bleiben außen knusprig.',
      en: 'Skillet 3 min keeps gnocchi golden.',
    },
  },
  {
    id: 'pro-cali-tuna-pasta',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'High-Protein Thunfisch-Pasta mit Kapern & Olive', en: 'High-Protein Tuna Pasta with Capers & Olives' },
    prep_time_min: 14,
    is_meal_prep: true,
    tags: ['fish', 'gluten'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Thunfisch (im eigenen Saft)', en: 'canned tuna in spring water' }, proteinPer100g: 25, fatPer100g: 1, carbsPer100g: 0, minG: 160, maxG: 650 },
    carbSpec: { name: { de: 'Vollkorn-Penne (gekocht)', en: 'cooked whole-wheat penne' }, carbsPer100g: 27, proteinPer100g: 5, fatPer100g: 0.8, dryRatio: 2.3, minG: 130, maxG: 850 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 60 },
    extraIngredients: {
      de: ['180g Passierte Tomaten & Kapern', 'Knoblauch, Chili & Petersilie'],
      en: ['180g crushed tomatoes & capers', 'Garlic, chili flakes & parsley'],
    },
    instructions: {
      de: '1. Pasta al dente kochen. 2. Tomatensauce mit Knoblauch und Kapern 5 Min. einkochen. 3. Abgetropften Thunfisch und Pasta durchschwenken, Öl kalt unterheben.',
      en: '1. Boil penne al dente. 2. Simmer garlic, capers and crushed tomato 5 min. 3. Fold drained tuna and pasta together with cold-pressed olive oil.',
    },
    reheat: {
      de: '2 Min. sanft erwärmen oder als kalten Pasta-Salat mitnehmen.',
      en: 'Enjoy cold or heat gently for 2 min.',
    },
  },
  {
    id: 'pro-cali-oats-whey',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Warmer High-Protein Kakao-Hafer-Topf mit Beeren', en: 'Warm Cocoa Protein Oats with Berries & Almond Butter' },
    prep_time_min: 10,
    is_meal_prep: false,
    tags: ['dairy', 'nuts'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Magerquark / Griechischer Joghurt + Whey', en: 'Greek yogurt + whey protein blend' }, proteinPer100g: 18, fatPer100g: 1.5, carbsPer100g: 4, minG: 200, maxG: 750 },
    carbSpec: { name: { de: 'Haferflocken (zart)', en: 'rolled oats' }, carbsPer100g: 60, proteinPer100g: 13, fatPer100g: 7, minG: 45, maxG: 320 },
    fatSpec: { name: { de: 'Mandelmus', en: 'almond butter' }, fatPer100g: 55, unit: 'g', minG: 15, maxG: 70 },
    extraIngredients: {
      de: ['150g Waldbeeren & 1 Banane', '1 EL Backkakao & Prise Meersalz'],
      en: ['150g mixed berries & 1 banana', '1 tbsp raw cocoa & pinch of sea salt'],
    },
    instructions: {
      de: '1. Haferflocken mit Wasser und Prise Salz 4 Min. cremig aufkochen. 2. Vom Herd nehmen, Protein-Basis und Kakao glattrühren. 3. Mit Beeren und Mandelmus toppen.',
      en: '1. Simmer oats with water and a pinch of salt 4 min. 2. Remove from heat and stir in protein blend and cocoa. 3. Top with berries and almond butter.',
    },
    reheat: {
      de: 'Direkt warm genießen.',
      en: 'Served warm straight from the pot.',
    },
  },

  // --- High-Satiety Cut & Rest-Day Low-Carb -------------------------------
  {
    id: 'pro-cut-shrimp-zoodles',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Knoblauch-Garnelen auf Zucchini-Reis-Mix (Volumen-Cut)', en: 'Garlic Prawns over High-Volume Zucchini & Rice' },
    prep_time_min: 15,
    is_meal_prep: true,
    tags: ['fish'],
    volume: 'high_volume',
    fitGoals: ['weight_loss'],
    carbFocus: 'low',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Garnelen (geschält, Rohgewicht)', en: 'peeled prawns (raw)' }, proteinPer100g: 21, fatPer100g: 1, carbsPer100g: 0, minG: 220, maxG: 750 },
    carbSpec: { name: { de: 'Basmatireis (gekocht)', en: 'cooked basmati rice' }, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, dryRatio: 2.5, minG: 60, maxG: 450 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 45 },
    extraIngredients: {
      de: ['350g Zucchini-Streifen & Champignons', 'Knoblauch, Zitronensaft & Chili'],
      en: ['350g courgette ribbons & mushrooms', 'Garlic, lemon juice & chili'],
    },
    instructions: {
      de: '1. Garnelen mit Knoblauch 3 Min. braten und herausnehmen. 2. Viel Zucchini & Pilze 4 Min. im gleichen Sud anbraten. 3. Alles mit Reis locker mischen.',
      en: '1. Sear garlic prawns 3 min and set aside. 2. Sauté large volume of zucchini and mushrooms in same pan. 3. Toss back with rice and lemon.',
    },
    reheat: {
      de: '2 Min. in Pfanne bei mittlerer Hitze.',
      en: 'Warm 2 min in skillet.',
    },
  },
  {
    id: 'pro-cut-cod-cauliflower',
    tier: 'premium',
    complexity: 'balanced',
    title: { de: 'Kräuter-Kabeljau mit Drillingen & Ofenblumenkohl', en: 'Baked Herb Cod with Baby Potatoes & Cauliflower' },
    prep_time_min: 28,
    is_meal_prep: true,
    tags: ['fish'],
    volume: 'high_volume',
    fitGoals: ['weight_loss', 'performance'],
    carbFocus: 'low',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Kabeljaufilet (Rohgewicht)', en: 'cod fillet (raw)' }, proteinPer100g: 18, fatPer100g: 0.7, carbsPer100g: 0, minG: 240, maxG: 800 },
    carbSpec: { name: { de: 'Drillinge (Kartoffeln)', en: 'baby potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 120, maxG: 700 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 12, maxG: 50 },
    extraIngredients: {
      de: ['320g Blumenkohlröschen', 'Senfkörner, Zitrone & Dill'],
      en: ['320g cauliflower florets', 'Mustard seed, fresh dill & lemon'],
    },
    instructions: {
      de: '1. Blumenkohl und Kartoffeln mit Öl 20 Min. bei 200°C rösten. 2. Kabeljau mit Zitrone & Dill die letzten 10 Min. drauflegen.',
      en: '1. Roast cauliflower and potatoes at 200°C for 20 min. 2. Lay seasoned cod over top for the final 10 min.',
    },
    reheat: {
      de: 'Abgedeckt bei 160°C 7 Min. im Ofen.',
      en: 'Warm covered at 160°C for 7 min.',
    },
  },
  {
    id: 'pro-cut-chicken-lentil',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Warme Grillhähnchen-Sättigungsbowl mit Linsen', en: 'Grilled Chicken & Lentil High-Satiety Plate' },
    prep_time_min: 18,
    is_meal_prep: true,
    tags: ['poultry'],
    volume: 'high_volume',
    fitGoals: ['weight_loss'],
    carbFocus: 'moderate',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Hähnchenbrust (Rohgewicht)', en: 'chicken breast (raw)' }, proteinPer100g: 23, fatPer100g: 1.5, carbsPer100g: 0, minG: 180, maxG: 650 },
    carbSpec: { name: { de: 'braune Linsen (gekocht)', en: 'cooked brown lentils' }, carbsPer100g: 20, proteinPer100g: 9, fatPer100g: 0.4, minG: 120, maxG: 650 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 45 },
    extraIngredients: {
      de: ['300g Babyspinat, Gurke & Paprika', 'Balsamico, Kreuzkümmel & Meersalz'],
      en: ['300g baby spinach, cucumber & bell pepper', 'Balsamic vinegar, cumin & sea salt'],
    },
    instructions: {
      de: '1. Hähnchen scharf grillen und in Streifen schneiden. 2. Warme Linsen mit Salat, Paprika, Balsamico & Olivenöl anmachen.',
      en: '1. Sear chicken breast cleanly and slice. 2. Toss warm lentils over crisp greens with balsamic and olive oil.',
    },
    reheat: {
      de: 'Hähnchen & Linsen 2 Min. erwärmen, Salat frisch zugeben.',
      en: 'Reheat chicken and lentils 2 min, add fresh greens.',
    },
  },
  {
    id: 'pro-cut-seitan-bolognese',
    tier: 'premium',
    complexity: 'balanced',
    title: { de: 'Würzige Linsen-Seitan-Bolognese auf Kartoffeln', en: 'Spiced Lentil & Seitan Ragu over Roasted Potatoes' },
    prep_time_min: 26,
    is_meal_prep: true,
    tags: ['gluten', 'soy'],
    volume: 'high_volume',
    fitGoals: ['weight_loss', 'muscle_gain'],
    carbFocus: 'moderate',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Seitan / Tempeh-Ragout-Mix', en: 'seitan & lentil ragu mix' }, proteinPer100g: 24, fatPer100g: 2, carbsPer100g: 8, minG: 180, maxG: 650 },
    carbSpec: { name: { de: 'festkochende Kartoffeln', en: 'waxy potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 160, maxG: 850 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 45 },
    extraIngredients: {
      de: ['250g Tomaten-Passata & Sellerie', 'Oregano, Knoblauch & Basilikum'],
      en: ['250g tomato passata & celery', 'Oregano, garlic & fresh basil'],
    },
    instructions: {
      de: '1. Kartoffeln würfeln und rösten. 2. Zerbröselten Seitan mit Sellerie und Passata 12 Min. würzig einkochen. 3. Über Kartoffeln servieren.',
      en: '1. Roast diced potatoes crisp. 2. Simmer crumbled seitan with celery and passata 12 min. 3. Ladle cleanly over potatoes.',
    },
    reheat: {
      de: 'Sauce hält sich 4 Tage im Kühlschrank und lässt sich problemlos aufkochen.',
      en: 'Keeps 4 days chilled and reheats effortlessly.',
    },
  },
  {
    id: 'pro-rest-salmon-avocado',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Ruhetag-Teller: Lachsfilet, Eier & Avocado-Kartoffel', en: 'Rest-Day Ketosis Plate: Salmon, Eggs & Avocado' },
    prep_time_min: 16,
    is_meal_prep: false,
    tags: ['fish', 'eggs'],
    volume: 'compact',
    fitGoals: ['weight_loss', 'performance'],
    carbFocus: 'low',
    proteinSpec: { name: { de: 'Lachsfilet + 2 weiche Eier', en: 'salmon fillet + 2 soft eggs' }, proteinPer100g: 19, fatPer100g: 12, carbsPer100g: 0.5, minG: 180, maxG: 600 },
    carbSpec: { name: { de: 'gekochte Baby-Kartoffeln', en: 'boiled baby potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 80, maxG: 450 },
    fatSpec: { name: { de: 'Avocado & Olivenöl', en: 'avocado & olive oil' }, fatPer100g: 45, unit: 'g', minG: 20, maxG: 120 },
    extraIngredients: {
      de: ['220g Rucola & Brokkoli', 'Meersalz, Dill & Zitronensaft'],
      en: ['220g arugula & broccoli', 'Sea salt, dill & lemon juice'],
    },
    instructions: {
      de: '1. Lachs 4 Min. je Seite anbraten, Eier 6,5 Min. wachsweich kochen. 2. Mit kleinen Kartoffeln, Avocado-Scheiben und viel Grün anrichten.',
      en: '1. Sear salmon 4 min per side and boil eggs 6.5 min. 2. Plate with potatoes, sliced avocado and arugula.',
    },
    reheat: {
      de: 'Am besten frisch oder kalt als Protein-Salat.',
      en: 'Great fresh or chilled.',
    },
  },
  {
    id: 'pro-rest-bison-greens',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Ruhetag Rinderstreifen mit Knoblauch-Kartoffeln & Spinat', en: 'Rest-Day Beef Strips with Garlic Greens' },
    prep_time_min: 16,
    is_meal_prep: true,
    tags: ['meat'],
    volume: 'compact',
    fitGoals: ['weight_loss', 'muscle_gain', 'performance'],
    carbFocus: 'low',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Rinderhüftstreifen (Rohgewicht)', en: 'lean beef strips (raw)' }, proteinPer100g: 22, fatPer100g: 4, carbsPer100g: 0, minG: 200, maxG: 700 },
    carbSpec: { name: { de: 'Kartoffeln (klein gewürfelt)', en: 'diced potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 80, maxG: 500 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 12, maxG: 55 },
    extraIngredients: {
      de: ['280g Blattspinat & grüne Bohnen', 'Knoblauch, Thymian & schwarzer Pfeffer'],
      en: ['280g spinach & green beans', 'Garlic, thyme & cracked black pepper'],
    },
    instructions: {
      de: '1. Rinderstreifen extrem heiß kurz anbraten, beiseitestellen. 2. Kartoffeln und Bohnen garen, Spinat am Ende unterziehen.',
      en: '1. Flash-sear beef strips in screaming hot pan, rest. 2. Crisp potatoes with green beans and wilt spinach.',
    },
    reheat: {
      de: 'Pfanne 2 Min. scharf durchschwenken.',
      en: 'Toss 2 min in hot skillet.',
    },
  },
  {
    id: 'pro-strict1h-beef-bowl',
    tier: 'premium',
    complexity: 'quick',
    title: { de: 'Strict-1h OMAD Power Bowl: Rind, Jasminreis & Avocado', en: 'Strict-1h Power Bowl: Beef, Jasmine Rice & Parmesan' },
    prep_time_min: 15,
    is_meal_prep: true,
    tags: ['meat', 'dairy'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'mageres Rinderhack / -streifen', en: 'lean sirloin / ground beef' }, proteinPer100g: 22, fatPer100g: 5, carbsPer100g: 0, minG: 190, maxG: 720 },
    carbSpec: { name: { de: 'Jasminreis (gekocht)', en: 'cooked jasmine rice' }, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, dryRatio: 2.5, minG: 150, maxG: 900 },
    fatSpec: { name: { de: 'Avocado + Parmesan', en: 'avocado + parmesan' }, fatPer100g: 42, unit: 'g', minG: 20, maxG: 120 },
    extraIngredients: {
      de: ['120g Gurke (leicht verdaulich)', '1 TL Meersalz & Limette'],
      en: ['120g peeled cucumber (low-bulk)', '1 tsp sea salt & fresh lime'],
    },
    instructions: {
      de: '1. Rind kräftig mit Salz anbraten. 2. Kompakt auf heißem Reis mit Avocado, Parmesan und leichter Gurke ohne viel Ballast anrichten — perfekt für 1h Essensfenster.',
      en: '1. Sear beef hot with sea salt. 2. Assemble compactly over jasmine rice with avocado and cucumber so 1-hour OMAD sits comfortably.',
    },
    reheat: {
      de: 'Fleisch und Reis zusammen 2,5 Min. aufwärmen, Avocado kalt dazu.',
      en: 'Warm beef and rice 2.5 min, add avocado cold.',
    },
  },
  {
    id: 'pro-strict1h-pork-potato',
    tier: 'premium',
    complexity: 'balanced',
    title: { de: 'Schweinefilet-Medaillons mit Senfkruste & Kartoffeln', en: 'Pork Tenderloin Medallions with Mustard & Potatoes' },
    prep_time_min: 24,
    is_meal_prep: true,
    tags: ['meat'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Schweinefilet (mager, Rohgewicht)', en: 'lean pork tenderloin (raw)' }, proteinPer100g: 22, fatPer100g: 2.5, carbsPer100g: 0, minG: 180, maxG: 720 },
    carbSpec: { name: { de: 'Petersilienkartoffeln', en: 'boiled & tossed potatoes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 180, maxG: 1000 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 12, maxG: 60 },
    extraIngredients: {
      de: ['180g Brokkoliröschen', '1 EL Dijon-Senf, Petersilie & Salz'],
      en: ['180g broccoli florets', '1 tbsp Dijon mustard, parsley & sea salt'],
    },
    instructions: {
      de: '1. Filet in Medaillons schneiden, je 3 Min. braten und mit Dijon bestreichen. 2. Mit Kartoffeln und dampfgegarten Brokkoliröschen servieren.',
      en: '1. Slice tenderloin medallions, sear 3 min per side and glaze with Dijon. 2. Plate with herbed potatoes and broccoli.',
    },
    reheat: {
      de: 'Kurz abgedeckt bei schwacher Hitze wärmen, damit das Filet saftig bleibt.',
      en: 'Warm gently covered so tenderloin stays moist.',
    },
  },
  {
    id: 'pro-chef-turkey-couscous',
    tier: 'premium',
    complexity: 'balanced',
    title: { de: 'Zitronen-Pute mit Couscous, Granatapfel & Minze', en: 'Herb Turkey & Couscous with Roasted Pepper' },
    prep_time_min: 20,
    is_meal_prep: true,
    tags: ['poultry', 'gluten'],
    volume: 'normal',
    fitGoals: ['weight_loss', 'performance', 'muscle_gain'],
    carbFocus: 'high',
    highProteinEfficiency: true,
    proteinSpec: { name: { de: 'Putenbrustfilet (Rohgewicht)', en: 'turkey breast fillet (raw)' }, proteinPer100g: 24, fatPer100g: 1, carbsPer100g: 0, minG: 170, maxG: 700 },
    carbSpec: { name: { de: 'Couscous (gequollen)', en: 'steamed couscous' }, carbsPer100g: 23, proteinPer100g: 3.8, fatPer100g: 0.2, dryRatio: 2.2, minG: 130, maxG: 800 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 10, maxG: 50 },
    extraIngredients: {
      de: ['220g geröstete Paprika & Gurke', 'Minze, Petersilie & Zitrone'],
      en: ['220g roasted bell pepper & cucumber', 'Mint, parsley & fresh lemon'],
    },
    instructions: {
      de: '1. Couscous mit heißer Brühe 5 Min. quellen lassen. 2. Putenwürfel würzen und scharf anbraten. 3. Mit Röstpaprika, Minze und Olivenöl vermischen.',
      en: '1. Steep couscous in hot broth 5 min. 2. Sear spiced turkey strips cleanly. 3. Toss with roasted pepper, fresh herbs and olive oil.',
    },
    reheat: {
      de: 'Kalt oder warm hervorragend als 2-Tage-Prep.',
      en: 'Great warm or cold for next-day prep.',
    },
  },
  {
    id: 'pro-chef-egg-halloumi',
    tier: 'premium',
    complexity: 'chef',
    title: { de: 'Shakshuka Royale mit Halloumi & Kartoffelwürfeln', en: 'Protein Shakshuka with Halloumi & Crispy Potatoes' },
    prep_time_min: 25,
    is_meal_prep: false,
    tags: ['eggs', 'dairy'],
    volume: 'high_volume',
    fitGoals: ['weight_loss', 'performance'],
    carbFocus: 'moderate',
    proteinSpec: { name: { de: 'Halloumi light + 4 Eier', en: 'light halloumi + 4 eggs' }, proteinPer100g: 16, fatPer100g: 12, carbsPer100g: 1, minG: 220, maxG: 650 },
    carbSpec: { name: { de: 'Kartoffelwürfel (geröstet)', en: 'crispy potato cubes' }, carbsPer100g: 17, proteinPer100g: 2, fatPer100g: 0.1, minG: 140, maxG: 800 },
    fatSpec: { name: { de: 'natives Olivenöl extra', en: 'extra virgin olive oil' }, fatPer100g: 100, unit: 'ml', minG: 5, maxG: 40 },
    extraIngredients: {
      de: ['280g stückige Tomaten & Paprika', 'Kreuzkümmel, Koriander & Salz'],
      en: ['280g chopped tomatoes & bell pepper', 'Cumin, cilantro & sea salt'],
    },
    instructions: {
      de: '1. Tomaten-Paprika-Sauce mit Kreuzkümmel einkochen. 2. Eier direkt darin stocken lassen, Halloumi knusprig anbraten. 3. Auf Kartoffelwürfeln servieren.',
      en: '1. Simmer spiced tomato-pepper base. 2. Crack eggs into sauce until just set, pan-sear halloumi golden. 3. Serve with crispy potatoes.',
    },
    reheat: {
      de: 'Frisch aus der Pfanne am besten.',
      en: 'Served hot from the skillet.',
    },
  },
  {
    id: 'pro-cut-tempeh-peanut',
    tier: 'premium',
    complexity: 'balanced',
    title: { de: 'Gegrillter Tempeh mit Erdnuss-Limette & Jasminreis', en: 'Charred Tempeh Peanut-Lime Bowl with Jasmine Rice' },
    prep_time_min: 22,
    is_meal_prep: true,
    tags: ['soy', 'nuts'],
    volume: 'compact',
    fitGoals: ['muscle_gain', 'performance'],
    carbFocus: 'high',
    proteinSpec: { name: { de: 'Natur-Tempeh (gewürfelt)', en: 'fermented tempeh' }, proteinPer100g: 19, fatPer100g: 11, carbsPer100g: 9, minG: 180, maxG: 680 },
    carbSpec: { name: { de: 'Jasminreis (gekocht)', en: 'cooked jasmine rice' }, carbsPer100g: 28, proteinPer100g: 2.7, fatPer100g: 0.3, dryRatio: 2.5, minG: 130, maxG: 850 },
    fatSpec: { name: { de: 'Erdnussmus (ungesüßt)', en: 'natural peanut butter' }, fatPer100g: 50, unit: 'g', minG: 10, maxG: 70 },
    extraIngredients: {
      de: ['220g Brokkoli & Edamame', 'Limettensaft, Ingwer & Chili'],
      en: ['220g broccoli & snap peas', 'Fresh lime juice, ginger & chili'],
    },
    instructions: {
      de: '1. Tempeh in Scheiben scharf anbraten. 2. Erdnussmus mit heißem Wasser und Limette glattrühren. 3. Alles über Jasminreis und gedämpften Brokkoli geben.',
      en: '1. Sear sliced tempeh until caramelized. 2. Whisk peanut butter with warm water and lime. 3. Drizzle over rice and steamed broccoli.',
    },
    reheat: {
      de: 'Erdnusssauce vor dem Erwärmen mit 1 EL Wasser auflockern.',
      en: 'Loosen peanut sauce with 1 tbsp water while warming.',
    },
  },
];

export const ALL_TEMPLATES: RecipeTemplate[] = [...STANDARD_TEMPLATES, ...PREMIUM_TEMPLATES];

const AVOID_LEXICON: { tag: DietaryTag; re: RegExp }[] = [
  { tag: 'poultry', re: /\b(chicken|huhn|hähnchen|haehnchen|turkey|pute|geflügel|gefluegel|poultry)\b/i },
  { tag: 'meat', re: /\b(meat|fleisch|beef|rind|rinder|pork|schwein|lamb|lamm|steak|rump|bacon|schinken)\b/i },
  { tag: 'fish', re: /\b(fish|fisch|salmon|lachs|tuna|thunfisch|cod|kabeljau|shrimp|prawn|garnele|seafood|meeresfrüchte)\b/i },
  { tag: 'dairy', re: /\b(dairy|milch|milk|cheese|käse|kaese|feta|parmesan|halloumi|skyr|quark|yogurt|joghurt|whey|butter|lactose|laktose)\b/i },
  { tag: 'eggs', re: /\b(egg|eggs|ei|eier|rührei)\b/i },
  { tag: 'nuts', re: /\b(nut|nuts|nuss|nüsse|nuesse|almond|mandel|peanut|erdnuss|cashew|walnut)\b/i },
  { tag: 'gluten', re: /\b(gluten|wheat|weizen|pasta|nudeln|orzo|gnocchi|couscous|seitan|bread|brot)\b/i },
  { tag: 'soy', re: /\b(soy|soja|tofu|tempeh|edamame|miso|tamari)\b/i },
  { tag: 'spicy', re: /\b(spicy|scharf|chili)\b/i },
];

export function parseAvoidProfile(avoid: string): { tags: Set<DietaryTag>; terms: string[] } {
  const tags = new Set<DietaryTag>();
  const raw = String(avoid ?? '').toLowerCase();
  if (/\b(vegan|plant[- ]?based|rein pflanzlich)\b/i.test(raw)) {
    tags.add('meat');
    tags.add('poultry');
    tags.add('fish');
    tags.add('dairy');
    tags.add('eggs');
  } else if (/\b(vegetarian|vegetarisch|veggie|no meat|kein fleisch)\b/i.test(raw)) {
    tags.add('meat');
    tags.add('poultry');
    tags.add('fish');
  }
  for (const { tag, re } of AVOID_LEXICON) {
    if (re.test(raw)) tags.add(tag);
  }
  const terms = raw
    .split(/[,;/\n]+/)
    .map((s) => s.replace(/^(no|ohne|kein|keine|keinen|without)\s+/i, '').trim())
    .filter((s) => s.length >= 3 && !/^(vegan|vegetarian|vegetarisch|meat|fleisch)$/i.test(s));
  return { tags, terms };
}

export function templateMatchesAvoid(tpl: RecipeTemplate, avoid: string): boolean {
  const { tags, terms } = parseAvoidProfile(avoid);
  if (tpl.tags.some((t) => tags.has(t))) return true;
  if (terms.length === 0) return false;
  const hay = [
    tpl.title.de,
    tpl.title.en,
    tpl.proteinSpec.name.de,
    tpl.proteinSpec.name.en,
    tpl.carbSpec.name.de,
    tpl.carbSpec.name.en,
    tpl.fatSpec.name.de,
    tpl.fatSpec.name.en,
    ...tpl.extraIngredients.de,
    ...tpl.extraIngredients.en,
  ]
    .join(' ')
    .toLowerCase();
  return terms.some((term) => hay.includes(term));
}

const round5 = (n: number) => Math.max(5, Math.round(n / 5) * 5);
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Scale curated macro roles to target grams while keeping grocery.ts clean amount parsing intact. */
export function scaleTemplate(tpl: RecipeTemplate, targets: Macros, lang: Lang): Recipe {
  const pG = clamp(round5((targets.protein_g * 0.9) / (tpl.proteinSpec.proteinPer100g / 100)), tpl.proteinSpec.minG, tpl.proteinSpec.maxG);
  const carbsFromProtein = (pG * tpl.proteinSpec.carbsPer100g) / 100;
  const fatFromProtein = (pG * tpl.proteinSpec.fatPer100g) / 100;

  const needCarbs = Math.max(20, targets.carbs_g - carbsFromProtein);
  const cG = clamp(round5(needCarbs / (tpl.carbSpec.carbsPer100g / 100)), tpl.carbSpec.minG, tpl.carbSpec.maxG);
  const fatFromCarb = (cG * tpl.carbSpec.fatPer100g) / 100;

  const needFat = Math.max(5, targets.fat_g - fatFromProtein - fatFromCarb);
  const fG = clamp(round5(needFat / (tpl.fatSpec.fatPer100g / 100)), tpl.fatSpec.minG, tpl.fatSpec.maxG);

  const carbLine = tpl.carbSpec.dryRatio
    ? lang === 'de'
      ? `${cG}g ${tpl.carbSpec.name.de} (~${round5(cG / tpl.carbSpec.dryRatio)}g trocken)`
      : `${cG}g ${tpl.carbSpec.name.en} (~${round5(cG / tpl.carbSpec.dryRatio)}g dry)`
    : `${cG}g ${tpl.carbSpec.name[lang]}`;

  const fatUnit = tpl.fatSpec.unit ?? 'g';

  return {
    id: tpl.id,
    title: tpl.title[lang],
    ingredients: [
      `${pG}g ${tpl.proteinSpec.name[lang]}`,
      carbLine,
      `${fG}${fatUnit} ${tpl.fatSpec.name[lang]}`,
      ...tpl.extraIngredients[lang],
    ],
    instructions: tpl.instructions[lang],
    reheat_instructions: tpl.reheat[lang],
    prep_time_min: tpl.prep_time_min,
    is_meal_prep: tpl.is_meal_prep,
  };
}

function scoreTemplate(
  tpl: RecipeTemplate,
  opts: {
    profile: UserProfile;
    training: Training | null;
    complexity: MealComplexity;
    historyTitles: string[];
    energy?: RecipeEnergyContext;
  }
): number {
  let score = 0;
  if (tpl.complexity === opts.complexity) score += 45;
  else if (opts.complexity === 'chef' && tpl.complexity === 'balanced') score += 15;

  if (tpl.fitGoals.includes(opts.profile.goal)) score += 20;

  // Strict 1-2h windows prefer lower gut volume; cuts on 3h+ windows prefer satiety volume.
  if (opts.profile.omad_window_hours <= 2 && tpl.volume === 'compact') score += 28;
  else if (opts.profile.omad_window_hours >= 3 && opts.profile.goal === 'weight_loss' && tpl.volume === 'high_volume') score += 22;
  else if (tpl.volume === 'normal') score += 10;

  const isHardSession = opts.training && ['calisthenics', 'hiit', 'weights', 'running', 'soccer', 'boxing'].includes(opts.training.sport.toLowerCase()) && opts.training.intensity !== 'low';
  if (isHardSession && tpl.carbFocus === 'high') score += 22;
  if (!isHardSession && tpl.carbFocus === 'low') score += 18;

  if ((opts.energy?.proteinAdherenceLow || opts.energy?.budgetDeficitActive || opts.energy?.plateauStalled) && tpl.highProteinEfficiency) {
    score += 24;
  }
  if ((opts.energy?.budgetDeficitActive || opts.energy?.plateauStalled) && tpl.volume === 'high_volume') {
    score += 18;
  }

  // Rotation penalty for recently cooked/generated titles.
  const recentIdx = opts.historyTitles.findIndex((t) => t === tpl.title.de || t === tpl.title.en);
  if (recentIdx === 0) score -= 70;
  else if (recentIdx > 0 && recentIdx < 4) score -= 35;

  return score;
}

export function generateMealPlan(
  profile: UserProfile,
  training: Training | null,
  lang: Lang,
  opts: {
    measuredMaintenance?: number;
    complexity?: MealComplexity;
    isPremium?: boolean;
    historyTitles?: string[];
    excludeRecipeId?: string;
    energy?: RecipeEnergyContext;
    date?: string;
  } = {}
): MealPlan {
  const isPremium = Boolean(opts.isPremium);
  const requestedComplexity: MealComplexity = isPremium
    ? opts.complexity ?? 'balanced'
    : opts.complexity === 'chef'
    ? 'balanced'
    : opts.complexity ?? 'balanced';

  const baseTargets = dailyTargets(profile, training, opts.measuredMaintenance);
  const effectiveTargets = opts.energy?.adjustedTargets ?? baseTargets;
  const timing = mealTiming(profile, training);

  const pool = isPremium ? ALL_TEMPLATES : STANDARD_TEMPLATES;
  let candidates = pool.filter((t) => !templateMatchesAvoid(t, profile.avoid));
  let avoidRelaxed = false;

  if (candidates.length === 0) {
    candidates = ALL_TEMPLATES.filter((t) => !templateMatchesAvoid(t, profile.avoid) && (isPremium || t.tier === 'standard'));
  }
  if (candidates.length === 0) {
    candidates = [STANDARD_TEMPLATES[STANDARD_TEMPLATES.length - 1]];
    avoidRelaxed = true;
  }

  const nonExcluded = opts.excludeRecipeId && candidates.length > 1
    ? candidates.filter((t) => t.id !== opts.excludeRecipeId)
    : candidates;

  const ranked = [...nonExcluded].sort(
    (a, b) =>
      scoreTemplate(b, {
        profile,
        training,
        complexity: requestedComplexity,
        historyTitles: opts.historyTitles ?? [],
        energy: opts.energy,
      }) -
      scoreTemplate(a, {
        profile,
        training,
        complexity: requestedComplexity,
        historyTitles: opts.historyTitles ?? [],
        energy: opts.energy,
      })
  );

  const chosen = ranked[0];
  const scaled = scaleTemplate(chosen, effectiveTargets, lang);
  const notes: string[] = [];
  if (avoidRelaxed) {
    notes.push(
      lang === 'de'
        ? 'Sehr strenge Ausschlüsse erkannt — allergenarmes Basis-Rezept gewählt.'
        : 'Strict exclusions detected — allergen-safe base template selected.'
    );
  }
  if (opts.energy?.budgetDeficitActive) {
    notes.push(lang === 'de' ? 'Mengen aufs restliche Wochenbudget skaliert.' : 'Portions scaled to remaining weekly calorie budget.');
  } else if (opts.energy?.plateauStalled) {
    notes.push(lang === 'de' ? 'Plateau-Ziel aktiv — hohe Sättigungsdichte bevorzugt.' : 'Plateau target active — prioritizing high-satiety protein.');
  } else if (opts.energy?.proteinAdherenceLow) {
    notes.push(lang === 'de' ? 'Protein-Fokus erhöht, um das Tagesziel sauber zu treffen.' : 'Boosted protein density based on recent check-ins.');
  }

  return {
    date: opts.date ?? new Date().toISOString().slice(0, 10),
    eating_window_start: timing.eating_window_start,
    eating_window_end: timing.eating_window_end,
    total_kcal: effectiveTargets.kcal,
    protein_g: effectiveTargets.protein_g,
    carbs_g: effectiveTargets.carbs_g,
    fat_g: effectiveTargets.fat_g,
    pre_training_snack_time: timing.pre_training_snack_time,
    main_meal_time: timing.main_meal_time,
    ai_reasoning: timing.reasoning,
    timing_warning: timing.warning,
    training_burn_kcal: baseTargets.burn_kcal,
    recipe_source: isPremium && chosen.tier === 'premium' ? 'premium' : 'standard',
    recipe_note: notes.length ? notes.join(' ') : null,
    timing_pattern: timing.pattern,
    training_start_time: training?.start_time ?? null,
    training_duration_min: training?.duration_min ?? 0,
    complexity: requestedComplexity,
    recipe: scaled,
  };
}

export function demo() {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error('FAIL: ' + msg);
  };

  assert(STANDARD_TEMPLATES.length >= 6, 'at least 6 standard templates');
  assert(PREMIUM_TEMPLATES.length >= 16, 'at least 16 premium templates');

  const pAvoid: UserProfile = { ...DEFAULT_PROFILE, avoid: 'no chicken, no dairy, no fish' };
  const freePlan = generateMealPlan(pAvoid, { sport: 'calisthenics', duration_min: 45, intensity: 'high', start_time: '18:00' }, 'en', {
    isPremium: false,
    complexity: 'balanced',
  });
  assert(freePlan.recipe_source === 'standard', 'free tier uses standard source');
  assert(freePlan.recipe.title.length > 0 && freePlan.recipe.ingredients.length >= 3, 'free plan renders full recipe');
  const joined = `${freePlan.recipe.title} ${freePlan.recipe.ingredients.join(' ')}`.toLowerCase();
  assert(!/chicken|dairy|yogurt|skyr|salmon|fish|cheese/.test(joined), `respects avoid exclusions, got: ${joined}`);

  const pVegan: UserProfile = { ...DEFAULT_PROFILE, avoid: 'vegan' };
  const veganPlan = generateMealPlan(pVegan, null, 'de', { isPremium: true });
  const veganText = `${veganPlan.recipe.title} ${veganPlan.recipe.ingredients.join(' ')}`.toLowerCase();
  assert(!/hähnchen|rind|lachs|pute|eier|skyr|garnelen|schwein|lamm/.test(veganText), `vegan filter blocks animal proteins: ${veganText}`);

  const swapPlan = generateMealPlan(pAvoid, null, 'en', {
    isPremium: true,
    complexity: 'chef',
    excludeRecipeId: freePlan.recipe.id,
  });
  assert(swapPlan.recipe_source === 'premium', 'premium unlocks premium source');
  assert(swapPlan.recipe.id !== freePlan.recipe.id, 'swap chooses a different recipe');

  const budgetPlan = generateMealPlan(DEFAULT_PROFILE, null, 'de', {
    isPremium: false,
    energy: {
      mode: 'budget',
      budgetDeficitActive: true,
      adjustedTargets: { kcal: 1950, protein_g: 165, carbs_g: 170, fat_g: 65 },
    },
  });
  assert(budgetPlan.total_kcal === 1950 && budgetPlan.recipe_note !== null, 'energy budget context flows into MealPlan');

  const compactPlan = generateMealPlan({ ...DEFAULT_PROFILE, omad_window_hours: 1 }, null, 'de', { isPremium: true });
  assert(compactPlan.recipe.ingredients.length >= 3, 'DE recipe generates cleanly');
  const groceries = buildGroceryList([compactPlan]);
  assert(groceries.length > 0, 'scaled recipe integrates cleanly into buildGroceryList');

  return 'recipes.ts: all checks passed';
}
