import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Listener = () => void;

interface NetworkState {
  isNetworkReachable: boolean;
  isDemoOffline: boolean;
  isUnauthorizedMode: boolean;
}

let state: NetworkState = {
  isNetworkReachable: true,
  isDemoOffline: false,
  isUnauthorizedMode: false,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

export const networkStore = {
  getState: () => ({ 
    ...state, 
    // True if real network is offline OR demo mode is active
    isOffline: !state.isNetworkReachable || state.isDemoOffline 
  }),

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },

  setNetworkReachable: (reachable: boolean) => {
    if (state.isNetworkReachable !== reachable) {
      state = { ...state, isNetworkReachable: reachable };
      notify();
    }
  },

  setDemoOffline: async (isDemo: boolean) => {
    state = { ...state, isDemoOffline: isDemo };
    notify();
    try {
      await AsyncStorage.setItem('@demo_offline', isDemo ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to save demo offline setting', e);
    }
  },

  setUnauthorizedMode: async (isUnauthorized: boolean) => {
    state = { ...state, isUnauthorizedMode: isUnauthorized };
    notify();
    try {
      await AsyncStorage.setItem('@unauthorized_mode', isUnauthorized ? 'true' : 'false');
    } catch (e) {
      console.error('Failed to save unauthorized mode setting', e);
    }
  },

  loadInitialState: async () => {
    try {
      const demoStr = await AsyncStorage.getItem('@demo_offline');
      if (demoStr === 'true') {
        state = { ...state, isDemoOffline: true };
      }
      
      const unauthorizedStr = await AsyncStorage.getItem('@unauthorized_mode');
      if (unauthorizedStr === 'true') {
        state = { ...state, isUnauthorizedMode: true };
      }

      const netState = await Network.getNetworkStateAsync();
      state = { ...state, isNetworkReachable: netState.isInternetReachable ?? true };
      notify();
    } catch (e) {
      console.error('Error loading network state', e);
    }
  }
};
