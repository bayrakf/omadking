import { Tabs } from 'expo-router';
import { View, Text, Pressable, StyleSheet, useColorScheme, Platform } from 'react-native';
import { Colors } from '@/constants/theme';
import { useState, useEffect } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';

function CustomTabBar({ state, descriptors, navigation, colors }: BottomTabBarProps & { colors: any }) {
  return (
    <View style={styles.tabBarContainer}>
      <View style={[styles.tabBar, { backgroundColor: '#1a1a2e' }]}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          let icon = '🏠';
          let label = 'Home';
          if (route.name === 'index') { icon = '🏠'; label = 'Home'; }
          if (route.name === 'planner') { icon = '🍽️'; label = 'Planner'; }
          if (route.name === 'progress') { icon = '📊'; label = 'Progress'; }
          if (route.name === 'grocery') { icon = '🛒'; label = 'Grocery'; }
          if (route.name === 'profile') { icon = '👤'; label = 'Profile'; }

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
            >
              {isFocused && <View style={[styles.activeLine, { backgroundColor: colors.primary }]} />}
              <Text style={{ fontSize: isFocused ? 22 : 18, opacity: isFocused ? 1 : 0.5, textShadowColor: isFocused ? colors.primary : 'transparent', textShadowRadius: isFocused ? 10 : 0 }}>
                {icon}
              </Text>
              <Text style={{ color: isFocused ? colors.primary : '#888', fontSize: 10, marginTop: 4, fontWeight: isFocused ? '600' : '400' }}>
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
  const [mounted, setMounted] = useState(false);
  const colorScheme = useColorScheme();
  const colors = mounted ? Colors[colorScheme === 'dark' ? 'dark' : 'light'] : Colors.light;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <Tabs
      screenOptions={{
        headerShown: false }}
      tabBar={(props) => <CustomTabBar {...props} colors={colors} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="planner" />
      <Tabs.Screen name="progress" />
      <Tabs.Screen name="grocery" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 30 : 20,
    left: 20,
    right: 20 },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 30,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10 },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    position: 'relative',
    minWidth: 50 },
  activeLine: {
    position: 'absolute',
    top: -10,
    width: 20,
    height: 3,
    borderRadius: 2 }
});
