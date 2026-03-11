import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  ScrollView,
  Text,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import { fetchCatalog, fetchSeries, fetchFilms } from '../services/scraper';
import { getCachedCatalog, setCachedCatalog } from '../services/cache';
import VideoCard from '../components/VideoCard';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = Math.floor(SCREEN_WIDTH / 176);
const CAROUSEL_ITEM_WIDTH = 130;

const TABS = [
  { key: 'all', label: 'Accueil' },
  { key: 'series', label: 'S\u00e9ries' },
  { key: 'films', label: 'Films' },
  { key: 'downloads', label: 'Mes DL' },
];

export default function HomeScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('all');
  const [allItems, setAllItems] = useState([]);
  const [seriesItems, setSeriesItems] = useState([]);
  const [filmsItems, setFilmsItems] = useState([]);
  const [featured, setFeatured] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const loadedTabs = useRef({ all: false, series: false, films: false });

  // Charger le catalogue principal (accueil)
  const loadAll = useCallback(async (forceRefresh = false) => {
    try {
      setError(null);

      if (!forceRefresh) {
        const cached = await getCachedCatalog();
        if (cached && cached.length > 0) {
          // Séparer carousel (car-*) et grille (mov-*)
          setFeatured(cached.filter((i) => i.id.startsWith('car-')));
          setAllItems(cached.filter((i) => i.id.startsWith('mov-')));
          loadedTabs.current.all = true;
          return;
        }
      }

      const catalog = await fetchCatalog();
      setFeatured(catalog.filter((i) => i.id.startsWith('car-')));
      setAllItems(catalog.filter((i) => i.id.startsWith('mov-')));
      await setCachedCatalog(catalog);
      loadedTabs.current.all = true;
    } catch (err) {
      console.error('Load catalog error:', err.message);
      setError('Impossible de charger le catalogue.');
    }
  }, []);

  // Charger les séries
  const loadSeries = useCallback(async () => {
    if (loadedTabs.current.series && seriesItems.length > 0) return;
    try {
      setError(null);
      const items = await fetchSeries();
      setSeriesItems(items);
      loadedTabs.current.series = true;
    } catch (err) {
      setError('Impossible de charger les s\u00e9ries.');
    }
  }, [seriesItems.length]);

  // Charger les films
  const loadFilms = useCallback(async () => {
    if (loadedTabs.current.films && filmsItems.length > 0) return;
    try {
      setError(null);
      const items = await fetchFilms();
      setFilmsItems(items);
      loadedTabs.current.films = true;
    } catch (err) {
      setError('Impossible de charger les films.');
    }
  }, [filmsItems.length]);

  // Chargement initial
  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadAll();
      setLoading(false);
    })();
  }, [loadAll]);

  // Chargement au changement d'onglet
  useEffect(() => {
    if (activeTab === 'series' && !loadedTabs.current.series) {
      loadSeries();
    } else if (activeTab === 'films' && !loadedTabs.current.films) {
      loadFilms();
    }
  }, [activeTab, loadSeries, loadFilms]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadedTabs.current = { all: false, series: false, films: false };
    if (activeTab === 'all') await loadAll(true);
    else if (activeTab === 'series') {
      loadedTabs.current.series = false;
      await loadSeries();
    } else {
      loadedTabs.current.films = false;
      await loadFilms();
    }
    setRefreshing(false);
  }, [activeTab, loadAll, loadSeries, loadFilms]);

  const handleVideoPress = useCallback(
    (item) => {
      navigation.navigate('Detail', {
        pageUrl: item.pageUrl,
        title: item.title,
        thumbnail: item.thumbnail,
      });
    },
    [navigation]
  );

  // Données selon l'onglet actif
  const currentItems =
    activeTab === 'series'
      ? seriesItems
      : activeTab === 'films'
      ? filmsItems
      : allItems;

  const renderItem = useCallback(
    ({ item }) => <VideoCard item={item} onPress={handleVideoPress} />,
    [handleVideoPress]
  );

  const keyExtractor = useCallback((item) => item.id, []);

  // ── Carousel Nouveautés ──
  const renderFeaturedItem = useCallback(
    ({ item }) => (
      <TouchableOpacity
        style={styles.featuredCard}
        onPress={() => handleVideoPress(item)}
        activeOpacity={0.8}
      >
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.featuredImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.featuredImage, styles.featuredPlaceholder]}>
            <Text style={styles.featuredPlaceholderText}>?</Text>
          </View>
        )}
        <Text style={styles.featuredTitle} numberOfLines={2}>
          {item.title}
        </Text>
      </TouchableOpacity>
    ),
    [handleVideoPress]
  );

  // ── Header (logo + onglets + carousel) ──
  const ListHeader = useCallback(
    () => (
      <View>
        {/* Carousel Nouveautés (seulement sur Accueil) */}
        {activeTab === 'all' && featured.length > 0 && (
          <View style={styles.carouselSection}>
            <Text style={styles.sectionTitle}>Nouveaut\u00e9s Films</Text>
            <FlatList
              data={featured}
              renderItem={renderFeaturedItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.carouselList}
            />
          </View>
        )}

        {/* Titre section grille */}
        <Text style={styles.sectionTitle}>
          {activeTab === 'series'
            ? 'S\u00e9ries'
            : activeTab === 'films'
            ? 'Films'
            : 'Derni\u00e8res s\u00e9ries'}
        </Text>
      </View>
    ),
    [activeTab, featured, renderFeaturedItem]
  );

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
      {/* Header fixe : logo + onglets */}
      <View style={styles.header}>
        <Text style={styles.logo}>TUIFLIX</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabBar}
          contentContainerStyle={styles.tabBarContent}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => {
                if (tab.key === 'downloads') {
                  navigation.navigate('Downloads');
                  return;
                }
                setActiveTab(tab.key);
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {currentItems.length === 0 && !error ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color="#e50914" />
          <Text style={styles.loadingText}>Chargement...</Text>
        </View>
      ) : (
        <FlatList
          data={currentItems}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          numColumns={NUM_COLUMNS}
          key={`grid-${NUM_COLUMNS}-${activeTab}`}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={
            NUM_COLUMNS > 1 ? styles.columnWrapper : undefined
          }
          ListHeaderComponent={ListHeader}
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
    paddingTop: 44,
    paddingBottom: 8,
    paddingHorizontal: 16,
    backgroundColor: '#0d0d0d',
  },
  logo: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#e50914',
    letterSpacing: 4,
  },
  // ── Onglets ──
  tabBar: {
    marginTop: 12,
    flexGrow: 0,
  },
  tabBarContent: {
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  tabActive: {
    backgroundColor: '#e50914',
    borderColor: '#e50914',
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
  // ── Carousel Nouveautés ──
  carouselSection: {
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 8,
    paddingTop: 16,
    paddingBottom: 10,
  },
  carouselList: {
    paddingHorizontal: 8,
  },
  featuredCard: {
    width: CAROUSEL_ITEM_WIDTH,
    marginRight: 12,
  },
  featuredImage: {
    width: CAROUSEL_ITEM_WIDTH,
    height: 190,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  featuredPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuredPlaceholderText: {
    fontSize: 30,
    color: '#555',
  },
  featuredTitle: {
    color: '#e0e0e0',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 6,
    textAlign: 'center',
  },
  // ── Grille ──
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
});
