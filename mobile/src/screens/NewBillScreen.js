import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { api } from '../api';
import { Button, Chips, ErrorText, Field, styles } from '../ui';

const EMPTY = { billNo: '', receiverName: '', receiverPhone: '', address: '', lotDetails: '' };

// Cashier at the counter: creating the bill starts the clock.
export default function NewBillScreen({ onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [driverId, setDriverId] = useState(null);
  const [drivers, setDrivers] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.listUsers('driver').then(({ users }) => setDrivers(users)).catch((e) => setError(e.message));
  }, []);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function submit() {
    if (!form.billNo.trim() || !form.receiverName.trim() || !form.receiverPhone.trim()) {
      return setError('Bill no, receiver name and receiver phone are required');
    }
    setBusy(true);
    setError('');
    try {
      const { bill } = await api.createBill({ ...form, driverId: driverId || undefined });
      setForm(EMPTY);
      setDriverId(null);
      onCreated(bill);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={[styles.h2, { marginBottom: 14 }]}>New bill</Text>
      <Field label="Bill no" value={form.billNo} onChangeText={set('billNo')} autoCapitalize="characters" testID="bill-no" />
      <Field label="Receiver name" value={form.receiverName} onChangeText={set('receiverName')} testID="bill-receiver" />
      <Field
        label="Receiver phone (OTP goes here)"
        value={form.receiverPhone}
        onChangeText={set('receiverPhone')}
        keyboardType="phone-pad"
        placeholder="10-digit mobile"
        testID="bill-phone"
      />
      <Field label="Address (optional)" value={form.address} onChangeText={set('address')} multiline />
      <Field
        label="Lot details (optional)"
        value={form.lotDetails}
        onChangeText={set('lotDetails')}
        placeholder="e.g. 20 bags cement, 5 boxes tiles"
        multiline
        testID="bill-lot"
      />
      <Text style={styles.label}>Assign driver (you can also do this later)</Text>
      {drivers.length ? (
        <Chips
          options={[{ label: 'Later', value: null }, ...drivers.map((d) => ({ label: d.name, value: d.id }))]}
          value={driverId}
          onChange={setDriverId}
        />
      ) : (
        <Text style={[styles.muted, { marginBottom: 14 }]}>No active drivers yet. Ask the admin to add one.</Text>
      )}
      <ErrorText>{error}</ErrorText>
      <Button title="Create bill and start time" onPress={submit} loading={busy} testID="bill-submit" />
    </ScrollView>
  );
}
