import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { STATUS_COLOR, STATUS_LABEL } from './format';

export const colors = {
  bg: '#f4f5f7',
  card: '#ffffff',
  text: '#1b1f24',
  muted: '#5f6b7a',
  border: '#dde1e6',
  primary: '#1d4ed8',
  danger: '#b42318',
  success: '#1f7a3d',
};

export function Button({ title, onPress, variant = 'primary', disabled, loading, style, testID }) {
  const bg = { primary: colors.primary, danger: colors.danger, success: colors.success, ghost: 'transparent' }[variant];
  const fg = variant === 'ghost' ? colors.primary : '#fff';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        variant === 'ghost' && { borderWidth: 1, borderColor: colors.primary },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={[styles.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  );
}

export function Field({ label, ...props }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#9aa4b2" style={styles.input} {...props} />
    </View>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function StatusBadge({ status }) {
  const color = STATUS_COLOR[status] || colors.muted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{STATUS_LABEL[status] || status}</Text>
    </View>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <Text style={styles.error}>{children}</Text>;
}

export function Row({ label, value }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
          >
            <Text style={{ color: active ? '#fff' : colors.text, fontWeight: '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  button: { paddingVertical: 13, paddingHorizontal: 16, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 14, color: colors.muted, marginBottom: 6, fontWeight: '500' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: colors.text,
  },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: colors.border },
  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '700' },
  error: { color: colors.danger, marginBottom: 12, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, gap: 12 },
  rowLabel: { color: colors.muted, fontSize: 14 },
  rowValue: { color: colors.text, fontSize: 14, fontWeight: '500', flexShrink: 1, textAlign: 'right' },
  h1: { fontSize: 22, fontWeight: '700', color: colors.text },
  h2: { fontSize: 17, fontWeight: '700', color: colors.text, marginBottom: 8 },
  muted: { color: colors.muted, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
});
