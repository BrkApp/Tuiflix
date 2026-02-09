import React from 'react';
import { StyleSheet, TouchableOpacity, View, Image, Text } from 'react-native';

const CARD_WIDTH = 160;
const CARD_HEIGHT = 240;

export default function VideoCard({ item, onPress }) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.imageContainer}>
        {item.thumbnail ? (
          <Image
            source={{ uri: item.thumbnail }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderIcon}>?</Text>
          </View>
        )}
        {/* Badge épisode */}
        {item.episode ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.episode}</Text>
          </View>
        ) : null}
        {/* Badge langue */}
        {item.language === 'VOSTFR' ? (
          <View style={styles.langBadge}>
            <Text style={styles.langText}>VOSTFR</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.season ? (
        <Text style={styles.season} numberOfLines={1}>
          {item.season}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: CARD_WIDTH,
    margin: 8,
  },
  imageContainer: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a2e',
  },
  placeholderIcon: {
    fontSize: 40,
    color: '#555',
  },
  badge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#e50914',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  langBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#2196F3',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  langText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  title: {
    color: '#e0e0e0',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    lineHeight: 18,
  },
  season: {
    color: '#888',
    fontSize: 11,
    marginTop: 2,
  },
});
