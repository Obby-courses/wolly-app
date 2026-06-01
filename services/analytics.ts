import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';
import { supabase, isSupabaseConfigured } from './supabase';

/**
 * WOLLY ANALYTICS SERVICE
 * 
 * Servizio centralizzato per il tracciamento degli eventi dell'applicazione.
 * Allinea le schermate e i pulsanti a una tassonomia ufficiale per la comprensione delle sezioni
 * in ottica di analytics comportamentale ed esplorazione dei dati.
 */

// Tassonomia ufficiale delle schermate (Screens)
export const ANALYTICS_SCREENS = {
  HOME: 'screen_home',
  STATS_OVERVIEW: 'screen_stats_overview',
  STATS_EXPENSES: 'screen_stats_expenses',
  STATS_INCOMES: 'screen_stats_incomes',
  STATS_CASHFLOW: 'screen_stats_cashflow',
  STATS_NET_WORTH: 'screen_stats_net_worth',
  SUBSCRIPTIONS: 'screen_subscriptions',
  SETTINGS: 'screen_settings',
  EXPENSE_DETAIL: 'screen_expense_detail',
  MANUAL_ENTRY: 'screen_manual_entry',
  AI_CHAT: 'screen_ai_chat',
  VOICE_CHAT: 'screen_voice_chat',
  ONBOARDING: 'screen_onboarding',
} as const;

// Tassonomia ufficiale dei pulsanti (Buttons)
export const ANALYTICS_BUTTONS = {
  // Bottom Tabs Navigation
  TAB_HOME: 'btn_tab_home',
  TAB_STATS: 'btn_tab_stats',
  TAB_SUBSCRIPTIONS: 'btn_tab_subscriptions',
  TAB_SETTINGS: 'btn_tab_settings',
  
  // Quick Access AI
  VOICE_CHAT_OPEN: 'btn_voice_chat_open',
  AI_CHAT_OPEN: 'btn_ai_chat_open',
  
  // Transaction Actions
  SAVE_TRANSACTION: 'btn_save_transaction',
  DELETE_TRANSACTION: 'btn_delete_transaction',
  MANUAL_ENTRY_OPEN: 'btn_manual_entry_open',
  
  // Filters & Interactions
  TIME_FILTER_SELECT: 'btn_time_filter_select',
  CHART_BAR_CLICK: 'btn_chart_bar_click',
  
  // Recording
  VOICE_REC_START: 'btn_voice_rec_start',
  VOICE_REC_STOP: 'btn_voice_rec_stop',
} as const;

class WollyAnalytics {
  private isDevelopment = __DEV__;
  private appVersion = Constants.expoConfig?.version || '0.2.0';
  private deviceId: string | null = null;

  constructor() {
    this.initDeviceId();
  }

  private async initDeviceId() {
    try {
      const stored = await AsyncStorage.getItem('@wolly_device_id');
      if (stored) {
        this.deviceId = stored;
      } else {
        const newId = `usr_${uuid.v4()}`;
        await AsyncStorage.setItem('@wolly_device_id', newId);
        this.deviceId = newId;
      }
    } catch (e) {
      console.warn('[Analytics] Failed to initialize device ID', e);
    }
  }

  /**
   * Restituisce il Device ID univoco e anonimo
   */
  public async getDeviceId(): Promise<string | null> {
    if (!this.deviceId) {
      await this.initDeviceId();
    }
    return this.deviceId;
  }

  /**
   * Traccia la visualizzazione di una schermata (Screen View)
   */
  trackScreen(screenName: typeof ANALYTICS_SCREENS[keyof typeof ANALYTICS_SCREENS] | string, properties?: object) {
    this.logEvent('SCREEN_VIEW', { screen_name: screenName, ...properties });
  }

  /**
   * Traccia il click su un pulsante o elemento interattivo (Button Click)
   */
  trackClick(
    buttonName: typeof ANALYTICS_BUTTONS[keyof typeof ANALYTICS_BUTTONS] | string,
    screenName: typeof ANALYTICS_SCREENS[keyof typeof ANALYTICS_SCREENS] | string,
    properties?: object
  ) {
    this.logEvent('BUTTON_CLICK', {
      button_name: buttonName,
      screen_name: screenName,
      ...properties,
    });
  }

  /**
   * Traccia un evento di business o di logica (Custom Event)
   */
  trackEvent(eventName: string, properties?: object) {
    this.logEvent(eventName, properties);
  }

  /**
   * Funzione interna di logging strutturato (invia a Console + Supabase in background)
   */
  private async logEvent(eventType: 'SCREEN_VIEW' | 'BUTTON_CLICK' | string, payload?: object) {
    const rawPayload = (payload || {}) as Record<string, any>;
    const screenName = rawPayload.screen_name || null;
    const buttonName = rawPayload.button_name || null;

    // Rimuoviamo screen_name e button_name dal payload per non duplicarli nella colonna JSONB
    const cleanedPayload = { ...rawPayload };
    delete cleanedPayload.screen_name;
    delete cleanedPayload.button_name;

    // Invia i dati a Supabase solo se configurato correttamente
    if (!isSupabaseConfigured()) {
      return;
    }

    try {
      const { error } = await supabase.from('analytics_events').insert({
        event_type: eventType,
        screen_name: screenName,
        button_name: buttonName,
        payload: cleanedPayload,
        device_os: Platform.OS,
        app_version: this.appVersion,
      });

      if (error && this.isDevelopment) {
        // Silenced
      }
    } catch (err) {
      if (this.isDevelopment) {
        // Silenced
      }
    }
  }
}

export const analytics = new WollyAnalytics();


