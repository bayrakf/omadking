/**
 * The figures every other number is computed from.
 *
 * Weight, height, age and sex feed Mifflin-St Jeor; the goal decides which
 * direction the target moves from maintenance. Grouped here because they are
 * the inputs — everything else in "You" is a preference about how the app
 * behaves, and these are facts about the person.
 */

import { useEffect, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { Screen, Card, Txt, Eyebrow, Enter, Chip, Divider, PageHeader, useTheme } from '@/components/ui';
import { useProfileEditor } from '@/components/profile-fields';
import { useLang } from '@/components/lang';
import { Type, Space, Radius } from '@/constants/theme';
import { normalizeProfile, targetWeight } from '@/lib/nutrition';
import { saveProfile } from '@/lib/store';
import { haptic } from '@/lib/haptic';

const CHOICES = {
  sex: [['male', 'Male'], ['female', 'Female'], ['other', 'Other']],
  fitness_level: [['beginner', 'Beginner'], ['intermediate', 'Intermediate'], ['advanced', 'Advanced']],
  goal: [['performance', 'Performance'], ['weight_loss', 'Lose fat'], ['muscle_gain', 'Build muscle']],
} as const;

const QUICK_AVOIDS = [
  { id: 'no dairy', label: 'Laktosefrei / Kein Milch', labelEn: 'No dairy' },
  { id: 'no gluten', label: 'Glutenfrei', labelEn: 'Gluten-free' },
  { id: 'no pork', label: 'Kein Schweinefleisch', labelEn: 'No pork' },
  { id: 'vegetarian', label: 'Vegetarisch', labelEn: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan', labelEn: 'Vegan' },
  { id: 'no nuts', label: 'Keine Nüsse', labelEn: 'No nuts' },
  { id: 'no seafood', label: 'Kein Fisch / Seafood', labelEn: 'No seafood' },
];

export default function BodyScreen() {
  const { lang, t } = useLang();
  const c = useTheme();
  const { profile, setProfile, mounted, persist, row } = useProfileEditor();
  const [avoid, setAvoid] = useState('');

  // Seeded once the profile lands, then owned by the field until it blurs.
  useEffect(() => { if (mounted) setAvoid(profile.avoid); }, [mounted]);

  /** Saved on blur like the numeric rows, so there is no extra button. */
  const commitAvoid = async () => {
    if (avoid === profile.avoid) return;
    const next = normalizeProfile({ ...profile, avoid });
    setProfile(next);
    setAvoid(next.avoid);
    await saveProfile(next);
  };

  const toggleAvoidTag = async (tag: string) => {
    haptic('light');
    const parts = avoid.split(',').map((s) => s.trim()).filter(Boolean);
    const hasTag = parts.some((p) => p.toLowerCase() === tag.toLowerCase());
    const nextParts = hasTag
      ? parts.filter((p) => p.toLowerCase() !== tag.toLowerCase())
      : [...parts, tag];
    const nextText = nextParts.join(', ');
    setAvoid(nextText);
    const next = normalizeProfile({ ...profile, avoid: nextText });
    setProfile(next);
    await saveProfile(next);
  };

  if (!mounted) return null;

  const choice = <K extends keyof typeof CHOICES>(label: string, field: K) => (
    <View style={{ paddingVertical: Space.md }}>
      <Eyebrow style={{ marginBottom: Space.md }}>{label}</Eyebrow>
      <View style={s.wrap}>
        {CHOICES[field].map(([value, text]) => (
          <Chip
            key={value}
            label={text}
            selected={profile[field] === value}
            onPress={() => persist({ ...profile, [field]: value })}
            style={s.chip}
          />
        ))}
      </View>
    </View>
  );

  return (
    <Screen tabBar={false}>
      <Enter index={0}>
        <PageHeader tone="body" back={true} eyebrow={t('you.title')} title={t('you.body')} sub={t('you.bodySub')} />
      </Enter>

      <Enter index={1}>
        <Card>
          {row('Weight', 'weight_kg', ' kg')}
          <Divider />
          {row('Height', 'height_cm', ' cm')}
          <Divider />
          {row('Age', 'age')}
          <Divider />
          {row('Target weight', 'target_weight_kg', ' kg')}
          <Txt variant="small" color={c.textFaint} style={{ marginBottom: Space.md }}>
            Left unset it aims at {targetWeight(profile)} kg, the top of a healthy BMI for your height.
          </Txt>
          <Divider />
          {/* Free text, not a menu of diets: "no fish, no dairy, no mushrooms"
              covers more real people than any list, and the model reads prose
              better than a taxonomy. Its own row rather than a ProfileRow —
              that component treats null as "use the default target". */}
          <View style={{ paddingVertical: Space.md }}>
            <Txt variant="body" color={c.textDim}>{t('body.avoid')}</Txt>
            
            {/* Quick 1-tap allergen & diet chips */}
            <View style={[s.wrap, { marginTop: Space.sm }]}>
              {QUICK_AVOIDS.map((qa) => {
                const parts = avoid.split(',').map((s) => s.trim().toLowerCase());
                const isSelected = parts.includes(qa.id.toLowerCase());
                return (
                  <Chip
                    key={qa.id}
                    label={lang === 'de' ? qa.label : qa.labelEn}
                    selected={isSelected}
                    onPress={() => toggleAvoidTag(qa.id)}
                    tone="accent"
                    style={s.chip}
                  />
                );
              })}
            </View>

            <TextInput
              value={avoid}
              onChangeText={setAvoid}
              onBlur={commitAvoid}
              placeholder="no fish, no dairy…"
              placeholderTextColor={c.textFaint}
              maxLength={120}
              accessibilityLabel="Never put in a recipe"
              style={[Type.data, s.avoidInput, { color: c.text, backgroundColor: c.well, borderColor: c.line }]}
            />
            <Txt variant="small" color={c.textFaint} style={{ marginTop: Space.sm }}>
              Goes to the recipe as a hard constraint. Your numbers are unaffected.
            </Txt>
          </View>
          <Divider />
          {choice('Sex', 'sex')}
        </Card>
      </Enter>

      <Enter index={2}>
        <Card style={{ marginTop: Space.base }}>
          <Eyebrow style={{ marginBottom: Space.sm }}>Training</Eyebrow>
          {choice('Level', 'fitness_level')}
          <Divider />
          {choice('Goal', 'goal')}
        </Card>
      </Enter>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginRight: -Space.sm },
  chip: { marginRight: Space.sm, marginBottom: Space.sm },
  avoidInput: {
    marginTop: Space.sm, borderRadius: Radius.md, borderWidth: 1,
    paddingHorizontal: Space.md, paddingVertical: Space.md, fontSize: 13,
  },
});
