import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { fetchStreamUrl } from '../services/scraper';
import VideoPlayer from '../components/VideoPlayer';

export default function PlayerScreen({ route, navigation }) {
  const { pageUrl, title } = route.params;
  const [streamUrl, setStreamUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadStream = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const url = await fetchStreamUrl(pageUrl);
      if (url) {
        setStreamUrl(url);
      } else {
        setError("Impossible de trouver l'URL du stream.");
      }
    } catch (err) {
      setError(`Erreur: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [pageUrl]);

  useEffect(() => {
    loadStream();
  }, [loadStream]);

  const goBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={styles.text}>Recherche du stream...</Text>
        <Text style={styles.subtext}>{title}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.button} onPress={loadStream}>
          <Text style={styles.buttonText}>Réessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.backButton]}
          onPress={goBack}
        >
          <Text style={styles.buttonText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <VideoPlayer streamUrl={streamUrl} title={title} onBack={goBack} />;
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
    padding: 20,
  },
  text: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  subtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  errorText: {
    color: '#e50914',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#e50914',
    borderRadius: 4,
    marginTop: 12,
  },
  backButton: {
    backgroundColor: '#333',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
