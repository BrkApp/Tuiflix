import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_KEY = 'tuiflix_catalog';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 heures en ms

/**
 * Récupère le catalogue depuis le cache.
 * Retourne null si le cache est expiré ou vide.
 */
export async function getCachedCatalog() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const { items, timestamp } = JSON.parse(raw);
    const age = Date.now() - timestamp;

    if (age > CACHE_TTL) {
      return null; // Expiré
    }

    return items;
  } catch (error) {
    console.error('Cache read error:', error.message);
    return null;
  }
}

/**
 * Sauvegarde le catalogue dans le cache avec un timestamp.
 */
export async function setCachedCatalog(items) {
  try {
    const data = JSON.stringify({
      items,
      timestamp: Date.now(),
    });
    await AsyncStorage.setItem(CACHE_KEY, data);
  } catch (error) {
    console.error('Cache write error:', error.message);
  }
}

/**
 * Efface le cache du catalogue.
 */
export async function clearCache() {
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch (error) {
    console.error('Cache clear error:', error.message);
  }
}
