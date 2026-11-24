import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { api } from '../api';
import { formatDuration, formatTime } from '../format';
import { Card, Chips, ErrorText, StatusBadge, colors, styles } from '../ui';

const STAFF_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'created,assigned,loaded,left' },
  { label: 'Delivered', value: 'delivered' },
  { label: 'Cancelled', value: 'cancelled' },
];

const DRIVER_FILTERS = [
  { label: 'To deliver', value: 'assigned,loaded,left' },
  { label: 'Delivered', value: 'delivered' },
];

// History list of bills. Drivers only ever get their own bills from the server.
export default function BillsScreen({ role, onOpen, refreshKey }) {
  const filters = role === 'driver' ? DRIVER_FILTERS : STAFF_FILTERS;
  const [status, setStatus] = useState(filters[0].value);
  const [q, setQ] = useState('');
  const [bills, setBills] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { bills: list } = await api.listBills({ status, q: q.trim(), limit: 100 });
      setBills(list);
      setError('');
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [status, q]);

  useEffect(() => {
    const t = setTimeout(load, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, q, refreshKey]);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search bill no, name or phone"
          placeholderTextColor="#9aa4b2"
          style={[styles.input, { marginBottom: 12 }]}
          testID="bills-search"
        />
        <Chips options={filters} value={status} onChange={setStatus} />
        <ErrorText>{error}</ErrorText>
      </View>
      <FlatList
        data={bills}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 10 }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading && <Text style={[styles.muted, { textAlign: 'center', marginTop: 32 }]}>No bills here yet</Text>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => onOpen(item)} testID={`bill-${item.billNo}`}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>#{item.billNo}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={{ marginTop: 6, fontSize: 15, color: colors.text }}>{item.receiverName}</Text>
              <Text style={[styles.muted, { marginTop: 2 }]}>
                {formatTime(item.createdAt)}
                {item.driver ? ` · ${item.driver.name}` : ''}
                {item.durationMinutes !== null ? ` · took ${formatDuration(item.durationMinutes)}` : ''}
              </Text>
            </Card>
          </Pressable>
        )}
      />
    </View>
  );
}
