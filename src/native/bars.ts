import { Capacitor, SystemBars, SystemBarsStyle, SystemBarType } from '@capacitor/core';

/** Android system bars. `darkBackground` = the screen behind that bar is dark, so icons must be light. No-op on web. */
export function setBars(top: { darkBackground: boolean }, bottom: { darkBackground: boolean } = top) {
  if (!Capacitor.isNativePlatform()) return;
  const style = (dark: boolean) => (dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light);
  void SystemBars.setStyle({ style: style(top.darkBackground), bar: SystemBarType.StatusBar }).catch(() => {});
  void SystemBars.setStyle({ style: style(bottom.darkBackground), bar: SystemBarType.NavigationBar }).catch(() => {});
}
