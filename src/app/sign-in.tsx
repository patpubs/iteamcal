import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AppText, Button, Card, Field, Screen } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: Platform.OS === 'web' ? window.location.origin : undefined,
      },
    });
    setBusy(false);
    if (sendError) {
      setError(
        sendError.status === 429
          ? 'Too many sign-in emails were sent. Wait a few minutes and try again.'
          : sendError.message,
      );
      return;
    }
    setSentTo(address);
  }

  async function verifyCode() {
    if (!sentTo) return;
    const token = code.replace(/\s/g, '');
    if (!/^\d{6,10}$/.test(token)) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: sentTo, token, type: 'email' });
    setBusy(false);
    if (verifyError) setError('That code didn’t work. Check it, or send a new one.');
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.wrap}>
        <View style={styles.brand}>
          <View style={[styles.logo, { backgroundColor: theme.primary }]}>
            <AppText style={[styles.logoText, { color: theme.primaryText }]}>iT</AppText>
          </View>
          <AppText variant="title">iTeamCal</AppText>
          <AppText muted>Schedules, time off, and timecards for the team.</AppText>
        </View>

        <Card>
          {sentTo ? (
            <>
              <AppText variant="heading">Check your email</AppText>
              <AppText muted>
                We sent a sign-in email to {sentTo}. Tap the link in it
                {Platform.OS === 'web' ? ' on this device' : ''}, or enter the code below.
              </AppText>
              <Field
                label="Code"
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                placeholder="123456"
                error={error}
                onSubmitEditing={verifyCode}
              />
              <Button label="Sign in" onPress={verifyCode} loading={busy} />
              <Button
                label="Use a different email"
                variant="secondary"
                onPress={() => {
                  setSentTo(null);
                  setCode('');
                  setError(null);
                }}
              />
            </>
          ) : (
            <>
              <AppText variant="heading">Sign in</AppText>
              <AppText muted>No password needed. We’ll email you a sign-in link and code.</AppText>
              <Field
                label="Work email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                textContentType="emailAddress"
                placeholder="you@company.com"
                error={error}
                onSubmitEditing={sendCode}
              />
              <Button label="Email me a sign-in link" onPress={sendCode} loading={busy} />
            </>
          )}
        </Card>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 440, alignSelf: 'center', gap: Spacing.xl, paddingTop: Spacing.xxl },
  brand: { gap: Spacing.sm },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 20, fontWeight: '800' },
});
