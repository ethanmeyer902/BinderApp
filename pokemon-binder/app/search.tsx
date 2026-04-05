import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'binder-page-1';
const PAGE_SIZE = 250;

type BinderCard = {
  id: string;
  name: string;
  image: string;
} | null;

type PokemonSet = {
  id: string;
  name: string;
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
  const { slot } = useLocalSearchParams<{ slot: string }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PokemonCard[]>([]);
  const [loading, setLoading] = useState(false);

  const [sets, setSets] = useState<PokemonSet[]>([]);
  const [selectedSet, setSelectedSet] = useState('');
  const [selectedSetName, setSelectedSetName] = useState('All Sets');
  const [setModalVisible, setSetModalVisible] = useState(false);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    loadSets();
  }, []);

  async function loadSets() {
    try {
      const res = await fetch('https://api.pokemontcg.io/v2/sets');
      const data = await res.json();

      const simplifiedSets = (data.data || []).map((set: any) => ({
        id: set.id,
        name: set.name,
      }));

      simplifiedSets.sort((a: PokemonSet, b: PokemonSet) =>
        a.name.localeCompare(b.name)
      );

      setSets(simplifiedSets);
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
      numeric: fallbackNumber ? Number(fallbackNumber[0]) : Number.MAX_SAFE_INTEGER,
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
    const uniqueMap = new Map<string, PokemonCard>();

    for (const card of cards) {
      if (!uniqueMap.has(card.id)) {
        uniqueMap.set(card.id, card);
      }
    }

    return Array.from(uniqueMap.values());
  }

  async function fetchCardsPage(pageNumber: number, setIdOverride?: string) {
    const finalQuery = buildSearchQuery(setIdOverride);

    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(finalQuery)}&page=${pageNumber}&pageSize=${PAGE_SIZE}`
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

  async function selectCard(card: PokemonCard) {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const currentSlots: BinderCard[] = raw ? JSON.parse(raw) : Array(9).fill(null);

      const index = Number(slot);
      if (Number.isNaN(index)) return;

      currentSlots[index] = {
        id: card.id,
        name: card.name,
        image: card.images.small,
      };

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentSlots));
      router.back();
    } catch (err) {
      console.log('Select card error', err);
    }
  }

  async function handleSelectSet(setId: string, setName: string) {
    setSelectedSet(setId);
    setSelectedSetName(setName);
    setSetModalVisible(false);
    await search(setId);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Cards</Text>

      <Pressable
        style={styles.setButton}
        onPress={() => setSetModalVisible(true)}
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
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => selectCard(item)}>
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
            </View>
          </Pressable>
        )}
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
        onRequestClose={() => setSetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Choose a Set</Text>

            <Pressable
              style={styles.setOption}
              onPress={() => handleSelectSet('', 'All Sets')}
            >
              <Text style={styles.setOptionText}>All Sets</Text>
            </Pressable>

            <FlatList
              data={sets}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.setOption}
                  onPress={() => handleSelectSet(item.id, item.name)}
                >
                  <Text style={styles.setOptionText}>{item.name}</Text>
                </Pressable>
              )}
            />

            <Pressable
              style={styles.closeButton}
              onPress={() => setSetModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </Pressable>
          </View>
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
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 16,
    textAlign: 'center',
  },
  setButton: {
    backgroundColor: '#1d2430',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  setButtonLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  setButtonValue: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
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
    marginBottom: 12,
    backgroundColor: '#1d2430',
    padding: 10,
    borderRadius: 10,
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
    marginTop: 4,
  },
  loadMoreButton: {
    backgroundColor: '#3b82f6',
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 30,
  },
  loadMoreText: {
    color: 'white',
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#10131a',
    maxHeight: '75%',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
  },
  modalTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  setOption: {
    backgroundColor: '#1d2430',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 8,
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