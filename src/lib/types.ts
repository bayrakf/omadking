// DB types matching supabase/migrations/001_initial_schema.sql

export type Profile = {
  user_id: string;
  weight_kg: number | null;
  height_cm: number | null;
  age: number | null;
  sex: 'male' | 'female' | 'other' | null;
  fitness_level: 'beginner' | 'intermediate' | 'advanced' | null;
  goal: 'performance' | 'weight_loss' | 'muscle_gain' | null;
  omad_window_start: string | null; // TIME as HH:MM
  omad_window_hours: number;
  default_training_time: string | null; // TIME as HH:MM
  timezone: string;
  locale: string;
  created_at: string;
};

export type Training = {
  id: string;
  user_id: string;
  date: string; // DATE as YYYY-MM-DD
  sport_type: string;
  duration_min: number;
  intensity: 'low' | 'medium' | 'high' | 'max' | null;
  planned_start_time: string | null;
  actual_start_time: string | null;
  notes: string | null;
  created_at: string;
};

export type MealPlan = {
  id: string;
  user_id: string;
  training_id: string | null;
  date: string;
  eating_window_start: string | null;
  eating_window_end: string | null;
  total_kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  pre_training_snack_time: string | null;
  main_meal_time: string | null;
  ai_reasoning: string | null;
  created_at: string;
};

export type Macros = {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type Recipe = {
  id: string;
  meal_plan_id: string;
  title: string;
  ingredients: string[];
  instructions: string;
  reheat_instructions: string | null;
  prep_time_min: number | null;
  macros: Macros;
  is_meal_prep: boolean;
  created_at: string;
};

export type Subscription = {
  user_id: string;
  plan: 'free' | 'premium';
  status: 'active' | 'expired' | 'cancelled';
  revenue_cat_id: string | null;
  started_at: string | null;
  expires_at: string | null;
  updated_at: string;
};
