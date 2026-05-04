import * as Location from 'expo-location';

export interface LocationContext {
  city: string | null;
  address: string | null;
}

export async function getCurrentLocationContext(): Promise<LocationContext> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return { city: null, address: null };
    }

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    const [revGeocode] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });

    if (revGeocode) {
      return {
        city: revGeocode.city || revGeocode.district || null,
        address: revGeocode.street ? `${revGeocode.street} ${revGeocode.streetNumber || ''}`.trim() : null,
      };
    }
  } catch (error) {
    console.error('Error getting location context:', error);
  }
  return { city: null, address: null };
}
