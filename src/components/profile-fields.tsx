/**
 * The editable profile row, and the load-edit-save cycle around it.
 *
 * "You" used to be one screen holding every setting, so this lived inside it
 * along with the state it needs. Six screens now edit slices of the same
 * profile, and each one needs the identical cycle: read it on focus, hold the
 * field being typed into, clamp through `normalizeProfile` on the way out, and
 * rebuild the reminder schedule because the window times drive it.
 *
 * Written once here rather than six times, because six copies of a save path
 * is six chances for one of them to forget the clamp or the resync — and the
 * clamp is what stops an out-of-range edit becoming NaN targets three screens
 * away.
 */

import { useCallback, useState } from 'react';
import { View, TextInput, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Type, Space } from '@/constants/theme';
import { Txt, Tap, useTheme } from './ui';
import { Icon } from './icons';
import {
  normalizeProfile, targetWeight, DEFAULT_PROFILE, type UserProfile,
} from '@/lib/nutrition';
import { loadProfileOrDefault, saveProfile } from '@/lib/store';
import { resync, scheduledCount } from '@/lib/notify';

export type EditField =
  | 'weight_kg' | 'height_cm' | 'age'
  | 'omad_window_start' | 'omad_window_hours'
  | 'default_training_time' | 'target_weight_kg';

/**
 * Everything a screen needs to edit part of the profile.
 *
 * `mounted` is false until the first read lands, so a screen renders nothing
 * rather than flashing DEFAULT_PROFILE and correcting itself a frame later.
 */
export function useProfileEditor() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [mounted, setMounted] = useState(false);
  const [editing, setEditing] = useState<EditField | null>(null);
  const [draft, setDraft] = useState('');
  const [queued, setQueued] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [p, n] = await Promise.all([loadProfileOrDefault(), scheduledCount()]);
        if (!active) return;
        setProfile(p);
        setQueued(n);
        setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  const persist = async (next: UserProfile) => {
    // Everything routes through normalizeProfile, so an out-of-range edit is
    // clamped here rather than producing NaN targets three screens away.
    const clean = normalizeProfile(next);
    setProfile(clean);
    await saveProfile(clean);
    // Window times drive the reminders, so the schedule follows the edit.
    await resync();
    setQueued(await scheduledCount());
  };

  const commit = async (field: EditField) => {
    await persist({ ...profile, [field]: draft } as unknown as UserProfile);
    setEditing(null);
  };

  /** One editable row, wired to this editor. */
  const row = (label: string, field: EditField, unit?: string) => (
    <ProfileRow
      key={field}
      label={label}
      field={field}
      unit={unit}
      profile={profile}
      editing={editing}
      draft={draft}
      setDraft={setDraft}
      onEdit={(f, v) => { setEditing(f); setDraft(v); }}
      onCommit={commit}
    />
  );

  return { profile, setProfile, mounted, persist, row, queued, setQueued };
}

export function ProfileRow({
  label, field, unit, profile, editing, draft, setDraft, onEdit, onCommit,
}: {
  label: string;
  field: EditField;
  unit?: string;
  profile: UserProfile;
  editing: EditField | null;
  draft: string;
  setDraft: (v: string) => void;
  onEdit: (field: EditField, value: string) => void;
  onCommit: (field: EditField) => void;
}) {
  const c = useTheme();
  const active = editing === field;
  const raw = profile[field];
  // An unset target is not "null": it is the app's default, shown as the figure
  // it will actually aim at, so the row never reads as broken.
  const shown = raw == null ? `${targetWeight(profile)} (default)` : String(raw);

  return (
    <View style={s.row}>
      <Txt variant="body" color={c.textDim}>{label}</Txt>
      {active ? (
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onBlur={() => onCommit(field)}
          onSubmitEditing={() => onCommit(field)}
          autoFocus
          keyboardType={field.includes('time') || field.includes('start') ? 'default' : 'numeric'}
          accessibilityLabel={label}
          style={[Type.data, s.input, { color: c.accent, borderColor: c.accent }]}
        />
      ) : (
        <Tap
          onPress={() => onEdit(field, raw == null ? '' : String(raw))}
          accessibilityLabel={`Edit ${label}`}
        >
          <View style={s.value}>
            <Txt variant="data" color={c.text} style={s.valueText}>{shown}{raw == null ? '' : unit ?? ''}</Txt>
            <Icon name="edit" size={13} color={c.textFaint} />
          </View>
        </Tap>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: Space.base },
  value: { flexDirection: 'row', alignItems: 'center' },
  valueText: { marginRight: Space.sm },
  input: { minWidth: 90, textAlign: 'right', borderBottomWidth: 1.5, paddingVertical: 2, fontSize: 13 },
});
