import { useCallback, useState } from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import {
  FavoriteCard,
  getFavorites,
  removeFavorite,
} from '@/lib/favoritesStorage';

const STORAGE_KEY = 'binder-page-1';
const PICKER_SLOT_KEY = 'binder-picker-slot';

type BinderCard = {
  id: string;
  name: string;
  image: string;
} | null;

export default function FavoritesScreen() {
  const [favorites, setFavorites] = useState<FavoriteCard[]>([]);
  const [pickerSlot, setPickerSlot] = useState<string | null>(null);

  const isPickerMode = pickerSlot !== null;

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
      loadPickerSlot();
    }, [])
  );

  async function loadFavorites() {
    const cards = await getFavorites();
    setFavorites(cards);
  }

  async function loadPickerSlot() {
    try {
      const value = await AsyncStorage.getItem(PICKER_SLOT_KEY);
      setPickerSlot(value);
    } catch (err) {
      console.log('Load picker slot error', err);
    }
  }

  async function clearPickerSlot() {
    try {
      await AsyncStorage.removeItem(PICKER_SLOT_KEY);
      setPickerSlot(null);
    } catch (err) {
      console.log('Clear picker slot error', err);
    }
  }

  async function handleRemoveFavorite(cardId: string) {
    const updated = await removeFavorite(cardId);
    setFavorites(updated);
  }

  async function selectFavorite(card: FavoriteCard) {
    if (isPickerMode) {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const currentSlots: BinderCard[] = raw
          ? JSON.parse(raw)
          : Array(9).fill(null);

        const index = Number(pickerSlot);
        if (Number.isNaN(index)) return;

        currentSlots[index] = {
          id: card.id,
          name: card.name,
          image: card.image,
        };

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentSlots));
        await clearPickerSlot();

        router.push('/(tabs)');
      } catch (err) {
        console.log('Select favorite error', err);
      }

      return;
    }

    router.push({
      pathname: '/(tabs)',
      params: {
        pendingCardId: card.id,
        pendingCardName: card.name,
        pendingCardImage: card.image,
      },
    });
  }

  async function handleBackFromPickerMode() {
    await clearPickerSlot();
    router.push('/(tabs)');
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ width: 60 }}>
          {isPickerMode ? (
            <Pressable onPress={handleBackFromPickerMode}>
              <Text style={styles.backText}>← Back</Text>
            </Pressable>
          ) : null}
        </View>

        <Text style={styles.title}>Favorites</Text>

        <View style={{ width: 60 }} />
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No favorites yet</Text>
          <Text style={styles.emptyText}>
            Favorite cards from the Search tab and they’ll show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 40 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Pressable
                style={styles.cardMain}
                onPress={() => selectFavorite(item)}
              >
                <Image
                  source={item.image}
                  style={styles.image}
                  contentFit="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.setName || 'Unknown Set'} #{item.number || '?'}
                  </Text>
                  {!isPickerMode ? (
                    <Text style={styles.placeHint}>Tap to place in binder</Text>
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                style={styles.removeButton}
                onPress={() => handleRemoveFavorite(item.id)}
              >
                <Text style={styles.removeButtonText}>✕</Text>
              </Pressable>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10131a',
    paddingTop: 70,
    paddingHorizontal: 16,
  },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  backText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },

  title: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
  },

  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },

  emptyTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },

  emptyText: {
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
  },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1d2430',
    borderRadius: 10,
    marginBottom: 10,
    overflow: 'hidden',
  },

  cardMain: {
    flex: 1,
    flexDirection: 'row',
    padding: 10,
  },

  image: {
    width: 70,
    height: 100,
    marginRight: 10,
  },

  name: {
    color: 'white',
    fontWeight: '700',
  },

  meta: {
    color: '#cbd5e1',
  },

  placeHint: {
    color: '#60a5fa',
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },

  removeButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#dc2626',
  },

  removeButtonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
  },
});