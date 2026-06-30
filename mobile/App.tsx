import { StatusBar } from 'expo-status-bar';
import { FormEvent, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_URL = 'http://10.0.2.2:3000';

type User = {
  name?: string;
  email: string;
  role?: string;
};

const DEMO_ACCOUNTS = [
  { label: 'Demo Admin', email: 'admin@demo.com', password: 'demo1234' },
  { label: 'Demo User', email: 'user@demo.com', password: 'demo1234' },
];

export default function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [user, setUser] = useState<User | null>(null);

  async function login(loginEmail: string, loginPassword: string) {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      setUser(data.user);
    } catch (requestError) {
      const message =
        requestError instanceof Error ? requestError.message : 'Unable to connect to the server';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function demoLogin(account: (typeof DEMO_ACCOUNTS)[number]) {
    setLoading(true);
    setError('');

    try {
      await fetch(`${API_URL}/api/auth/seed-demo`, { method: 'POST' });
    } catch {
      // Login still runs when the demo account already exists.
    }

    await login(account.email, account.password);
  }

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }
    login(email.trim(), password);
  }

  if (user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.dashboard}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>IP</Text>
          </View>
          <Text style={styles.welcome}>Welcome back</Text>
          <Text style={styles.userName}>{user.name || user.email}</Text>
          <Text style={styles.role}>{user.role || 'Team member'}</Text>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>MOBILE APP</Text>
            <Text style={styles.summaryTitle}>You’re signed in</Text>
            <Text style={styles.summaryText}>
              The native app is connected to your quotation system API.
            </Text>
          </View>

          <Pressable style={styles.secondaryButton} onPress={() => setUser(null)}>
            <Text style={styles.secondaryButtonText}>Sign out</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brand}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>IP</Text>
            </View>
            <Text style={styles.title}>IP Law Firm</Text>
            <Text style={styles.subtitle}>Quotation Management System</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign in to your account</Text>

            <Text style={styles.sectionLabel}>QUICK DEMO ACCESS</Text>
            <View style={styles.demoRow}>
              {DEMO_ACCOUNTS.map((account, index) => (
                <Pressable
                  key={account.email}
                  disabled={loading}
                  onPress={() => demoLogin(account)}
                  style={({ pressed }) => [
                    styles.demoButton,
                    index === 1 && styles.demoButtonMuted,
                    (pressed || loading) && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.demoButtonText}>{account.label}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.demoHint}>password: demo1234</Text>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or sign in with your account</Text>
              <View style={styles.divider} />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <Text style={styles.label}>Email address</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              autoComplete="current-password"
              placeholder="••••••••"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={() => submit()}
            />

            <Pressable
              disabled={loading}
              onPress={() => submit()}
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || loading) && styles.buttonPressed,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Sign in</Text>
              )}
            </Pressable>

            <Pressable onPress={() => Alert.alert('Registration', 'Registration is coming next.')}>
              <Text style={styles.registerText}>
                Don’t have an account? <Text style={styles.registerLink}>Register</Text>
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: '#F5F7FA' },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  brand: { alignItems: 'center', marginBottom: 28 },
  logo: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1739',
    marginBottom: 14,
  },
  logoText: { color: '#FFFFFF', fontSize: 19, fontWeight: '800' },
  title: { color: '#111827', fontSize: 25, fontWeight: '800' },
  subtitle: { color: '#6B7280', fontSize: 14, marginTop: 5 },
  card: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    padding: 22,
    shadowColor: '#0B1739',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
  },
  cardTitle: { color: '#111827', fontSize: 19, fontWeight: '700', marginBottom: 22 },
  sectionLabel: {
    color: '#6B7280',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 9,
  },
  demoRow: { flexDirection: 'row', gap: 9 },
  demoButton: {
    flex: 1,
    minHeight: 43,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#0B1739',
  },
  demoButtonMuted: { backgroundColor: '#4B5563' },
  demoButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  demoHint: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 9,
    marginBottom: 18,
  },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  divider: { flex: 1, height: 1, backgroundColor: '#E5E7EB' },
  dividerText: { color: '#9CA3AF', fontSize: 11, marginHorizontal: 9 },
  errorBox: {
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 9,
    backgroundColor: '#FEF2F2',
    padding: 11,
    marginBottom: 15,
  },
  errorText: { color: '#B91C1C', fontSize: 13 },
  label: { color: '#374151', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: {
    height: 47,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    color: '#111827',
    fontSize: 14,
    paddingHorizontal: 13,
    marginBottom: 16,
  },
  primaryButton: {
    height: 47,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    backgroundColor: '#2563EB',
    marginTop: 2,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  buttonPressed: { opacity: 0.65 },
  registerText: { color: '#6B7280', fontSize: 13, textAlign: 'center', marginTop: 17 },
  registerLink: { color: '#2563EB', fontWeight: '700' },
  dashboard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  welcome: { color: '#6B7280', fontSize: 15 },
  userName: { color: '#111827', fontSize: 25, fontWeight: '800', marginTop: 4 },
  role: { color: '#2563EB', fontSize: 13, fontWeight: '700', marginTop: 6 },
  summaryCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 22,
    marginTop: 30,
  },
  summaryLabel: { color: '#2563EB', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  summaryTitle: { color: '#111827', fontSize: 20, fontWeight: '800', marginTop: 8 },
  summaryText: { color: '#6B7280', fontSize: 14, lineHeight: 21, marginTop: 7 },
  secondaryButton: {
    width: '100%',
    maxWidth: 420,
    height: 47,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginTop: 14,
  },
  secondaryButtonText: { color: '#374151', fontSize: 14, fontWeight: '700' },
});
