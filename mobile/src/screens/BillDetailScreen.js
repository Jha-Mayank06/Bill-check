import { useCallback, useEffect, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { api } from '../api';
import { useAuth } from '../auth';
import { EVENT_LABEL, formatDuration, formatTime } from '../format';
import { Button, Card, Chips, ErrorText, Field, Row, StatusBadge, colors, styles } from '../ui';

export default function BillDetailScreen({ billId, onChanged }) {
  const { user } = useAuth();
  const [bill, setBill] = useState(null);
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [testOtp, setTestOtp] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api.getBill(billId);
      setBill(data.bill);
      setEvents(data.events);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }, [billId]);

  useEffect(() => {
    load();
  }, [load]);

  // Runs an action, then reloads the bill and history.
  const run = (name, fn) => async () => {
    setBusy(name);
    setError('');
    try {
      const result = await fn();
      if (result?.testOtp) setTestOtp(result.testOtp);
      await load();
      onChanged?.();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  if (!bill) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorText>{error}</ErrorText>
        {!error && <Text style={styles.muted}>Loading…</Text>}
      </View>
    );
  }

  const isStaff = user.role === 'cashier' || user.role === 'admin';
  const isMyDelivery = user.role === 'driver' && bill.driver?.id === user.id;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 12 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      keyboardShouldPersistTaps="handled"
    >
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.h1}>#{bill.billNo}</Text>
          <StatusBadge status={bill.status} />
        </View>
        <Text style={[styles.muted, { marginTop: 4, fontSize: 12 }]} selectable>
          ID {bill.id}
        </Text>
        <View style={{ marginTop: 10 }}>
          <Row label="Receiver" value={bill.receiverName} />
          <Row label="Phone" value={bill.receiverPhone} />
          {bill.address ? <Row label="Address" value={bill.address} /> : null}
          {bill.lotDetails ? <Row label="Lot" value={bill.lotDetails} /> : null}
          <Row label="Cashier" value={bill.cashier.name} />
          <Row label="Driver" value={bill.driver ? `${bill.driver.name} (${bill.driver.empId})` : 'Not assigned'} />
        </View>
      </Card>

      {bill.finalized && (
        <Card style={{ borderColor: colors.success, borderWidth: 2 }}>
          <Text style={[styles.h2, { color: colors.success }]}>✓ Finalized</Text>
          <Row label="Created at counter" value={formatTime(bill.createdAt)} />
          <Row label="Reached customer" value={formatTime(bill.reachedAt)} />
          <Row label="Total time" value={formatDuration(bill.durationMinutes)} />
          <Row label="Stamped by cashier" value={bill.cashier.name} />
        </Card>
      )}

      <ErrorText>{error}</ErrorText>

      {isMyDelivery && <DriverActions bill={bill} busy={busy} run={run} testOtp={testOtp} setTestOtp={setTestOtp} />}
      {isStaff && <StaffActions bill={bill} busy={busy} run={run} />}

      <Card>
        <Text style={styles.h2}>Timeline</Text>
        {events.map((e, i) => (
          <View key={i} style={{ paddingVertical: 6, borderTopWidth: i ? 1 : 0, borderTopColor: colors.border }}>
            <Text style={{ color: colors.text, fontWeight: '500' }}>{EVENT_LABEL[e.event] || e.event}</Text>
            <Text style={styles.muted}>
              {formatTime(e.at)}
              {e.by ? ` · ${e.by}` : ''}
              {e.note ? ` · ${e.note}` : ''}
            </Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

function DriverActions({ bill, busy, run, testOtp, setTestOtp }) {
  const [otp, setOtp] = useState('');

  if (bill.status === 'assigned') {
    return (
      <Button
        title="Mark lot as loaded"
        onPress={run('loaded', () => api.markLoaded(bill.id))}
        loading={busy === 'loaded'}
        testID="action-loaded"
      />
    );
  }
  if (bill.status === 'loaded') {
    return (
      <Button
        title="Leaving now (sends OTP to customer)"
        onPress={run('left', () => api.markLeft(bill.id))}
        loading={busy === 'left'}
        testID="action-left"
      />
    );
  }
  if (bill.status !== 'left') return null;

  const deliver = async () => {
    const ok = await run('deliver', () => api.deliver(bill.id, otp.trim()))();
    if (ok) {
      setOtp('');
      setTestOtp(null);
    }
  };

  return (
    <Card>
      <Text style={styles.h2}>Delivery OTP</Text>
      <Text style={[styles.muted, { marginBottom: 12 }]}>
        Ask {bill.receiverName} for the 6-digit OTP sent to their phone ending {bill.receiverPhone.slice(-4)}.
      </Text>
      {testOtp && (
        <View style={{ backgroundColor: '#fff7e0', borderRadius: 8, padding: 10, marginBottom: 12 }}>
          <Text style={{ color: '#7a5600' }} testID="test-otp">
            Test mode, no SMS sent. Customer OTP: <Text style={{ fontWeight: '700' }}>{testOtp}</Text>
          </Text>
        </View>
      )}
      <Field
        label="OTP"
        value={otp}
        onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        testID="otp-input"
      />
      <Button
        title="Confirm delivery"
        variant="success"
        onPress={deliver}
        disabled={otp.length !== 6}
        loading={busy === 'deliver'}
        testID="action-deliver"
      />
      <Button
        title="Resend OTP"
        variant="ghost"
        style={{ marginTop: 10 }}
        onPress={run('resend', () => api.resendOtp(bill.id))}
        loading={busy === 'resend'}
      />
    </Card>
  );
}

function StaffActions({ bill, busy, run }) {
  const [drivers, setDrivers] = useState([]);
  const [driverId, setDriverId] = useState(bill.driver?.id ?? null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const canAssign = bill.status === 'created' || bill.status === 'assigned';
  const canCancel = bill.status !== 'delivered' && bill.status !== 'cancelled';

  useEffect(() => {
    if (canAssign) api.listUsers('driver').then(({ users }) => setDrivers(users)).catch(() => {});
  }, [canAssign]);

  if (!canAssign && !canCancel) return null;

  return (
    <Card>
      {canAssign && (
        <>
          <Text style={styles.h2}>{bill.driver ? 'Change driver' : 'Assign driver'}</Text>
          <Chips options={drivers.map((d) => ({ label: d.name, value: d.id }))} value={driverId} onChange={setDriverId} />
          <Button
            title="Save driver"
            onPress={run('assign', () => api.assignBill(bill.id, driverId))}
            disabled={!driverId || driverId === bill.driver?.id}
            loading={busy === 'assign'}
            testID="action-assign"
          />
        </>
      )}
      {canCancel &&
        (confirmCancel ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={styles.muted}>Cancel this bill? This cannot be undone.</Text>
            <Button title="Yes, cancel bill" variant="danger" onPress={run('cancel', () => api.cancelBill(bill.id))} loading={busy === 'cancel'} />
            <Button title="Keep it" variant="ghost" onPress={() => setConfirmCancel(false)} />
          </View>
        ) : (
          <Button title="Cancel bill" variant="ghost" style={{ marginTop: 12 }} onPress={() => setConfirmCancel(true)} />
        ))}
    </Card>
  );
}
