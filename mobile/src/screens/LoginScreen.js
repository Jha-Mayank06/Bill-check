import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { useAuth } from '../auth';
import { Button, ErrorText, Field, colors, styles } from '../ui';

export default function LoginScreen() {
  const { login } = useAuth();
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!empId.trim() || !password) return setError('Enter your employee ID and password');
    setBusy(true);
    setError('');
    try {
      await login(empId, password);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}>
        <View style={{ marginBottom: 28 }}>
          <Text style={[styles.h1, { fontSize: 28 }]}>Bill Check</Text>
          <Text style={[styles.muted, { marginTop: 4 }]}>Sign in with the ID your admin gave you</Text>
        </View>
        <Field
          label="Employee ID"
          value={empId}
          onChangeText={setEmpId}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="e.g. DRV-01"
          testID="login-empid"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={submit}
          testID="login-password"
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Sign in" onPress={submit} loading={busy} testID="login-submit" />
        <Text style={[styles.muted, { marginTop: 20, color: colors.muted, textAlign: 'center' }]}>
          Forgot your password? Ask your admin to reset it.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
