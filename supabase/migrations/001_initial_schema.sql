-- OMADCoach Initial Schema
-- Supabase Auth provides auth.users — no custom users table needed

-- Profiles
CREATE TABLE profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg NUMERIC,
  height_cm NUMERIC,
  age INT,
  sex TEXT CHECK (sex IN ('male', 'female', 'other')),
  fitness_level TEXT CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  goal TEXT CHECK (goal IN ('performance', 'weight_loss', 'muscle_gain')),
  omad_window_start TIME,
  omad_window_hours INT DEFAULT 1,
  default_training_time TIME,
  timezone TEXT DEFAULT 'Europe/Berlin',
  locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Trainings
CREATE TABLE trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  sport_type TEXT NOT NULL,
  duration_min INT NOT NULL,
  intensity TEXT CHECK (intensity IN ('low', 'medium', 'high', 'max')),
  planned_start_time TIME,
  actual_start_time TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Meal Plans
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  training_id UUID REFERENCES trainings(id),
  date DATE NOT NULL,
  eating_window_start TIME,
  eating_window_end TIME,
  total_kcal INT,
  protein_g INT,
  carbs_g INT,
  fat_g INT,
  pre_training_snack_time TIME,
  main_meal_time TIME,
  ai_reasoning TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Recipes (bound to meal_plan for MVP; make standalone + join when reuse/favorites come)
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  ingredients JSONB NOT NULL,
  instructions TEXT NOT NULL,
  reheat_instructions TEXT,
  prep_time_min INT,
  macros JSONB NOT NULL,
  is_meal_prep BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Subscriptions (single source of truth for premium status)
CREATE TABLE subscriptions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT CHECK (plan IN ('free', 'premium')) DEFAULT 'free',
  status TEXT CHECK (status IN ('active', 'expired', 'cancelled')) DEFAULT 'active',
  revenue_cat_id TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Device tokens for push notifications
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Indexes
CREATE INDEX idx_trainings_user_date ON trainings(user_id, date);
CREATE INDEX idx_meal_plans_user_date ON meal_plans(user_id, date);
CREATE INDEX idx_recipes_meal_plan ON recipes(meal_plan_id);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies: users can only access their own data
CREATE POLICY "users_own_data" ON profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON trainings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON meal_plans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_data" ON device_tokens FOR ALL USING (auth.uid() = user_id);

-- Recipes accessible via meal_plans ownership
CREATE POLICY "users_own_recipes" ON recipes FOR ALL USING (
  EXISTS (SELECT 1 FROM meal_plans mp WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid())
);

-- Auto-create profile + free subscription on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO profiles (user_id) VALUES (NEW.id);
  INSERT INTO subscriptions (user_id, plan, status) VALUES (NEW.id, 'free', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
