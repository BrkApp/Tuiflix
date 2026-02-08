import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Text,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { fetchCatalog } from '../services/scraper';
import { getCachedCatalog, setCachedCatalog } from '../services/cache';
import VideoCard from '../components/VideoCard';

const NUM_COLUMNS = Math.floor(Dimensions.get('window').width / 176);

export default function HomeScreen({ navigation }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const loadCatalog = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);

      // Essayer le cache d'abord
      if (!forceRefresh) {
        const cached = await getCachedCatalog();
        if (cached && cached.length > 0) {
          setItems(cached);
          setLoading(false);
          return;
        }
      }

      // Sinon, scraper
      const catalog = await fetchCatalog();
      setItems(catalog);
      await setCachedCatalog(catalog);
    } catch (err) {
      console.error('Load catalog error:', err.message);
      setError('Impossible de charger le catalogue. Vérifiez votre connexion.');
      // Garder les anciens items si on en a
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
  }, [loadCatalog]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadCatalog(true);
  }, [loadCatalog]);

  const handleVideoPress = useCallback(
    (item) => {
      navigation.navigate('Player', {
        pageUrl: item.pageUrl,
        title: item.title,
        thumbnail: item.thumbnail,
      });
    },
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }) => <VideoCard item={item} onPress={handleVideoPress} />,
    [handleVideoPress]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={styles.loadingText}>Chargement du catalogue...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>TUIFLIX</Text>
        <Text style={styles.subtitle}>
          {items.length} titre{items.length !== 1 ? 's' : ''} disponible
          {items.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {items.length === 0 && !error ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Aucun contenu trouvé.</Text>
          <Text style={styles.emptySubtext}>
            Tirez vers le bas pour rafraîchir.
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          key={`grid-${NUM_COLUMNS}`}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={
            NUM_COLUMNS > 1 ? styles.columnWrapper : undefined
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#e50914"
              colors={['#e50914']}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d0d0d',
  },
  header: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e50914',
    letterSpacing: 4,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  grid: {
    paddingHorizontal: 8,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: 'flex-start',
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  errorBanner: {
    backgroundColor: '#e50914',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    borderRadius: 6,
    marginBottom: 8,
  },
  errorText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    color: '#e0e0e0',
    fontSize: 18,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
  },
});
