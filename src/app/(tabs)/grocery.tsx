import { useCallback, useState } from 'react';
import { View, StyleSheet, Platform, Share } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Space, Radius } from '@/constants/theme';
import {
  Screen, Card, Txt, Eyebrow, Enter, Columns, Tap, Divider, Empty, PageHeader, Bar, useTheme,
} from '@/components/ui';
import { Icon } from '@/components/icons';
import { loadPlanHistory, loadPortions, KEYS } from '@/lib/store';
import { buildGroceryList, scaleIngredients, type GroceryCategory } from '@/lib/grocery';
import type { MealPlan } from '@/lib/ai';

export default function GroceryScreen() {
  const c = useTheme();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  const [categories, setCategories] = useState<GroceryCategory[]>([]);
  const [copied, setCopied] = useState(false);
  const [batch, setBatch] = useState(1);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [plans, raw, batch] = await Promise.all([
          loadPlanHistory<MealPlan>(),
          AsyncStorage.getItem(KEYS.groceryChecked),
          loadPortions(),
        ]);
        if (!active) return;
        let checks: Record<string, boolean> = {};
        try { checks = raw ? JSON.parse(raw) : {}; } catch { checks = {}; }
        // Last three plans — a week of prep without dragging in months of history.
        // Buy for the batch size the planner is set to, not for one portion.
        const scaled = plans.slice(0, 3).map((plan) => ({
          ...plan,
          recipe: { ...plan.recipe, ingredients: scaleIngredients(plan.recipe?.ingredients, batch) },
        }));
        setBatch(batch);
        setCategories(buildGroceryList(scaled, checks));
        setMounted(true);
      })();
      return () => { active = false; };
    }, [])
  );

  const persist = async (cats: GroceryCategory[]) => {
    const map: Record<string, boolean> = {};
    cats.forEach((cat) => cat.items.forEach((i) => i.checked && (map[i.id] = true)));
    await AsyncStorage.setItem(KEYS.groceryChecked, JSON.stringify(map));
  };

  const toggle = (catIdx: number, id: string) => {
    setCategories((prev) => {
      const next = prev.map((cat, i) =>
        i !== catIdx ? cat : { ...cat, items: cat.items.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)) }
      );
      persist(next);
      return next;
    });
  };

  const clear = () => {
    setCategories((prev) => {
      const next = prev.map((cat) => ({ ...cat, items: cat.items.map((i) => ({ ...i, checked: false })) }));
      persist(next);
      return next;
    });
  };

  const shareList = async () => {
    const text = categories
      .map((cat) => `${cat.name}\n${cat.items.map((i) => `${i.checked ? '[x]' : '[ ]'} ${i.name}`).join('\n')}`)
      .join('\n\n');
    if (Platform.OS === 'web') {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard blocked */ }
    } else {
      await Share.share({ message: text });
    }
  };

  if (!mounted) return null;

  const total = categories.reduce((n, cat) => n + cat.items.length, 0);
  const done = categories.reduce((n, cat) => n + cat.items.filter((i) => i.checked).length, 0);

  if (total === 0) {
    return (
      <Screen>
        <Enter index={0}><PageHeader title="Shopping" /></Enter>
        <Enter index={1}>
          <Empty
            icon="basket"
            title="Nothing to buy yet"
            body="Build a meal plan and its ingredients land here, grouped the way a shop is laid out."
            action="Go to the planner"
            onAction={() => router.push('/planner')}
          />
        </Enter>
      </Screen>
    );
  }

  return (
    <Screen wide>
      <Enter index={0}>
        <PageHeader
          eyebrow={`${done} of ${total} in the basket${batch > 1 ? ` · ${batch} portions` : ''}`}
          title="Shopping"
        />
        <View style={{ marginTop: -Space.md, marginBottom: Space.lg }}>
          <Bar pct={(done / total) * 100} color={c.accent} />
        </View>
      </Enter>

      <Enter index={1}>
        <View style={s.tools}>
          <Tap onPress={shareList} accessibilityLabel="Share list">
            <View style={[s.tool, { borderColor: c.line }]}>
              <Icon name={copied ? 'check' : 'share'} size={14} color={copied ? c.positive : c.textDim} />
              <Txt variant="small" color={copied ? c.positive : c.textDim} style={{ marginLeft: 6 }}>
                {copied ? 'Copied' : Platform.OS === 'web' ? 'Copy' : 'Share'}
              </Txt>
            </View>
          </Tap>
          <Tap onPress={clear} accessibilityLabel="Clear ticks">
            <View style={[s.tool, { borderColor: c.line }]}>
              <Icon name="close" size={14} color={c.textDim} />
              <Txt variant="small" color={c.textDim} style={{ marginLeft: 6 }}>Clear</Txt>
            </View>
          </Tap>
        </View>
      </Enter>

      {/* Category cards are parallel and similarly sized, which is the case
          two columns suit best — a shopping list on a laptop was four short
          cards down the middle of an empty screen. */}
      <Columns>
      {categories.map((cat, catIdx) => (
        <Enter key={cat.name} index={2 + catIdx}>
          <Card style={{ marginBottom: Space.md, paddingVertical: Space.sm }}>
            {/* The emoji has been on the category since `grocery.ts` was
                written and was never rendered. A shopping list is scanned in a
                shop, at arm's length, and a shape found before a word is read
                is worth more here than anywhere else in the app. */}
            <View style={s.catHead}>
              <Txt variant="body" style={s.catEmoji}>{cat.emoji}</Txt>
              <Eyebrow>{cat.name}</Eyebrow>
            </View>
            {cat.items.map((item, i) => (
              <View key={item.id}>
                {i > 0 && <Divider />}
                <Tap
                  onPress={() => toggle(catIdx, item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.checked }}
                  accessibilityLabel={item.name}
                >
                  <View style={s.item}>
                    <View style={[s.box, {
                      borderColor: item.checked ? c.accent : c.lineStrong,
                      backgroundColor: item.checked ? c.accent : 'transparent',
                    }]}>
                      {item.checked && <Icon name="check" size={12} color={c.onAccent} strokeWidth={2.4} />}
                    </View>
                    <View style={s.itemText}>
                      <Txt
                        variant="bodyMedium"
                        color={item.checked ? c.textFaint : c.text}
                        style={item.checked ? s.struck : undefined}
                      >
                        {item.name}
                      </Txt>
                      {/* Preparation belongs under the name, not in it: at a
                          shelf you are looking for the thing, not for how to
                          cut it. */}
                      {item.detail && (
                        <Txt variant="small" color={c.textFaint} style={{ marginTop: 2 }}>
                          {item.detail}
                        </Txt>
                      )}
                    </View>
                  </View>
                </Tap>
              </View>
            ))}
          </Card>
        </Enter>
      ))}
      </Columns>
    </Screen>
  );
}

const s = StyleSheet.create({
  catHead: { flexDirection: 'row', alignItems: 'center', paddingVertical: Space.md },
  catEmoji: { marginRight: Space.sm },
  tools: { flexDirection: 'row', marginBottom: Space.base },
  tool: {
    flexDirection: 'row', alignItems: 'center', minHeight: 34, paddingVertical: 4,
    paddingHorizontal: Space.md, borderRadius: Radius.pill, borderWidth: 1, marginRight: Space.sm,
  },
  item: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: Space.md },
  itemText: { flex: 1 },
  box: {
    width: 20, height: 20, borderRadius: 6, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', marginRight: Space.md, marginTop: 1,
  },
  struck: { textDecorationLine: 'line-through' },
});
