import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { fetchDetail, resolveStreamUrl } from '../services/scraper';
import { downloadVideo } from '../services/download';

export default function DetailScreen({ route, navigation }) {
  const { pageUrl, title: initialTitle, thumbnail } = route.params;
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [downloading, setDownloading] = useState(null); // 'ep-1-player-0'
  const [downloadProgress, setDownloadProgress] = useState(0);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDetail(pageUrl);
      setDetail(data);
      if (data.episodes.length > 0) {
        setSelectedEpisode(data.episodes[0]);
      }
    } catch (err) {
      setError(`Impossible de charger: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [pageUrl]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handlePlayerPress = useCallback(
    (player, episodeTitle) => {
      navigation.navigate('Player', {
        playerUrl: player.url,
        title: `${detail?.title || initialTitle} - ${episodeTitle}`,
      });
    },
    [navigation, detail, initialTitle]
  );

  const handleDownload = useCallback(
    async (player, ep, playerIdx) => {
      const dlKey = `${ep.id}-player-${playerIdx}`;
      setDownloading(dlKey);
      setDownloadProgress(0);

      try {
        // D'abord résoudre l'URL du stream
        const streamUrl = await resolveStreamUrl(player.url);

        // Vérifier que c'est un fichier téléchargeable
        if (!streamUrl || streamUrl === player.url) {
          // C'est probablement un embed — on tente quand même
        }

        const result = await downloadVideo(
          streamUrl,
          {
            title: detail?.title || initialTitle,
            episodeTitle: ep.title,
            thumbnail: detail?.poster || thumbnail,
          },
          (progress) => setDownloadProgress(progress)
        );

        if (result.success) {
          Alert.alert('OK', `"${ep.title}" telecharge !`);
        } else {
          Alert.alert('Erreur', result.error || 'Echec du telechargement');
        }
      } catch (err) {
        Alert.alert('Erreur', err.message);
      } finally {
        setDownloading(null);
        setDownloadProgress(0);
      }
    },
    [detail, initialTitle, thumbnail]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
        <Text style={styles.loadingText}>Chargement...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={loadDetail}>
          <Text style={styles.btnText}>Reessayer</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.retryBtn, { backgroundColor: '#333', marginTop: 8 }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.btnText}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const displayTitle = detail?.title || initialTitle;
  const posterUri = detail?.poster || thumbnail;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {displayTitle}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Poster + description */}
        <View style={styles.topSection}>
          {posterUri ? (
            <Image source={{ uri: posterUri }} style={styles.poster} resizeMode="cover" />
          ) : null}
          <View style={styles.infoSection}>
            <Text style={styles.title}>{displayTitle}</Text>
            {detail?.description ? (
              <Text style={styles.description} numberOfLines={4}>
                {detail.description}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Episodes */}
        <Text style={styles.sectionTitle}>
          {detail?.episodes.length === 1 && detail.episodes[0].id === 'film'
            ? 'Lecteurs disponibles'
            : `${detail?.episodes.length || 0} episode(s)`}
        </Text>

        {detail?.episodes.map((ep) => (
          <View key={ep.id}>
            {/* Bouton épisode */}
            {!(detail.episodes.length === 1 && ep.id === 'film') && (
              <TouchableOpacity
                style={[
                  styles.episodeBtn,
                  selectedEpisode?.id === ep.id && styles.episodeBtnActive,
                ]}
                onPress={() => setSelectedEpisode(ep)}
              >
                <Text
                  style={[
                    styles.episodeText,
                    selectedEpisode?.id === ep.id && styles.episodeTextActive,
                  ]}
                >
                  {ep.title}
                </Text>
              </TouchableOpacity>
            )}

            {/* Players de l'épisode sélectionné */}
            {selectedEpisode?.id === ep.id && (
              <View style={styles.playersList}>
                {ep.players.length === 0 ? (
                  <Text style={styles.noPlayer}>Aucun lecteur trouve</Text>
                ) : (
                  ep.players.map((player, idx) => {
                    const dlKey = `${ep.id}-player-${idx}`;
                    const isDownloading = downloading === dlKey;

                    return (
                      <View key={dlKey} style={styles.playerRow}>
                        {/* Bouton lecture */}
                        <TouchableOpacity
                          style={styles.playerBtn}
                          onPress={() => handlePlayerPress(player, ep.title)}
                        >
                          <Text style={styles.playerIcon}>&#9654;</Text>
                          <Text style={styles.playerName}>{player.name}</Text>
                        </TouchableOpacity>

                        {/* Bouton télécharger */}
                        <TouchableOpacity
                          style={[
                            styles.downloadBtn,
                            isDownloading && styles.downloadBtnActive,
                          ]}
                          onPress={() => handleDownload(player, ep, idx)}
                          disabled={!!downloading}
                        >
                          {isDownloading ? (
                            <View style={styles.downloadProgress}>
                              <ActivityIndicator size="small" color="#fff" />
                              <Text style={styles.downloadPercent}>
                                {Math.round(downloadProgress * 100)}%
                              </Text>
                            </View>
                          ) : (
                            <Text style={styles.downloadIcon}>&#8595;</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </View>
        ))}
      </ScrollView>
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
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 44,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#111',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  backBtn: {
    padding: 8,
    marginRight: 12,
  },
  backIcon: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  topSection: {
    flexDirection: 'row',
    padding: 16,
  },
  poster: {
    width: 120,
    height: 180,
    borderRadius: 8,
    backgroundColor: '#1a1a2e',
  },
  infoSection: {
    flex: 1,
    marginLeft: 16,
    justifyContent: 'flex-start',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#e50914',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  episodeBtn: {
    marginHorizontal: 16,
    marginVertical: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2a2a3e',
  },
  episodeBtnActive: {
    backgroundColor: '#1c1c3a',
    borderColor: '#e50914',
  },
  episodeText: {
    color: '#ccc',
    fontSize: 15,
    fontWeight: '500',
  },
  episodeTextActive: {
    color: '#fff',
  },
  playersList: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  playerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#e50914',
    borderRadius: 6,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  playerIcon: {
    color: '#fff',
    fontSize: 16,
    marginRight: 10,
  },
  playerName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  downloadBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#333',
    borderRadius: 6,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 48,
  },
  downloadBtnActive: {
    backgroundColor: '#1a5276',
  },
  downloadIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  downloadProgress: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  downloadPercent: {
    color: '#fff',
    fontSize: 11,
    marginLeft: 4,
  },
  noPlayer: {
    color: '#888',
    fontSize: 14,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    color: '#e50914',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryBtn: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: '#e50914',
    borderRadius: 4,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
