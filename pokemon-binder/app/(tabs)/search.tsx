import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FavoriteCard,
  getFavorites,
  toggleFavorite,
} from '@/lib/favoritesStorage';

const STORAGE_KEY = 'binder-page-1';
const PICKER_SLOT_KEY = 'binder-picker-slot';
const PAGE_SIZE = 250;

type BinderCard = {
  id: string;
  name: string;
  image: string;
} | null;

type PokemonSet = {
  id: string;
  name: string;
  series?: string;
};

type PokemonCard = {
  id: string;
  name: string;
  number?: string;
  images: {
    small: string;
    large?: string;
  };
  set?: {
    name?: string;
  };
};

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(false);

  const [groupedSets, setGroupedSets] = useState<Record<string, PokemonSet[]>>(
    {}
  );
  const [selectedSeries, setSelectedSeries] = useState<string | null>(null);

  const [selectedSet, setSelectedSet] = useState('');
  const [selectedSetName, setSelectedSetName] = useState('All Sets');
  const [setModalVisible, setSetModalVisible] = useState(false);

  const [setFilterQuery, setSetFilterQuery] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const [pickerSlot, setPickerSlot] = useState<string | null>(null);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  const isPickerMode = pickerSlot !== null;

  useEffect(() => {
    loadSets();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPickerSlot();
      loadFavoriteIds();
    }, [])
  );

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setIsKeyboardVisible(false);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

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

  async function loadFavoriteIds() {
    const favorites = await getFavorites();
    setFavoriteIds(favorites.map((favorite) => favorite.id));
  }

  function groupSetsBySeries(allSets: PokemonSet[]) {
    const grouped: Record<string, PokemonSet[]> = {};

    allSets.forEach((set) => {
      const series = set.series || 'Other';

      if (!grouped[series]) {
        grouped[series] = [];
      }

      grouped[series].push(set);
    });

    Object.keys(grouped).forEach((series) => {
      grouped[series].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }

  async function loadSets() {
    try {
      const res = await fetch('https://api.pokemontcg.io/v2/sets');
      const data = await res.json();

      const allSets: PokemonSet[] = data.data || [];
      setGroupedSets(groupSetsBySeries(allSets));
    } catch (err) {
      console.log('Load sets error', err);
    }
  }

  function buildSearchQuery(setIdOverride?: string) {
    const activeSet = setIdOverride ?? selectedSet;
    const searchParts: string[] = [];

    if (query.trim()) {
      searchParts.push(`name:${query.trim()}*`);
    }

    if (activeSet) {
      searchParts.push(`set.id:${activeSet}`);
    }

    return searchParts.join(' AND ');
  }

  function parseCardNumber(value?: string) {
    const raw = (value || '').trim();
    const match = raw.match(/^(\d+)([A-Za-z-]*)$/);

    if (match) {
      return {
        raw,
        numeric: Number(match[1]),
        suffix: match[2] || '',
      };
    }

    const fallbackNumber = raw.match(/\d+/);

    return {
      raw,
      numeric: fallbackNumber
        ? Number(fallbackNumber[0])
        : Number.MAX_SAFE_INTEGER,
      suffix: raw.replace(/^\d+/, ''),
    };
  }

  function sortCardsByNumber(cards: PokemonCard[]) {
    return [...cards].sort((a, b) => {
      const aParsed = parseCardNumber(a.number);
      const bParsed = parseCardNumber(b.number);

      if (aParsed.numeric !== bParsed.numeric) {
        return aParsed.numeric - bParsed.numeric;
      }

      if (aParsed.suffix !== bParsed.suffix) {
        return aParsed.suffix.localeCompare(bParsed.suffix);
      }

      if ((a.number || '') !== (b.number || '')) {
        return (a.number || '').localeCompare(b.number || '');
      }

      return a.id.localeCompare(b.id);
    });
  }

  function mergeUniqueCards(cards: PokemonCard[]) {
    const map = new Map<string, PokemonCard>();
    cards.forEach((c) => map.set(c.id, c));
    return Array.from(map.values());
  }

  async function fetchCardsPage(pageNumber: number, setIdOverride?: string) {
    const finalQuery = buildSearchQuery(setIdOverride);

    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(
        finalQuery
      )}&page=${pageNumber}&pageSize=${PAGE_SIZE}`
    );

    return await res.json();
  }

  async function search(setIdOverride?: string) {
    const finalQuery = buildSearchQuery(setIdOverride);
    if (!finalQuery) return;

    setLoading(true);

    try {
      const data = await fetchCardsPage(1, setIdOverride);
      const cards = sortCardsByNumber(mergeUniqueCards(data.data || []));
      const total = data.totalCount || 0;

      setResults(cards);
      setPage(1);
      setTotalCount(total);
      setHasMore(PAGE_SIZE < total);
    } catch (err) {
      console.log('Search error', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMore() {
    if (loading || !hasMore) return;

    setLoading(true);

    try {
      const nextPage = page + 1;
      const data = await fetchCardsPage(nextPage);
      const newCards: PokemonCard[] = data.data || [];

      setResults((prev) => {
        const merged = mergeUniqueCards([...prev, ...newCards]);
        return sortCardsByNumber(merged);
      });

      setPage(nextPage);
      const loadedSoFar = nextPage * PAGE_SIZE;
      setHasMore(loadedSoFar < totalCount);
    } catch (err) {
      console.log('Load more error', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleFavorite(card: PokemonCard) {
    const favoriteCard: FavoriteCard = {
      id: card.id,
      name: card.name,
      image: card.images.small,
      setName: card.set?.name,
      number: card.number,
    };

    const updated = await toggleFavorite(favoriteCard);
    setFavoriteIds(updated.map((favorite) => favorite.id));
  }

  async function selectCard(card: PokemonCard) {
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
          image: card.images.small,
        };

        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentSlots));
        await clearPickerSlot();

        router.push('/(tabs)');
      } catch (err) {
        console.log('Select card error', err);
      }

      return;
    }

    router.push({
      pathname: '/(tabs)',
      params: {
        pendingCardId: card.id,
        pendingCardName: card.name,
        pendingCardImage: card.images.small,
      },
    });
  }

  async function handleBackFromPickerMode() {
    await clearPickerSlot();
    router.push('/(tabs)');
  }

  async function handleSelectSet(setId: string, setName: string) {
    setSelectedSet(setId);
    setSelectedSetName(setName);
    setSelectedSeries(null);
    setSetFilterQuery('');
    setSetModalVisible(false);
    await search(setId);
  }

  async function handleSelectAllSets() {
    setSelectedSet('');
    setSelectedSetName('All Sets');
    setSelectedSeries(null);
    setSetFilterQuery('');
    setSetModalVisible(false);

    if (query.trim()) {
      await search('');
    } else {
      setResults([]);
      setTotalCount(0);
      setHasMore(false);
      setPage(1);
    }
  }

  const sortedSeries = useMemo(() => {
    return Object.keys(groupedSets)
      .filter((series) =>
        series.toLowerCase().includes(setFilterQuery.trim().toLowerCase())
      )
      .sort((a, b) => a.localeCompare(b));
  }, [groupedSets, setFilterQuery]);

  const filteredSetsInSeries = useMemo(() => {
    if (!selectedSeries) return [];

    return (groupedSets[selectedSeries] || []).filter((set) =>
      set.name.toLowerCase().includes(setFilterQuery.trim().toLowerCase())
    );
  }, [groupedSets, selectedSeries, setFilterQuery]);

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

        <Text style={styles.title}>Search Cards</Text>

        <View style={{ width: 60 }} />
      </View>

      <Pressable
        style={styles.setButton}
        onPress={() => {
          setSelectedSeries(null);
          setSetFilterQuery('');
          setSetModalVisible(true);
        }}
      >
        <Text style={styles.setButtonLabel}>Set</Text>
        <Text style={styles.setButtonValue} numberOfLines={1}>
          {selectedSetName}
        </Text>
      </Pressable>

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search Pokémon"
          placeholderTextColor="#aaa"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={() => search()}
        />

        <Pressable style={styles.button} onPress={() => search()}>
          <Text style={styles.buttonText}>Go</Text>
        </Pressable>
      </View>

      {totalCount > 0 ? (
        <Text style={styles.countText}>
          Loaded {results.length} of {totalCount}
        </Text>
      ) : null}

      {loading && results.length === 0 ? (
        <Text style={styles.loading}>Loading...</Text>
      ) : null}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => {
          const isFavorite = favoriteIds.includes(item.id);

          return (
            <View style={styles.card}>
              <Pressable
                style={styles.cardMain}
                onPress={() => selectCard(item)}
              >
                <Image
                  source={item.images.small}
                  style={styles.image}
                  contentFit="contain"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>
                    {item.set?.name || 'Unknown Set'} #{item.number || '?'}
                  </Text>
                  {!isPickerMode ? (
                    <Text style={styles.placeHint}>Tap to place in binder</Text>
                  ) : null}
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.favoriteButton,
                  isFavorite && styles.favoriteButtonActive,
                ]}
                onPress={() => handleToggleFavorite(item)}
              >
                <Text style={styles.favoriteButtonText}>
                  {isFavorite ? '★' : '☆'}
                </Text>
              </Pressable>
            </View>
          );
        }}
        ListFooterComponent={
          hasMore ? (
            <Pressable
              style={styles.loadMoreButton}
              onPress={loadMore}
              disabled={loading}
            >
              <Text style={styles.loadMoreText}>
                {loading ? 'Loading...' : 'Load More'}
              </Text>
            </Pressable>
          ) : null
        }
      />

      <Modal
        visible={setModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setSelectedSeries(null);
          setSetFilterQuery('');
          setSetModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            style={styles.keyboardAvoidingContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View
              style={[
                styles.modalContent,
                {
                  height: isKeyboardVisible ? '90%' : '75%',
                  borderTopLeftRadius: isKeyboardVisible ? 0 : 16,
                  borderTopRightRadius: isKeyboardVisible ? 0 : 16,
                },
              ]}
            >
              {!selectedSeries ? (
                <>
                  <Text style={styles.modalTitle}>Select Series</Text>

                  <TextInput
                    placeholder="Search series"
                    placeholderTextColor="#aaa"
                    style={styles.modalInput}
                    value={setFilterQuery}
                    onChangeText={setSetFilterQuery}
                  />

                  <Pressable style={styles.setOption} onPress={handleSelectAllSets}>
                    <Text style={styles.setOptionText}>All Sets</Text>
                  </Pressable>

                  <FlatList
                    data={sortedSeries}
                    keyExtractor={(item) => item}
                    keyboardShouldPersistTaps="handled"
                    style={styles.modalList}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.setOption}
                        onPress={() => {
                          setSelectedSeries(item);
                          setSetFilterQuery('');
                        }}
                      >
                        <Text style={styles.setOptionText}>{item}</Text>
                      </Pressable>
                    )}
                  />
                </>
              ) : (
                <>
                  <Pressable
                    onPress={() => {
                      setSelectedSeries(null);
                      setSetFilterQuery('');
                    }}
                    style={styles.backRow}
                  >
                    <Text style={styles.modalBackText}>← Back</Text>
                  </Pressable>

                  <Text style={styles.modalTitle}>{selectedSeries}</Text>

                  <TextInput
                    placeholder="Search sets in this series"
                    placeholderTextColor="#aaa"
                    style={styles.modalInput}
                    value={setFilterQuery}
                    onChangeText={setSetFilterQuery}
                  />

                  <FlatList
                    data={filteredSetsInSeries}
                    keyExtractor={(item) => item.id}
                    keyboardShouldPersistTaps="handled"
                    style={styles.modalList}
                    renderItem={({ item }) => (
                      <Pressable
                        style={styles.setOption}
                        onPress={() => handleSelectSet(item.id, item.name)}
                      >
                        <Text style={styles.setOptionText}>{item.name}</Text>
                      </Pressable>
                    )}
                  />
                </>
              )}

              <Pressable
                style={styles.closeButton}
                onPress={() => {
                  setSelectedSeries(null);
                  setSetFilterQuery('');
                  setSetModalVisible(false);
                }}
              >
                <Text style={styles.closeButtonText}>Close</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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

  setButton: {
    backgroundColor: '#1d2430',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  setButtonLabel: {
    color: '#94a3b8',
    fontSize: 12,
  },

  setButtonValue: {
    color: 'white',
    fontSize: 16,
  },

  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },

  input: {
    flex: 1,
    backgroundColor: '#1d2430',
    color: 'white',
    padding: 12,
    borderRadius: 10,
  },

  button: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 10,
  },

  buttonText: {
    color: 'white',
    fontWeight: '700',
  },

  countText: {
    color: '#cbd5e1',
    marginBottom: 10,
  },

  loading: {
    color: '#cbd5e1',
    marginBottom: 10,
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

  favoriteButton: {
    width: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#334155',
  },

  favoriteButtonActive: {
    backgroundColor: '#f59e0b',
  },

  favoriteButtonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
  },

  loadMoreButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },

  loadMoreText: {
    color: 'white',
    fontWeight: '700',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },

  keyboardAvoidingContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  modalContent: {
    backgroundColor: '#10131a',
    padding: 16,
  },

  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },

  modalInput: {
    backgroundColor: '#1d2430',
    color: 'white',
    padding: 12,
    borderRadius: 10,
    marginBottom: 12,
  },

  modalList: {
    flex: 1,
  },

  backRow: {
    marginBottom: 10,
  },

  modalBackText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },

  setOption: {
    padding: 12,
    borderBottomColor: '#334155',
    borderBottomWidth: 1,
  },

  setOptionText: {
    color: 'white',
    fontSize: 16,
  },

  closeButton: {
    backgroundColor: '#334155',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 10,
  },

  closeButtonText: {
    color: 'white',
    fontWeight: '700',
  },
});