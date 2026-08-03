import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://icsosdyzwwnxhhztmwef.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imljc29zZHl6d3dueGhoenRtd2VmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NjU0MDUsImV4cCI6MjEwMTM0MTQwNX0.EHF3htOqBryyQ5o2xCbsCkviqfi046PA0BCStbTeyg4';

// SecureStore adapter for Supabase auth token persistence
const secureStoreAdapter = Platform.OS !== 'web' ? {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
} : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
