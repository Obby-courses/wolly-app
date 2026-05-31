/**
 * popupStore.ts
 * Centralized store to manage remotely controlled pop-up notifications from Supabase
 * and track dismissal state locally in AsyncStorage.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, isSupabaseConfigured } from './supabase';

export interface RemotePopup {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error';
  page_route: string;
  hero_gradient_start?: string;
  hero_gradient_end?: string;
  icon_name?: string;
  button_text?: string;
  button_url?: string;
  html_content?: string;
  webview_url?: string;
  trigger_condition: 'always' | 'once';
  is_active: boolean;
}

interface PopupState {
  popups: RemotePopup[];
  seenPopupIds: string[];
  currentVisiblePopup: RemotePopup | null;
  hasLoaded: boolean;
}

let state: PopupState = {
  popups: [],
  seenPopupIds: [],
  currentVisiblePopup: null,
  hasLoaded: false,
};

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((l) => l());
}

const STORAGE_KEY = '@wolly:seen_popups';

export const popupStore = {
  getState: () => ({ ...state }),

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Initializes the store: loads dismissed IDs from AsyncStorage
   * and fetches active pop-ups from Supabase.
   */
  initialize: async () => {
    try {
      // 1. Load seen popup IDs from local storage
      const seenRaw = await AsyncStorage.getItem(STORAGE_KEY);
      const seenIds: string[] = seenRaw ? JSON.parse(seenRaw) : [];

      state = { ...state, seenPopupIds: seenIds };
      notify();

      // 2. Fetch active popups from Supabase (if configured)
      if (isSupabaseConfigured()) {
        const { data, error } = await supabase
          .from('remote_popups')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[PopupStore] Error fetching remote popups:', error.message);
        } else if (data) {
          state = { ...state, popups: data as RemotePopup[] };
        }
      } else {
        console.log('[PopupStore] Supabase not configured, skipping remote fetch');
      }
    } catch (e) {
      console.error('[PopupStore] Initialization failed:', e);
    } finally {
      state = { ...state, hasLoaded: true };
      notify();
    }
  },

  /**
   * Checks if an eligible popup exists for the given pathname and sets it as active if found.
   */
  checkRoute: (pathname: string) => {
    // If popups are not loaded or the overlay is already showing a popup, skip
    if (!state.hasLoaded || state.currentVisiblePopup !== null) return;

    // Find a popup matching the current pathname or the wildcard '*'
    const matchedPopup = state.popups.find((popup) => {
      const routeMatches = popup.page_route === pathname || popup.page_route === '*';
      const notSeenYet = !state.seenPopupIds.includes(popup.id) || popup.trigger_condition === 'always';
      return routeMatches && notSeenYet;
    });

    if (matchedPopup) {
      state = { ...state, currentVisiblePopup: matchedPopup };
      notify();
    }
  },

  /**
   * Dismisses the current visible popup and stores its ID in AsyncStorage if required.
   */
  dismissPopup: async () => {
    const active = state.currentVisiblePopup;
    if (!active) return;

    try {
      if (active.trigger_condition === 'once' && !state.seenPopupIds.includes(active.id)) {
        const updatedSeen = [...state.seenPopupIds, active.id];
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedSeen));
        state = { ...state, seenPopupIds: updatedSeen };
      }
    } catch (e) {
      console.error('[PopupStore] Error saving seen popup state:', e);
    } finally {
      state = { ...state, currentVisiblePopup: null };
      notify();
    }
  },

  /**
   * Debug method to clear seen popups and trigger them again.
   */
  resetSeen: async () => {
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
      state = { ...state, seenPopupIds: [], currentVisiblePopup: null };
      notify();
      console.log('[PopupStore] Dismissed popups list successfully cleared.');
    } catch (e) {
      console.error('[PopupStore] Error resetting seen popups:', e);
    }
  }
};
