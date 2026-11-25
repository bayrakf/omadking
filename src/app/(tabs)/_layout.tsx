/**
 * Native docked mobile tab bar (`animate-expo` + `mobile-native`).
 *
 * - Sits in normal flex layout below the screen view (zero floating capsule overlay,
 *   zero bottom card occlusion on phones or tablets).
 * - Crisp edge-to-edge hairline top border + safe-area bottom inset.
 * - Tab switches use `animation: 'none'` (tabs are peers, not depth hierarchy).
 * - Syncs `document.title` on web so route titles never go stale.
 */

import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@/components/icons';
import { useLang } from '@/components/lang';
import { Tap, Txt, useTheme } from '@/components/ui';
import { Hairline, MaxWideWidth, Space } from '@/constants/theme';
import { haptic } from '@/lib/haptic';

type TabRouteName = 'index' | 'planner' | 'progress' | 'grocery' | 'profile';

const TAB_ITEMS: {
  name: TabRouteName;
  path: string;
  icon: IconName;
  labelKey: 'tab.today' | 'tab.plan' | 'tab.progress' | 'tab.shop' | 'tab.you';
}[] = [
  { name: 'index', path: '/', icon: 'home', labelKey: 'tab.today' },
  { name: 'planner', path: '/planner', icon: 'plate', labelKey: 'tab.plan' },
  { name: 'progress', path: '/progress', icon: 'chart', labelKey: 'tab.progress' },
  { name: 'grocery', path: '/grocery', icon: 'basket', labelKey: 'tab.shop' },
  { name: 'profile', path: '/profile', icon: 'user', labelKey: 'tab.you' },
];

function isRouteActive(pathname: string, item: (typeof TAB_ITEMS)[number]): boolean {
  if (item.name === 'index') {
    return pathname === '/' || pathname === '/index' || pathname === '/(tabs)';
  }
  return pathname.startsWith(item.path) || pathname.startsWith(`/(tabs)${item.path}`);
}

function NativeTabBar({ state, navigation }: { state: any; navigation: any }) {
  const c = useTheme();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name as TabRouteName | undefined;

  return (
    <View
      style={[
        s.barOuter,
        {
          backgroundColor: c.surface,
          borderTopColor: c.line,
          paddingBottom: Math.max(insets.bottom, 6),
        },
      ]}
    >
      <View accessibilityRole="tablist" style={s.barInner}>
        {TAB_ITEMS.map((item) => {
          const focused = activeRouteName === item.name;
          const label = t(item.labelKey);
          const routeObj = state.routes.find((r: any) => r.name === item.name);

          return (
            <Tap
              key={item.name}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={label}
              onPress={() => {
                if (!routeObj) return;
                haptic('light');
                const event = navigation.emit({
                  type: 'tabPress',
                  target: routeObj.key,
                  canPreventDefault: true,
                });
                if (!focused && !event.defaultPrevented) {
                  navigation.navigate(routeObj.name);
                }
              }}
              style={s.tabItem}
            >
              <Icon
                name={item.icon}
                size={21}
                color={focused ? c.accent : c.textFaint}
                strokeWidth={focused ? 2.1 : 1.65}
              />
              <Txt
                variant="small"
                numberOfLines={1}
                color={focused ? c.accent : c.textFaint}
                style={[s.tabLabel, { fontWeight: focused ? '600' : '500' }]}
              >
                {label}
              </Txt>
            </Tap>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const c = useTheme();
  const pathname = usePathname();
  const { t } = useLang();

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const match = TAB_ITEMS.find((item) => isRouteActive(pathname, item));
    if (match) {
      document.title = `${t(match.labelKey)} · OMADCoach`;
    }
  }, [pathname, t]);

  return (
    <View style={[s.root, { backgroundColor: c.bg }]}>
      <Tabs
        screenOptions={{
          headerShown: false,
          animation: 'none',
          sceneStyle: { backgroundColor: c.bg },
        }}
        tabBar={(props) => <NativeTabBar {...props} />}
      >
        <Tabs.Screen name="index" options={{ title: t('tab.today') }} />
        <Tabs.Screen name="planner" options={{ title: t('tab.plan') }} />
        <Tabs.Screen name="progress" options={{ title: t('tab.progress') }} />
        <Tabs.Screen name="grocery" options={{ title: t('tab.shop') }} />
        <Tabs.Screen name="profile" options={{ title: t('tab.you') }} />
      </Tabs>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  barOuter: {
    borderTopWidth: Hairline,
    paddingTop: Space.xs + 2,
  },
  barInner: {
    width: '100%',
    maxWidth: MaxWideWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10.5,
    lineHeight: 13,
    marginTop: 3,
  },
});
