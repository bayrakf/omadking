import { Tabs } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Type, Space, Radius, MaxContentWidth, type ThemePalette } from '@/constants/theme';
import { useTheme } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';

/**
 * Each tab carries the hue its screen is built from, so the bar doubles as the
 * legend for the whole palette: green is food, violet is your body, teal is the
 * fast. Learn it once at the bottom of the screen and every tinted card
 * elsewhere is already labelled.
 *
 * Plan and Shop share green because they are one subject — the meal and the
 * things it is made of. Giving them separate colours would invent a
 * distinction the product does not have.
 */
type TabMeta = { icon: IconName; label: string; hue: (c: ThemePalette) => string };

const TABS: Record<string, TabMeta> = {
  index: { icon: 'home', label: 'Today', hue: (c) => c.accent },
  planner: { icon: 'plate', label: 'Plan', hue: (c) => c.plan },
  progress: { icon: 'chart', label: 'Progress', hue: (c) => c.body },
  grocery: { icon: 'basket', label: 'Shop', hue: (c) => c.plan },
  profile: { icon: 'user', label: 'You', hue: (c) => c.accent },
};

function TabBar({ state, navigation }: any) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) }]}>
      <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.line }]}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const meta = TABS[route.name] ?? { icon: 'home' as IconName, label: route.name, hue: (t: ThemePalette) => t.accent };
          const hue = meta.hue(c);

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.item}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
            >
              <Icon name={meta.icon} size={21} color={focused ? hue : c.textFaint} />
              <Text
                style={[
                  Type.eyebrow,
                  { color: focused ? hue : c.textFaint, marginTop: 5, textTransform: 'uppercase' },
                ]}
              >
                {meta.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const c = useTheme();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="planner" options={{ title: 'Plan' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="grocery" options={{ title: 'Shop' }} />
      <Tabs.Screen name="profile" options={{ title: 'You' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Space.base,
    right: Space.base,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    borderRadius: Radius.xl,
    borderWidth: 1,
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
    width: '100%',
    maxWidth: MaxContentWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } },
      android: { elevation: 12 },
      default: { boxShadow: '0 12px 32px rgba(0,0,0,0.28)' } as any,
    }),
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
});
