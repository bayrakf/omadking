import { Tabs } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Type, Space, Radius, MaxContentWidth } from '@/constants/theme';
import { useTheme } from '@/components/ui';
import { Icon, type IconName } from '@/components/icons';

const TABS: Record<string, { icon: IconName; label: string }> = {
  index: { icon: 'home', label: 'Today' },
  planner: { icon: 'plate', label: 'Plan' },
  progress: { icon: 'chart', label: 'Progress' },
  grocery: { icon: 'basket', label: 'Shop' },
  profile: { icon: 'user', label: 'You' },
};

function TabBar({ state, navigation }: any) {
  const c = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.wrap, { bottom: Math.max(insets.bottom, 14) }]}>
      <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.line }]}>
        {state.routes.map((route: any, index: number) => {
          const focused = state.index === index;
          const meta = TABS[route.name] ?? { icon: 'home' as IconName, label: route.name };

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
              <Icon name={meta.icon} size={21} color={focused ? c.accent : c.textFaint} />
              <Text
                style={[
                  Type.eyebrow,
                  { color: focused ? c.accent : c.textFaint, marginTop: 5, textTransform: 'uppercase' },
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
