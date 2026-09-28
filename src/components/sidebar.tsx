import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/providers/auth';

/**
 * Desktop navigation: the same tabs as the phone's bottom bar, as a left
 * sidebar with the app's name and the signed-in person.
 */
export function Sidebar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, isAdmin } = useAuth();
  const initial = (profile?.display_name ?? profile?.email ?? '?').charAt(0).toUpperCase();

  return (
    <View
      role="navigation"
      style={{
        width: 240,
        backgroundColor: theme.sidebar,
        paddingTop: insets.top + Spacing.xl,
        paddingBottom: insets.bottom + Spacing.lg,
        paddingHorizontal: Spacing.md,
        gap: Spacing.xl,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.sm }}>
        <Image
          source={require('../../assets/images/logo.png')}
          accessibilityIgnoresInvertColors
          style={{ width: 38, height: 38, borderRadius: 10 }}
        />
        <View>
          <Text style={{ fontFamily: FontFamily, color: theme.sidebarText, fontWeight: '700', fontSize: 18 }}>
            iTeamCal
          </Text>
          <Text style={{ fontFamily: FontFamily, color: theme.sidebarMuted, fontSize: 12 }}>Schedule & time cards</Text>
        </View>
      </View>

      <View style={{ gap: 4, flex: 1 }}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          // Tabs hidden with `href: null` (such as Timecards for people who don't need them).
          const itemStyle = options.tabBarItemStyle as { display?: string } | undefined;
          if (itemStyle?.display === 'none') return null;
          const focused = state.index === index;
          const color = focused ? theme.sidebarText : theme.sidebarMuted;
          const label = options.title ?? route.name;
          const badge = options.tabBarBadge;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={badge ? `${label}, ${badge} new` : label}
              onPress={onPress}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                gap: Spacing.md,
                height: 44,
                paddingHorizontal: Spacing.md,
                borderRadius: Radius.md,
                backgroundColor: focused || hovered ? theme.sidebarActive : 'transparent',
                opacity: pressed ? 0.8 : 1,
              })}>
              {options.tabBarIcon?.({ focused, color, size: 22 })}
              <Text
                style={{
                  flex: 1,
                  fontFamily: FontFamily,
                  color,
                  fontSize: 15,
                  fontWeight: focused ? '700' : '500',
                }}>
                {label}
              </Text>
              {badge != null ? (
                <View
                  style={{
                    minWidth: 22,
                    height: 22,
                    paddingHorizontal: 6,
                    borderRadius: 11,
                    backgroundColor: theme.danger,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                  <Text style={{ fontFamily: FontFamily, color: '#fff', fontSize: 12, fontWeight: '700' }}>
                    {String(badge)}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: Spacing.sm,
          paddingHorizontal: Spacing.sm,
          paddingTop: Spacing.md,
          borderTopWidth: 1,
          borderTopColor: theme.sidebarActive,
        }}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: theme.sidebarActive,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <Text style={{ fontFamily: FontFamily, color: theme.sidebarText, fontWeight: '700' }}>{initial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontFamily: FontFamily, color: theme.sidebarText, fontWeight: '600' }}>
            {profile?.display_name ?? profile?.email}
          </Text>
          <Text style={{ fontFamily: FontFamily, color: theme.sidebarMuted, fontSize: 12 }}>
            {isAdmin ? 'Admin' : 'Staff'}
          </Text>
        </View>
      </View>
    </View>
  );
}
