window.umbralMobile = {
  isNative: () => Boolean(window.Capacitor?.isNativePlatform?.()),
  async vibrate() {
    if (window.Capacitor?.Plugins?.Haptics) {
      await window.Capacitor.Plugins.Haptics.impact({ style: 'heavy' });
      return;
    }
    if ('vibrate' in navigator) navigator.vibrate([180, 80, 180]);
  },
  async notify(title, body) {
    const notifications = window.Capacitor?.Plugins?.LocalNotifications;
    if (!notifications) return false;
    const permission = await notifications.requestPermissions();
    if (permission.display !== 'granted') return false;
    await notifications.schedule({ notifications: [{ id: Date.now() % 2147483647, title, body, schedule: { at: new Date(Date.now() + 250) } }] });
    return true;
  },
  async authenticate(reason = 'Confirma tu identidad para abrir Umbral') {
    const biometrics = window.Capacitor?.Plugins?.Biometrics;
    if (!biometrics) return true;
    const result = await biometrics.authenticate({ reason, title: 'Abrir Umbral', subtitle: 'Casa financiera y datos compartidos' });
    return Boolean(result?.success);
  }
};
