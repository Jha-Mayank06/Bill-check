import { useEffect, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/auth';
import { ROLE_LABEL } from './src/format';
import { colors } from './src/ui';
import LoginScreen from './src/screens/LoginScreen';
import BillsScreen from './src/screens/BillsScreen';
import BillDetailScreen from './src/screens/BillDetailScreen';
import NewBillScreen from './src/screens/NewBillScreen';
import StaffScreen from './src/screens/StaffScreen';

const TABS = {
  admin: [
    { key: 'bills', label: 'Bills' },
    { key: 'new', label: 'New bill' },
    { key: 'staff', label: 'People' },
  ],
  cashier: [
    { key: 'new', label: 'New bill' },
    { key: 'bills', label: 'Bills' },
  ],
  driver: [{ key: 'bills', label: 'My loads' }],
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
          <StatusBar style="dark" />
          <Root />
        </SafeAreaView>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return user ? <Home key={user.id} user={user} /> : <LoginScreen />;
}

function Home({ user }) {
  const { logout } = useAuth();
  const tabs = TABS[user.role];
  const [tab, setTab] = useState(tabs[0].key);
  const [openBillId, setOpenBillId] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Android back button closes an open bill.
  useEffect(() => {
    if (!openBillId) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setOpenBillId(null);
      return true;
    });
    return () => sub.remove();
  }, [openBillId]);

  const refresh = () => setRefreshKey((k) => k + 1);

  let body;
  if (openBillId) {
    body = <BillDetailScreen billId={openBillId} onChanged={refresh} />;
  } else if (tab === 'new') {
    body = <NewBillScreen onCreated={(bill) => setOpenBillId(bill.id)} />;
  } else if (tab === 'staff') {
    body = <StaffScreen />;
  } else {
    body = <BillsScreen role={user.role} refreshKey={refreshKey} onOpen={(bill) => setOpenBillId(bill.id)} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          backgroundColor: '#fff',
        }}
      >
        {openBillId ? (
          <Pressable onPress={() => setOpenBillId(null)} hitSlop={12} testID="nav-back">
            <Text style={{ color: colors.primary, fontSize: 16, fontWeight: '600' }}>‹ Back</Text>
          </Pressable>
        ) : (
          <View>
            <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{user.name}</Text>
            <Text style={{ color: colors.muted, fontSize: 13 }}>
              {ROLE_LABEL[user.role]} · {user.empId}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }} />
        <Pressable onPress={logout} hitSlop={12} testID="nav-logout">
          <Text style={{ color: colors.danger, fontWeight: '600' }}>Log out</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>{body}</View>

      {tabs.length > 1 && !openBillId && (
        <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: '#fff' }}>
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={{ flex: 1, paddingVertical: 14, alignItems: 'center' }}
              testID={`tab-${t.key}`}
            >
              <Text style={{ fontWeight: '700', color: tab === t.key ? colors.primary : colors.muted }}>{t.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}
