import React, { useRef, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';

export default function VideoPlayer({ streamUrl, title, onBack }) {
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showControls, setShowControls] = useState(true);

  const hideControlsTimeout = useRef(null);

  const scheduleHideControls = useCallback(() => {
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    hideControlsTimeout.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);
  }, []);

  const toggleControls = useCallback(() => {
    setShowControls((prev) => {
      if (!prev) scheduleHideControls();
      return !prev;
    });
  }, [scheduleHideControls]);

  const onPlaybackStatusUpdate = useCallback((status) => {
    if (status.isLoaded) {
      setIsLoading(false);
      setError(null);
    }
    if (status.error) {
      setError(`Erreur de lecture: ${status.error}`);
      setIsLoading(false);
    }
  }, []);

  const onLoadStart = useCallback(() => {
    setIsLoading(true);
    setError(null);
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      <TouchableOpacity
        style={styles.videoContainer}
        activeOpacity={1}
        onPress={toggleControls}
      >
        <Video
          ref={videoRef}
          source={{ uri: streamUrl }}
          style={styles.video}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          useNativeControls={false}
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
          onLoadStart={onLoadStart}
        />

        {isLoading && (
          <View style={styles.overlay}>
            <ActivityIndicator size="large" color="#e50914" />
            <Text style={styles.loadingText}>Chargement...</Text>
          </View>
        )}

        {error && (
          <View style={styles.overlay}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onBack}>
              <Text style={styles.retryText}>Retour</Text>
            </TouchableOpacity>
          </View>
        )}

        {showControls && !error && (
          <View style={styles.controlsOverlay}>
            <View style={styles.topBar}>
              <TouchableOpacity onPress={onBack} style={styles.backButton}>
                <Text style={styles.backIcon}>←</Text>
              </TouchableOpacity>
              <Text style={styles.title} numberOfLines={1}>
                {title}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  loadingText: {
    color: '#fff',
    marginTop: 12,
    fontSize: 16,
  },
  errorText: {
    color: '#e50914',
    fontSize: 16,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#e50914',
    borderRadius: 4,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 16,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  backIcon: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
});
