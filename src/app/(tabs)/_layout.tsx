import { useEffect, useState } from 'react';
import { Tabs } from 'expo-router';
import { View, Text, Pressable, StyleSheet, Platform, useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, type ThemePalette } from '@/constants/theme';

const TABS: Record<string, { icon: string; label: string }> = {
  index: { icon: '🏠', label: 'Home' },
  planner: { icon: '🍽️', label: 'Planner' },
  progress: { icon: '📊', label: 'Progress' },
  grocery: { icon: '🛒', label: 'Grocery' },
  profile: { icon: '👤', label: 'Profile' },
};

type TabBarProps = {
  state: { routes: { key: string; name: string }[]; index: number };
  navigation: any;
  colors: ThemePalette;
  bottomInset: number;
};

function CustomTabBar({ state, navigation, colors, bottomInset }: TabBarProps) {
  return (
    <View style={[styles.tabBarContainer, { bottom: Math.max(bottomInset, 12) }]}>
      <View style={[styles.tabBar, { backgroundColor: colors.card, borderColor: colors.backgroundElement }]}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const meta = TABS[route.name] ?? { icon: '•', label: route.name };

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="tab"
              accessibilityState={{ selected: isFocused }}
              accessibilityLabel={meta.label}
            >
              {isFocused && <View style={[styles.activeLine, { backgroundColor: colors.primary }]} />}
              <Text style={{ fontSize: isFocused ? 21 : 18, opacity: isFocused ? 1 : 0.55 }}>{meta.icon}</Text>
              <Text
                style={{
                  color: isFocused ? colors.primary : colors.textSecondary,
                  fontSize: 10,
                  marginTop: 3,
                  fontWeight: isFocused ? '700' : '500',
                }}
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
  const [mounted, setMounted] = useState(false);
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();

  useEffect(() => setMounted(true), []);

  // The tab bar was hardcoded to '#1a1a2e', so in light mode it sat as a
  // near-black slab under a white page.
  const colors = Colors[mounted && colorScheme === 'dark' ? 'dark' : 'light'];

  if (!mounted) return null;

  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}
      tabBar={(props) => <CustomTabBar {...(props as any)} colors={colors} bottomInset={insets.bottom} />}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="planner" options={{ title: 'Planner' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="grocery" options={{ title: 'Grocery' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: { position: 'absolute', left: 16, right: 16 },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 10,
    ...Platform.select({ web: { maxWidth: 520, alignSelf: 'center', width: '100%' } }),
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    position: 'relative',
    flex: 1,
    // 48pt is the minimum comfortable touch target.
    minHeight: 48,
  },
  activeLine: { position: 'absolute', top: -8, width: 20, height: 3, borderRadius: 2 },
});
