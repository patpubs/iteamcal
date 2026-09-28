import { Platform } from 'react-native';

// iTeamCal palette: deep pine for actions, warm amber for "now" moments
// (clocked in, today), and blue-grey neutrals.
export const Colors = {
  light: {
    background: '#F4F6F5',
    surface: '#FFFFFF',
    surfaceMuted: '#E9EDEB',
    border: '#D5DCD9',
    text: '#15201D',
    textMuted: '#5B6A66',
    primary: '#1F6F5C',
    primaryText: '#FFFFFF',
    primarySoft: '#DCEEE8',
    accent: '#C77D12',
    accentSoft: '#FBEBD2',
    danger: '#B42318',
    dangerSoft: '#FDE7E4',
    sidebar: '#10352C',
    sidebarText: '#E9F3EF',
    sidebarMuted: '#9BB8AE',
    sidebarActive: 'rgba(255,255,255,0.12)',
  },
  dark: {
    background: '#0F1513',
    surface: '#18201D',
    surfaceMuted: '#212B28',
    border: '#2E3A36',
    text: '#E7EEEB',
    textMuted: '#9AABA6',
    primary: '#4FBF9F',
    primaryText: '#062019',
    primarySoft: '#173A31',
    accent: '#F0A93C',
    accentSoft: '#3A2A12',
    danger: '#F97066',
    dangerSoft: '#3D1714',
    sidebar: '#131A18',
    sidebarText: '#E7EEEB',
    sidebarMuted: '#8FA39D',
    sidebarActive: 'rgba(79,191,159,0.16)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const FontFamily = Platform.select({
  web: 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  default: undefined,
});

// Content never stretches wider than this on desktop.
export const MaxContentWidth = 960;
/** Desktop widths: pages and, narrower, forms and detail screens. */
export const DesktopPageWidth = 1200;
export const DesktopFormWidth = 720;
