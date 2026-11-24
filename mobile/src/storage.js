// Token storage: encrypted SecureStore on phones, localStorage on web.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'billcheck.token';

export async function getToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
  return SecureStore.getItemAsync(KEY);
}

export async function setToken(token) {
  if (Platform.OS === 'web') return globalThis.localStorage?.setItem(KEY, token);
  return SecureStore.setItemAsync(KEY, token);
}

export async function clearToken() {
  if (Platform.OS === 'web') return globalThis.localStorage?.removeItem(KEY);
  return SecureStore.deleteItemAsync(KEY);
}
