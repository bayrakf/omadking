import { Radius, Space } from '@/constants/theme';
import { loadFastingNote, saveFastingNote } from '@/lib/store';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { Icon } from './icons';
import { useLang } from './lang';
import { Eyebrow, Txt, useTheme } from './ui';

const PRESET_TAGS = [
  '🎯 Starker Fokus',
  '⚡️ Müheloses Fasten',
  '🏋️‍♂️ Top Workout',
  '🧂 Salz hat geholfen',
  '💧 3L getrunken',
];

export function DailyFastingNote({ embedded = false }: { embedded?: boolean }) {
  const c = useTheme();
  const { lang } = useLang();
  const [note, setNote] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadFastingNote().then(setNote);
  }, []);

  const handleSave = async (text: string) => {
    setNote(text);
    await saveFastingNote(text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addTag = async (tag: string) => {
    const next = note.trim() ? `${note.trim()} · ${tag}` : tag;
    handleSave(next);
  };

  return (
    <View style={embedded ? s.embeddedContainer : [s.container, { backgroundColor: c.surface, borderColor: c.line }]}>
      <View style={s.head}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Icon name="edit" size={14} color={c.accent} />
          <Eyebrow color={c.accent} style={{ marginLeft: 6 }}>
            {lang === 'de' ? 'TAGES-NOTIZ & JOURNAL' : 'DAILY FASTING NOTE'}
          </Eyebrow>
        </View>
        {saved && (
          <Txt variant="eyebrow" color={c.positive} style={{ fontSize: 10, fontWeight: '800' }}>
            ✓ {lang === 'de' ? 'GESPEICHERT' : 'SAVED'}
          </Txt>
        )}
      </View>

      <TextInput
        style={[s.input, { backgroundColor: c.well, borderColor: c.line, color: c.text }]}
        placeholder={lang === 'de' ? 'Wie lief das Fasten heute? (z.B. Energie, Salz, Fokus)...' : 'How was your fast today?...'}
        placeholderTextColor={c.textDim}
        value={note}
        onChangeText={(text) => {
          setNote(text);
        }}
        onBlur={() => handleSave(note)}
        returnKeyType="done"
      />

      <View style={s.tagRow}>
        {PRESET_TAGS.map((tag) => (
          <TouchableOpacity
            key={tag}
            activeOpacity={0.7}
            onPress={() => addTag(tag)}
            style={[s.tagPill, { backgroundColor: c.well, borderColor: c.line }]}
          >
            <Txt variant="small" color={c.textDim} style={{ fontSize: 11 }}>
              {tag}
            </Txt>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Space.base,
    marginBottom: Space.base,
  },
  embeddedContainer: {
    padding: 0,
    marginBottom: 0,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Space.sm,
  },
  input: {
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingHorizontal: Space.base,
    paddingVertical: Space.sm,
    fontSize: 14,
    minHeight: 40,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Space.sm,
  },
  tagPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    marginRight: 6,
    marginBottom: 6,
  },
});
