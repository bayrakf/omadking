import { Tabs } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Type, Space, Radius, MaxContentWidth, type ThemePalette } from '@/constants/theme';
import { useTheme } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';
import { useT } from '@/components/lang';
import type { Key } from '@/lib/i18n';

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
type TabMeta = { icon: IconName; key: Key; hue: (c: ThemePalette) => string };

const TABS: Record<string, TabMeta> = {
  index: { icon: 'home', key: 'tab.today', hue: (c) => c.accent },
  planner: { icon: 'plate', key: 'tab.plan', hue: (c) => c.plan },
  progress: { icon: 'chart', key: 'tab.progress', hue: (c) => c.body },
  grocery: { icon: 'basket', key: 'tab.shop', hue: (c) => c.plan },
  profile: { icon: 'user', key: 'tab.you', hue: (c) => c.accent },
};

function TabBar({ state, navigation }: any) {
  const c = useTheme();
  const t = useT();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) }]}>
      <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.line }]}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const meta = TABS[route.name];
          const hue = meta ? meta.hue(c) : c.accent;
          // An unknown route is a routing bug, not a tab: name it after itself
          // rather than inventing a phrase for it.
          const label = meta ? t(meta.key) : route.name;

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
              accessibilityLabel={label}
            >
              <View
                style={[
                  styles.iconWrap,
                  focused && {
                    backgroundColor: route.name === 'index' ? c.emberWash : `${hue}25`,
                    borderColor: focused ? `${hue}40` : 'transparent',
                    borderWidth: 1,
                  },
                ]}
              >
                <Icon name={meta ? meta.icon : 'home'} size={20} color={focused ? hue : c.textFaint} />
                {route.name === 'profile' && (
                  <View style={[styles.proBadge, { backgroundColor: c.gold }]}>
                    <Text style={styles.proText}>PRO</Text>
                  </View>
                )}
              </View>
              <Text
                style={[
                  Type.eyebrow,
                  {
                    color: focused ? hue : c.textFaint,
                    marginTop: 3,
                    fontWeight: focused ? '800' : '500',
                    fontSize: 10,
                  },
                ]}
              >
                {label}
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
    paddingVertical: 8,
    paddingHorizontal: Space.xs,
    width: '100%',
    maxWidth: MaxContentWidth,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
      android: { elevation: 10 },
      default: { boxShadow: '0 10px 30px rgba(0,0,0,0.22)' } as any,
    }),
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  iconWrap: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  proBadge: {
    position: 'absolute',
    top: -3,
    right: -3,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proText: {
    fontSize: 7,
    fontWeight: '900',
    color: '#080C14',
  },
});
