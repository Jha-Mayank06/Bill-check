import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { ROLE_LABEL } from '../format';
import { Button, Card, Chips, ErrorText, Field, colors, styles } from '../ui';

const ROLE_OPTIONS = [
  { label: 'Cashier', value: 'cashier' },
  { label: 'Driver', value: 'driver' },
  { label: 'Admin', value: 'admin' },
];

// Admin: create every person's account, disable accounts and reset passwords.
export default function StaffScreen() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers((await api.listUsers()).users);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (adding) {
    return (
      <AddUser
        onDone={() => {
          setAdding(false);
          load();
        }}
      />
    );
  }

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => String(u.id)}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 4 }}>
          <Button title="+ Add person" onPress={() => setAdding(true)} testID="staff-add" />
          <ErrorText>{error}</ErrorText>
        </View>
      }
      renderItem={({ item }) => <UserCard user={item} isMe={item.id === me.id} onChanged={load} />}
    />
  );
}

function UserCard({ user, isMe, onChanged }) {
  const [resetting, setResetting] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  async function update(changes, doneNote) {
    setBusy(true);
    setError('');
    try {
      await api.updateUser(user.id, changes);
      setNote(doneNote);
      setResetting(false);
      setPassword('');
      onChanged();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={!user.active && { opacity: 0.6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{user.name}</Text>
        <Text style={styles.muted}>{ROLE_LABEL[user.role]}</Text>
      </View>
      <Text style={styles.muted}>
        ID {user.empId}
        {user.phone ? ` · ${user.phone}` : ''}
        {user.active ? '' : ' · Disabled'}
      </Text>
      {note ? <Text style={{ color: colors.success, marginTop: 6 }}>{note}</Text> : null}
      <ErrorText>{error}</ErrorText>
      {resetting ? (
        <View style={{ marginTop: 10 }}>
          <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button title="Save" style={{ flex: 1 }} loading={busy} onPress={() => update({ password }, 'Password changed')} />
            <Button title="Back" variant="ghost" style={{ flex: 1 }} onPress={() => setResetting(false)} />
          </View>
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button title="Reset password" variant="ghost" style={{ flex: 1 }} onPress={() => setResetting(true)} />
          {!isMe && (
            <Button
              title={user.active ? 'Disable' : 'Enable'}
              variant={user.active ? 'danger' : 'success'}
              style={{ flex: 1 }}
              loading={busy}
              onPress={() => update({ active: !user.active }, user.active ? 'Account disabled' : 'Account enabled')}
            />
          )}
        </View>
      )}
    </Card>
  );
}

function AddUser({ onDone }) {
  const [form, setForm] = useState({ role: 'driver', empId: '', name: '', phone: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    setBusy(true);
    setError('');
    try {
      await api.createUser({ ...form, phone: form.phone || undefined });
      onDone();
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16 }}>
          <Text style={[styles.h2, { marginBottom: 14 }]}>Add person</Text>
          <Text style={styles.label}>Role</Text>
          <Chips options={ROLE_OPTIONS} value={form.role} onChange={set('role')} />
          <Field label="Employee ID (used to log in)" value={form.empId} onChangeText={set('empId')} autoCapitalize="characters" autoCorrect={false} testID="user-empid" />
          <Field label="Full name" value={form.name} onChangeText={set('name')} testID="user-name" />
          <Field label="Mobile (optional)" value={form.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
          <Field label="Password (min 6 characters)" value={form.password} onChangeText={set('password')} secureTextEntry testID="user-password" />
          <ErrorText>{error}</ErrorText>
          <Button title="Create account" onPress={submit} loading={busy} testID="user-submit" />
          <Button title="Back" variant="ghost" style={{ marginTop: 10 }} onPress={onDone} />
    </ScrollView>
  );
}
