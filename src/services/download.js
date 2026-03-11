import * as FileSystem from 'expo-file-system';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DOWNLOADS_DIR = `${FileSystem.documentDirectory}downloads/`;
const DOWNLOADS_INDEX_KEY = 'tuiflix_downloads';

/**
 * Initialise le dossier de téléchargements.
 */
async function ensureDownloadsDir() {
  const dirInfo = await FileSystem.getInfoAsync(DOWNLOADS_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(DOWNLOADS_DIR, { intermediates: true });
  }
}

/**
 * Récupère la liste des téléchargements sauvegardés.
 * Retourne [{ id, title, episodeTitle, filePath, thumbnail, downloadedAt, fileSize }]
 */
export async function getDownloads() {
  try {
    const raw = await AsyncStorage.getItem(DOWNLOADS_INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Sauvegarde l'index des téléchargements.
 */
async function saveDownloadsIndex(downloads) {
  await AsyncStorage.setItem(DOWNLOADS_INDEX_KEY, JSON.stringify(downloads));
}

/**
 * Télécharge un stream vidéo en local.
 *
 * @param {string} streamUrl - URL directe du fichier (.mp4, .mkv)
 * @param {object} metadata - { title, episodeTitle, thumbnail }
 * @param {function} onProgress - callback(progress) avec progress entre 0 et 1
 * @returns {object} - { success, download } ou { success: false, error }
 */
export async function downloadVideo(streamUrl, metadata, onProgress) {
  try {
    await ensureDownloadsDir();

    // Générer un nom de fichier unique
    const timestamp = Date.now();
    const extension = getExtension(streamUrl);
    const safeTitle = sanitizeFilename(metadata.title || 'video');
    const safeEp = sanitizeFilename(metadata.episodeTitle || '');
    const filename = `${safeTitle}_${safeEp}_${timestamp}${extension}`;
    const filePath = `${DOWNLOADS_DIR}${filename}`;

    // Créer le download resumable pour suivre la progression
    const downloadResumable = FileSystem.createDownloadResumable(
      streamUrl,
      filePath,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Referer: streamUrl,
        },
      },
      (downloadProgress) => {
        if (onProgress && downloadProgress.totalBytesExpectedToWrite > 0) {
          const progress =
            downloadProgress.totalBytesWritten /
            downloadProgress.totalBytesExpectedToWrite;
          onProgress(progress);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || !result.uri) {
      return { success: false, error: 'Téléchargement échoué' };
    }

    // Vérifier la taille du fichier
    const fileInfo = await FileSystem.getInfoAsync(result.uri);
    if (!fileInfo.exists || fileInfo.size < 1000) {
      // Fichier trop petit = probablement une erreur HTML
      await FileSystem.deleteAsync(result.uri, { idempotent: true });
      return { success: false, error: 'Fichier invalide (trop petit)' };
    }

    // Sauvegarder dans l'index
    const download = {
      id: `dl-${timestamp}`,
      title: metadata.title || 'Vidéo',
      episodeTitle: metadata.episodeTitle || '',
      thumbnail: metadata.thumbnail || '',
      filePath: result.uri,
      downloadedAt: new Date().toISOString(),
      fileSize: fileInfo.size,
    };

    const downloads = await getDownloads();
    downloads.unshift(download);
    await saveDownloadsIndex(downloads);

    return { success: true, download };
  } catch (error) {
    console.error('Download error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Supprime un téléchargement (fichier + index).
 */
export async function deleteDownload(downloadId) {
  try {
    const downloads = await getDownloads();
    const download = downloads.find((d) => d.id === downloadId);

    if (download) {
      await FileSystem.deleteAsync(download.filePath, { idempotent: true });
    }

    const updated = downloads.filter((d) => d.id !== downloadId);
    await saveDownloadsIndex(updated);
    return true;
  } catch (error) {
    console.error('Delete download error:', error.message);
    return false;
  }
}

/**
 * Vérifie si un fichier téléchargé existe toujours.
 */
export async function isDownloadValid(download) {
  try {
    const info = await FileSystem.getInfoAsync(download.filePath);
    return info.exists && info.size > 0;
  } catch {
    return false;
  }
}

/**
 * Retourne l'espace total utilisé par les téléchargements (en bytes).
 */
export async function getDownloadsSize() {
  const downloads = await getDownloads();
  return downloads.reduce((total, d) => total + (d.fileSize || 0), 0);
}

/**
 * Formate une taille en bytes en string lisible.
 */
export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Helpers

function getExtension(url) {
  if (url.includes('.mp4')) return '.mp4';
  if (url.includes('.mkv')) return '.mkv';
  if (url.includes('.m3u8')) return '.m3u8';
  return '.mp4';
}

function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9\u00C0-\u024F_-]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 50);
}
