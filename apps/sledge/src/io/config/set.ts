import { defaultConfig } from '~/models/config/GlobalConfig';
import { defaultLastSettingsStore, makeDefaultKeyConfigStore } from '~/stores/GlobalStores';

function deepObjectAssign(target: any, ...sources: any[]) {
  sources.forEach((source) => {
    Object.keys(source).forEach((key) => {
      const s_val = source[key];
      const t_val = target[key];
      target[key] = t_val && s_val && typeof t_val === 'object' && typeof s_val === 'object' ? deepObjectAssign(t_val, s_val) : s_val;
    });
  });
  return target;
}

export function getDefaultSettings() {
  const globalConfigStore = JSON.parse(JSON.stringify(defaultConfig));
  const keyConfigStore = JSON.parse(JSON.stringify(makeDefaultKeyConfigStore()));
  const lastSettingsStore = JSON.parse(JSON.stringify(defaultLastSettingsStore));

  // console.log('defaultSettings: ', {
  //   globalConfigStore,
  //   keyConfigStore,
  //   lastSettingsStore,
  // });

  return {
    globalConfigStore,
    keyConfigStore,
    lastSettingsStore,
  };
}

export function getFallbackedSettings(source: { globalConfigStore?: any; keyConfigStore?: any; lastSettingsStore?: any }) {
  const defaultSettings = getDefaultSettings();
  const fbGlobalConfigStore = deepObjectAssign(defaultSettings.globalConfigStore, source.globalConfigStore);
  const fbKeyConfigStore = deepObjectAssign(defaultSettings.keyConfigStore, source.keyConfigStore);
  const fbLastSettingsStore = deepObjectAssign(defaultSettings.lastSettingsStore, source.lastSettingsStore);

  // console.log('fallbackedSettings: ', {
  //   fbGlobalConfigStore,
  //   fbKeyConfigStore,
  //   fbLastSettingsStore,
  // });

  return {
    globalConfigStore: fbGlobalConfigStore,
    keyConfigStore: fbKeyConfigStore,
    lastSettingsStore: fbLastSettingsStore,
  };
}
