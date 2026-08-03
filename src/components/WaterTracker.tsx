import React, { useState, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/theme';

export default function WaterTracker() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme === 'dark' ? 'dark' : 'light'];

  const [waterMl, setWaterMl] = useState(1500);
  const [electrolytesTaken, setElectrolytesTaken] = useState(false);
  const targetMl = 3500;

  useEffect(() => {
    AsyncStorage.getItem('water_tracker_ml').then((val) => {
      if (val) setWaterMl(Number(val));
    });
    AsyncStorage.getItem('electrolytes_taken').then((val) => {
      if (val === 'true') setElectrolytesTaken(true);
    });
  }, []);

  const addWater = async (amount: number) => {
    const next = Math.min(5000, waterMl + amount);
    setWaterMl(next);
    await AsyncStorage.setItem('water_tracker_ml', String(next));
  };

  const toggleElectrolytes = async () => {
    const next = !electrolytesTaken;
    setElectrolytesTaken(next);
    await AsyncStorage.setItem('electrolytes_taken', String(next));
  };

  const pct = Math.min(100, Math.round((waterMl / targetMl) * 100));

  return (
    <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>💧 Water & Electrolyte Tracker</Text>
        <Text style={[styles.val, { color: colors.primary }]}>
          {(waterMl / 1000).toFixed(1)} / {(targetMl / 1000).toFixed(1)} L
        </Text>
      </View>

      {/* Progress Bar */}
      <View style={[styles.track, { backgroundColor: colors.backgroundElement }]}>
        <View style={[styles.fill, { backgroundColor: colors.primary, width: `${pct}%` }]} />
      </View>

      {/* Quick Action Buttons */}
      <View style={styles.btnRow}>
        <Pressable style={[styles.btn, { backgroundColor: colors.backgroundElement }]} onPress={() => addWater(250)}>
          <Text style={[styles.btnTxt, { color: colors.text }]}>+250ml 🥛</Text>
        </Pressable>
        <Pressable style={[styles.btn, { backgroundColor: colors.backgroundElement }]} onPress={() => addWater(500)}>
          <Text style={[styles.btnTxt, { color: colors.text }]}>+500ml 💧</Text>
        </Pressable>
        <Pressable
          style={[
            styles.btn,
            { backgroundColor: electrolytesTaken ? 'rgba(245, 158, 11, 0.2)' : colors.backgroundElement },
          ]}
          onPress={toggleElectrolytes}
        >
          <Text style={[styles.btnTxt, { color: electrolytesTaken ? colors.accent : colors.text }]}>
            {electrolytesTaken ? '✅ Salt Taken' : '+ Salt 🧂'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 18, borderWidth: 1, gap: 12, marginVertical: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '700' },
  val: { fontSize: 15, fontWeight: '800' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  btnRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 10, alignItems: 'center' },
  btnTxt: { fontSize: 13, fontWeight: '700' },
});
