import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';

export default function SearchScreen() {
  const { slot } = useLocalSearchParams<{ slot: string }>();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!query.trim()) return;

    setLoading(true);

    try {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(query)}*`
      );

      const data = await res.json();
      setResults(data.data || []);
    } catch (err) {
      console.log('Search error', err);
    } finally {
      setLoading(false);
    }
  }

  function selectCard(card: any) {
    router.replace({
      pathname: '/(tabs)',
      params: {
        slot,
        cardId: card.id,
        cardName: card.name,
        cardImage: card.images.small,
      },
    });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Search Cards</Text>

      <View style={styles.searchRow}>
        <TextInput
          placeholder="Search Pokémon"
          placeholderTextColor="#aaa"
          style={styles.input}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={search}
        />

        <Pressable style={styles.button} onPress={search}>
          <Text style={styles.buttonText}>Go</Text>
        </Pressable>
      </View>

      {loading && <Text style={styles.loading}>Loading...</Text>}

      <FlatList
        data={results}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 40 }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => selectCard(item)}>
            <Image source={item.images.small} style={styles.image} contentFit="contain" />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.meta}>
                {item.set?.name || 'Unknown Set'} #{item.number || '?'}
              </Text>
            </View>
          </Pressable>
        )}
      />
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
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
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
});