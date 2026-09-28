import { useWindowDimensions } from 'react-native';

/** Wide enough for a sidebar and side-by-side columns (laptops and up). */
export const DESKTOP_WIDTH = 1024;

export function useIsDesktop() {
  return useWindowDimensions().width >= DESKTOP_WIDTH;
}
