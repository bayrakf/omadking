/**
 * Responsive dual-polarity tab navigation shell.
 *
 * - Wide viewports (>= 840px): renders a crisp, flush top workspace bar
 *   (`OMADCOACH` brand + inline `role="tab"` navigation + Coach shortcut) with
 *   no floating bottom dock covering screen content.
 * - Narrow viewports (< 840px): renders a theme-adaptive bottom capsule
 *   matching Obsidian Carbon (dark) or Alabaster Paper (light), without
 *   overlapping badges or hardcoded glow shadows.
 * - Syncs `document.title` on web so navigating routes never leaves stale titles.
 */

import { useEffect } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, WindowGlyph, type IconName } from '@/components/icons';
import { useLang } from '@/components/lang';
import { Tap, Txt, useTheme, useWide } from '@/components/ui';
import { useThemeMode } from '@/components/ThemeProvider';
import { MaxWideWidth, Radius, Shadow, Space } from '@/constants/theme';
import { haptic } from '@/lib/haptic';

type TabRouteName = 'index' | 'planner' | 'progress' | 'grocery' | 'profile';

const TAB_ITEMS: { name: TabRouteName; path: string; icon: IconName; labelKey: 'tab.today' | 'tab.plan' | 'tab.progress' | 'tab.shop' | 'tab.you' }[] = [
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

function WideTopNav() {
  const c = useTheme();
  const { t } = useLang();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <View style={[s.topBarOuter, { backgroundColor: c.bg, borderBottomColor: c.line }]}>
      <View style={s.topBarInner}>
        <Tap
          onPress={() => router.navigate('/')}
          accessibilityLabel="OMADCoach"
          style={s.brandBtn}
        >
          <WindowGlyph size={18} track={c.dialTrack} fill={c.accent} />
          <Txt variant="subheading" color={c.text} style={s.brandTitle}>
            OMADCOACH
          </Txt>
        </Tap>

        <View accessibilityRole="tablist" style={s.topTabsRow}>
          {TAB_ITEMS.map((item) => {
            const focused = isRouteActive(pathname, item);
            const label = t(item.labelKey);
            return (
              <Tap
                key={item.name}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                accessibilityLabel={label}
                onPress={() => {
                  haptic('light');
                  router.navigate(item.path as any);
                }}
                style={[
                  s.topTabItem,
                  focused
                    ? { backgroundColor: c.surfaceElevated, borderColor: c.lineStrong }
                    : { borderColor: 'transparent' },
                ]}
              >
                <Icon
                  name={item.icon}
                  size={15}
                  color={focused ? c.accent : c.textFaint}
                  strokeWidth={focused ? 2 : 1.65}
                />
                <Txt
                  variant="small"
                  color={focused ? c.text : c.textDim}
                  style={{ marginLeft: 7, fontWeight: focused ? '700' : '600' }}
                >
                  {label}
                </Txt>
              </Tap>
            );
          })}
        </View>

        <Tap
          onPress={() => router.push('/chat')}
          accessibilityLabel="Coach"
          style={[s.coachPill, { backgroundColor: c.surface, borderColor: c.line }]}
        >
          <Icon name="coach" size={14} color={c.accent} />
          <Txt variant="eyebrow" color={c.text} style={{ marginLeft: 6, fontSize: 10 }}>
            COACH
          </Txt>
        </Tap>
      </View>
    </View>
  );
}

function MobileDock({ state, navigation }: { state: any; navigation: any }) {
  const c = useTheme();
  const { resolved } = useThemeMode();
  const { t } = useLang();
  const insets = useSafeAreaInsets();
  const activeRouteName = state.routes[state.index]?.name as TabRouteName | undefined;

  return (
    <View
      pointerEvents="box-none"
      style={[
        s.dockAnchor,
        { bottom: Math.max(insets.bottom, 10) },
      ]}
    >
      <View
        accessibilityRole="tablist"
        style={[
          s.dockCapsule,
          {
            backgroundColor: c.surface,
            borderColor: resolved === 'light' ? c.lineStrong : c.line,
          },
          Shadow.lifted,
        ]}
      >
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
              style={s.dockTab}
            >
              <View
                style={[
                  s.dockIconPill,
                  focused ? { backgroundColor: c.accentWash } : null,
                ]}
              >
                <Icon
                  name={item.icon}
                  size={19}
                  color={focused ? c.accent : c.textFaint}
                  strokeWidth={focused ? 2 : 1.65}
                />
              </View>
              <Txt
                variant="eyebrow"
                numberOfLines={1}
                color={focused ? c.text : c.textFaint}
                style={s.dockLabel}
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
  const isWide = useWide();
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
      {isWide ? <WideTopNav /> : null}
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: c.bg },
        }}
        tabBar={(props) => (isWide ? null : <MobileDock {...props} />)}
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
  topBarOuter: {
    borderBottomWidth: 1,
    zIndex: 20,
  },
  topBarInner: {
    width: '100%',
    maxWidth: MaxWideWidth,
    alignSelf: 'center',
    height: 60,
    paddingHorizontal: Space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandBtn: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  brandTitle: {
    marginLeft: 9,
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  topTabsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  topTabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: Radius.sm,
    borderWidth: 1,
    marginHorizontal: 3,
  },
  coachPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  dockAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Space.md,
    zIndex: 30,
  },
  dockCapsule: {
    width: '100%',
    maxWidth: 480,
    height: 64,
    borderRadius: Radius.xl,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  dockTab: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockIconPill: {
    width: 40,
    height: 30,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockLabel: {
    fontSize: 9.5,
    letterSpacing: 0.4,
    textTransform: 'none',
    marginTop: 2,
  },
});
