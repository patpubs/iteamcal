import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type ColorValue,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FontFamily, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type TextVariant = 'title' | 'heading' | 'body' | 'label' | 'caption';

export function AppText({
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & { variant?: TextVariant; muted?: boolean }) {
  const theme = useTheme();
  return (
    <Text
      style={[
        styles.textBase,
        textStyles[variant],
        { color: muted ? theme.textMuted : theme.text },
        style,
      ]}
      {...rest}
    />
  );
}

/** Page wrapper: safe areas, scrolling, and a centered column on wide screens. */
export function Screen({
  children,
  scroll = true,
  underHeader = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** True when a navigation header already covers the top safe area. */
  underHeader?: boolean;
}) {
  const theme = useTheme();
  const inner = <View style={styles.column}>{children}</View>;
  return (
    <SafeAreaView
      edges={underHeader ? ['left', 'right'] : ['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: theme.background }]}>
      {scroll ? <ScrollView contentContainerStyle={styles.scrollContent}>{inner}</ScrollView> : inner}
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const theme = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled }: ButtonProps) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.primary, fg: theme.primaryText, border: theme.primary },
    secondary: { bg: theme.surface, fg: theme.text, border: theme.border },
    danger: { bg: theme.dangerSoft, fg: theme.danger, border: theme.dangerSoft },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.6 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.textBase, styles.buttonLabel, { color: palette.fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string | null }) {
  const theme = useTheme();
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[
          styles.textBase,
          styles.input,
          {
            color: theme.text,
            backgroundColor: theme.surface,
            borderColor: error ? theme.danger : theme.border,
          },
        ]}
        {...props}
      />
      {error ? <AppText style={{ color: theme.danger }} variant="caption">{error}</AppText> : null}
    </View>
  );
}

export function Icon({ name, size = 22, color }: { name: SymbolViewProps['name']; size?: number; color?: ColorValue }) {
  const theme = useTheme();
  return <SymbolView name={name} size={size} tintColor={color ?? theme.text} />;
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.primary} size="large" />
    </View>
  );
}

/** Shown on tabs whose features land in a later build phase. */
export function ComingSoon({ title, phase, items }: { title: string; phase: string; items: string[] }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={[styles.pill, { backgroundColor: theme.accentSoft }]}>
        <AppText variant="caption" style={{ color: theme.accent, fontWeight: '600' }}>
          {phase}
        </AppText>
      </View>
      <AppText variant="heading">{title}</AppText>
      <View style={{ gap: Spacing.xs }}>
        {items.map((item) => (
          <AppText key={item} muted>
            • {item}
          </AppText>
        ))}
      </View>
    </Card>
  );
}

type Tone = 'neutral' | 'primary' | 'accent' | 'danger';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const theme = useTheme();
  const colors = {
    neutral: { bg: theme.surfaceMuted, fg: theme.textMuted },
    primary: { bg: theme.primarySoft, fg: theme.primary },
    accent: { bg: theme.accentSoft, fg: theme.accent },
    danger: { bg: theme.dangerSoft, fg: theme.danger },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: colors.bg }]}>
      <AppText variant="caption" style={{ color: colors.fg, fontWeight: '600' }}>
        {label}
      </AppText>
    </View>
  );
}

export function ColorDot({ color, size = 12 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

/** A tappable row inside a Card list. */
export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  footer,
  onPress,
}: {
  title: string;
  subtitle?: string | null;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Extra content under the subtitle, such as badges. */
  footer?: ReactNode;
  onPress?: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}>
      {leading}
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{title}</AppText>
        {subtitle ? (
          <AppText variant="caption" muted numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {footer}
      </View>
      {trailing}
      {onPress ? <Icon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border }} />;
}

export function SwitchRow({
  label,
  help,
  value,
  onValueChange,
}: {
  label: string;
  help?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="label">{label}</AppText>
        {help ? (
          <AppText variant="caption" muted>
            {help}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: theme.primary, false: theme.surfaceMuted }}
        thumbColor={theme.surface}
      />
    </View>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="caption" muted style={styles.sectionTitle}>
      {children.toUpperCase()}
    </AppText>
  );
}

export function ErrorText({ children }: { children: string | null | undefined }) {
  const theme = useTheme();
  if (!children) return null;
  return (
    <AppText variant="caption" style={{ color: theme.danger }} accessibilityRole="alert">
      {children}
    </AppText>
  );
}

/** A row of mutually exclusive options, like Week / Month / List. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: theme.surfaceMuted, borderRadius: Radius.md, padding: 3 }}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 7,
              borderRadius: Radius.sm,
              backgroundColor: selected ? theme.surface : 'transparent',
            }}>
            <AppText variant="label" style={{ color: selected ? theme.text : theme.textMuted }}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** A compact round button holding one icon, for toolbars. */
export function IconButton({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: SymbolViewProps['name'];
  /** Read aloud by screen readers; the button shows only the icon. */
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? theme.surfaceMuted : 'transparent',
        opacity: disabled ? 0.35 : 1,
      })}>
      <Icon name={icon} size={20} color={theme.text} />
    </Pressable>
  );
}

/** A small pill button, for short secondary actions like "Today". */
export function Chip({
  label,
  onPress,
  selected,
  color,
}: {
  label: string;
  onPress: () => void;
  selected?: boolean;
  /** Dot shown before the label, such as a crew color. */
  color?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: Spacing.md,
        paddingVertical: 6,
        borderRadius: Radius.pill,
        borderWidth: 1,
        borderColor: selected ? theme.primary : theme.border,
        backgroundColor: selected ? theme.primarySoft : theme.surface,
        opacity: pressed ? 0.8 : 1,
      })}>
      {color ? <ColorDot color={color} size={10} /> : null}
      <AppText variant="label" style={{ color: selected ? theme.primary : theme.text }}>
        {label}
      </AppText>
    </Pressable>
  );
}

const textStyles = StyleSheet.create({
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 23 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18 },
});

const styles = StyleSheet.create({
  textBase: { fontFamily: FontFamily },
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.lg,
  },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  field: { gap: Spacing.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    fontSize: 16,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 48,
    paddingVertical: Spacing.sm,
  },
  sectionTitle: { letterSpacing: 0.6, fontWeight: '600', marginTop: Spacing.sm },
  pill: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
