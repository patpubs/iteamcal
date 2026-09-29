import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
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

import { DesktopFormWidth, DesktopPageWidth, FontFamily, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useIsDesktop } from '@/hooks/use-layout';
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
      style={[styles.textBase, textStyles[variant], { color: muted ? theme.textMuted : theme.text }, style]}
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
  const desktop = useIsDesktop();
  const inner = (
    <View
      style={[
        styles.column,
        desktop && {
          maxWidth: underHeader ? DesktopFormWidth : DesktopPageWidth,
          paddingHorizontal: Spacing.xxl + Spacing.sm,
          paddingVertical: Spacing.xxl,
          gap: Spacing.xl - 4,
        },
      ]}>
      {children}
    </View>
  );
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
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, cardShadow, style]}>
      {children}
    </View>
  );
}

// A soft lift on the web, where flat cards on a flat page read as dull.
const cardShadow: ViewStyle =
  Platform.OS === 'web' ? { boxShadow: '0 1px 2px rgba(16, 40, 32, 0.04), 0 6px 20px rgba(16, 40, 32, 0.05)' } : {};

/**
 * Page title with actions beside it. On desktop the actions sit in the
 * header; on phones they wrap under the title.
 */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string | null;
  children?: ReactNode;
}) {
  const desktop = useIsDesktop();
  return (
    <View
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: desktop ? 'flex-end' : 'center',
        justifyContent: 'space-between',
        gap: Spacing.md,
      }}>
      <View style={{ flexShrink: 1, gap: 2 }}>
        <AppText
          variant="title"
          accessibilityRole="header"
          style={desktop ? { fontSize: 32, lineHeight: 38 } : undefined}>
          {title}
        </AppText>
        {subtitle ? <AppText muted>{subtitle}</AppText> : null}
      </View>
      {children ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm }}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Two columns side by side on desktop, stacked on phones. `side` is the
 * narrower column's width on desktop.
 */
export function Columns({
  main,
  side,
  sideWidth = 360,
  sideFirst,
}: {
  main: ReactNode;
  side: ReactNode;
  sideWidth?: number;
  /** Put the side column on the left on desktop, and first on phones. */
  sideFirst?: boolean;
}) {
  const desktop = useIsDesktop();
  if (!desktop) {
    return (
      <View style={{ gap: Spacing.lg }}>
        {sideFirst ? side : main}
        {sideFirst ? main : side}
      </View>
    );
  }
  const sideCol = <View style={{ width: sideWidth, gap: Spacing.lg }}>{side}</View>;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.xl }}>
      {sideFirst ? sideCol : null}
      <View style={{ flex: 1, minWidth: 0, gap: Spacing.lg }}>{main}</View>
      {sideFirst ? null : sideCol}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  /** Sized to its label, for toolbars and page headers. */
  compact?: boolean;
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, compact }: ButtonProps) {
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
        compact && styles.buttonCompact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.6 : pressed ? 0.85 : 1 },
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.textBase, styles.buttonLabel, compact && { fontSize: 15 }, { color: palette.fg }]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  error,
  accessory,
  ...props
}: TextInputProps & {
  label: string;
  error?: string | null;
  /** Shown beside the box, such as a button that opens a picker. */
  accessory?: ReactNode;
}) {
  const theme = useTheme();
  const input = (
    <TextInput
      placeholderTextColor={theme.textMuted}
      style={[
        styles.textBase,
        styles.input,
        accessory ? { flex: 1, minWidth: 0 } : null,
        {
          color: theme.text,
          backgroundColor: theme.surface,
          borderColor: error ? theme.danger : theme.border,
        },
      ]}
      {...props}
    />
  );
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      {accessory ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.xs }}>
          {input}
          {accessory}
        </View>
      ) : (
        input
      )}
      {error ? (
        <AppText style={{ color: theme.danger }} variant="caption">
          {error}
        </AppText>
      ) : null}
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
      {onPress ? (
        <Icon
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={16}
          color={theme.textMuted}
        />
      ) : null}
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
  buttonCompact: { minHeight: 40, paddingHorizontal: Spacing.lg, alignSelf: 'flex-start' },
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
