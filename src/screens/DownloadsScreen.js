import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  getDownloads,
  deleteDownload,
  isDownloadValid,
  getDownloadsSize,
  formatFileSize,
} from '../services/download';

export default function DownloadsScreen({ navigation }) {
  const [downloads, setDownloads] = useState([]);
  const [totalSize, setTotalSize] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadDownloads = useCallback(async () => {
    setLoading(true);
    const list = await getDownloads();

    // Vérifier que les fichiers existent encore
    const valid = [];
    for (const dl of list) {
      const ok = await isDownloadValid(dl);
      if (ok) valid.push(dl);
    }

    setDownloads(valid);
    const size = await getDownloadsSize();
    setTotalSize(size);
    setLoading(false);
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', loadDownloads);
    return unsubscribe;
  }, [navigation, loadDownloads]);

  const handlePlay = useCallback(
    (download) => {
      navigation.navigate('Player', {
        playerUrl: download.filePath,
        title: `${download.title}${download.episodeTitle ? ' - ' + download.episodeTitle : ''}`,
        isLocal: true,
      });
    },
    [navigation]
  );

  const handleDelete = useCallback(
    (download) => {
      Alert.alert(
        'Supprimer',
        `Supprimer "${download.title}${download.episodeTitle ? ' - ' + download.episodeTitle : ''}" ?`,
        [
          { text: 'Annuler', style: 'cancel' },
          {
            text: 'Supprimer',
            style: 'destructive',
            onPress: async () => {
              await deleteDownload(download.id);
              await loadDownloads();
            },
          },
        ]
      );
    },
    [loadDownloads]
  );

  const renderItem = useCallback(
    ({ item }) => (
      <View style={styles.item}>
        <TouchableOpacity style={styles.itemContent} onPress={() => handlePlay(item)}>
          {item.thumbnail ? (
            <Image source={{ uri: item.thumbnail }} style={styles.thumb} resizeMode="cover" />
          ) : (
            <View style={[styles.thumb, styles.thumbPlaceholder]}>
              <Text style={styles.thumbIcon}>?</Text>
            </View>
          )}
          <View style={styles.itemInfo}>
            <Text style={styles.itemTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.episodeTitle ? (
              <Text style={styles.itemEpisode} numberOfLines={1}>
                {item.episodeTitle}
              </Text>
            ) : null}
            <Text style={styles.itemMeta}>
              {formatFileSize(item.fileSize)} &middot;{' '}
              {new Date(item.downloadedAt).toLocaleDateString('fr-FR')}
            </Text>
          </View>
          <Text style={styles.playIcon}>&#9654;</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(item)}>
          <Text style={styles.deleteIcon}>&#10005;</Text>
        </TouchableOpacity>
      </View>
    ),
    [handlePlay, handleDelete]
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#e50914" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>&#8592;</Text>
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Mes T&#233;l&#233;chargements</Text>
          <Text style={styles.headerSub}>
            {downloads.length} vid&#233;o{downloads.length !== 1 ? 's' : ''} &middot;{' '}
            {formatFileSize(totalSize)}
          </Text>
        </View>
      </View>

      {downloads.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Aucun t&#233;l&#233;chargement</Text>
          <Text style={styles.emptySubtext}>
            T&#233;l&#233;chargez depuis la page d&#233;tail d'un film ou d'une s&#233;rie
          </Text>
        </View>
      ) : (
        <FlatList
          data={downloads}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
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
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSub: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  list: {
    paddingVertical: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a2e',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  thumb: {
    width: 80,
    height: 50,
    borderRadius: 6,
    backgroundColor: '#1a1a2e',
  },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbIcon: {
    fontSize: 20,
    color: '#555',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemTitle: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '600',
  },
  itemEpisode: {
    color: '#aaa',
    fontSize: 13,
    marginTop: 2,
  },
  itemMeta: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  playIcon: {
    color: '#e50914',
    fontSize: 20,
    marginLeft: 12,
  },
  deleteBtn: {
    padding: 10,
    marginLeft: 8,
  },
  deleteIcon: {
    color: '#666',
    fontSize: 18,
  },
  emptyText: {
    color: '#e0e0e0',
    fontSize: 18,
  },
  emptySubtext: {
    color: '#888',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
