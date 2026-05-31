import analytics from '@react-native-firebase/analytics';
import Constants from 'expo-constants';

// Determina se l'app sta girando dentro Expo Go (dove le librerie native Firebase non sono disponibili)
const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Logs a custom event to Firebase Analytics.
 * @param eventName Name of the event (use underscores, max 40 chars)
 * @param params Optional key-value pairs of event parameters
 */
export const logCustomEvent = async (eventName: string, params?: Record<string, any>) => {
  if (isExpoGo) {
    console.log(`[Firebase Analytics (Expo Go Bypass)] Event: ${eventName}`, params || '');
    return;
  }
  try {
    await analytics().logEvent(eventName, params);
    console.log(`[Firebase Analytics] Event logged: ${eventName}`, params || '');
  } catch (error) {
    console.error(`[Firebase Analytics] Error logging event ${eventName}:`, error);
  }
};

/**
 * Tracks a screen view in Firebase Analytics.
 * @param screenName The name of the screen being viewed
 * @param screenClass The class name of the screen activity/controller
 */
export const logScreenView = async (screenName: string, screenClass?: string) => {
  if (isExpoGo) {
    console.log(`[Firebase Analytics (Expo Go Bypass)] Screen view: ${screenName}`);
    return;
  }
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
    console.log(`[Firebase Analytics] Screen view logged: ${screenName}`);
  } catch (error) {
    console.error(`[Firebase Analytics] Error logging screen view ${screenName}:`, error);
  }
};

/**
 * Sets user properties for Firebase Analytics.
 * @param properties Key-value pairs of user attributes
 */
export const setUserProperties = async (properties: Record<string, string | null>) => {
  if (isExpoGo) {
    console.log('[Firebase Analytics (Expo Go Bypass)] User properties:', properties);
    return;
  }
  try {
    await analytics().setUserProperties(properties);
    console.log('[Firebase Analytics] User properties updated', properties);
  } catch (error) {
    console.error('[Firebase Analytics] Error setting user properties:', error);
  }
};

/**
 * Sets the user ID for the current session.
 * @param userId Unique identifier for the user
 */
export const setAnalyticsUserId = async (userId: string | null) => {
  if (isExpoGo) {
    console.log(`[Firebase Analytics (Expo Go Bypass)] User ID: ${userId}`);
    return;
  }
  try {
    await analytics().setUserId(userId);
    console.log(`[Firebase Analytics] User ID set to: ${userId}`);
  } catch (error) {
    console.error('[Firebase Analytics] Error setting user ID:', error);
  }
};
