import { View, Text, Pressable, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';

type BinderCard = {
  id: string;
  name: string;
  image: string;
} | null;

const STORAGE_KEY = 'binder-page-1';

export default function BinderScreen() {
  const params = useLocalSearchParams();

  const [slots, setSlots] = useState<BinderCard[]>(Array(9).fill(null));

  // Load saved binder
  useEffect(() => {
    loadBinder();
  }, []);

  // Handle returning from search
  useEffect(() => {
    if (params.slot && params.cardImage) {
      const index = Number(params.slot);

      if (!Number.isNaN(index)) {
        const updated = [...slots];

        updated[index] = {
          id: params.cardId as string,
          name: params.cardName as string,
          image: params.cardImage as string,
        };

        setSlots(updated);
        saveBinder(updated);

        // Prevent re-trigger loop
        router.setParams({});
      }
    }
  }, [params]);

  async function loadBinder() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        setSlots(JSON.parse(raw));
      }
    } catch (e) {
      console.log('Load error', e);
    }
  }

  async function saveBinder(updated: BinderCard[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.log('Save error', e);
    }
  }

  function openSearch(slotIndex: number) {
    router.push(`/search?slot=${slotIndex}`);
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Binder</Text>

      <View style={styles.grid}>
        {slots.map((card, index) => (
          <Pressable
            key={index}
            style={styles.slot}
            onPress={() => openSearch(index)}
          >
            {card ? (
              <Image source={card.image} style={styles.image} contentFit="contain" />
            ) : (
              <Text style={styles.plus}>+</Text>
            )}
          </Pressable>
        ))}
      </View>
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
    marginBottom: 20,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  slot: {
    width: '31%',
    aspectRatio: 0.72,
    backgroundColor: '#1d2430',
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  plus: {
    color: '#94a3b8',
    fontSize: 28,
  },
  image: {
    width: '100%',
    height: '100%',
  },
});