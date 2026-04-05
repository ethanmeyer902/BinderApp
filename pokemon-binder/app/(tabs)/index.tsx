import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { DraxProvider, DraxView } from 'react-native-drax';

type BinderCard = {
  id: string;
  name: string;
  image: string;
} | null;

const STORAGE_KEY = 'binder-page-1';

export default function BinderScreen() {
  const [slots, setSlots] = useState<BinderCard[]>(Array(9).fill(null));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    loadBinder();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBinder();
    }, [])
  );

  async function loadBinder() {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);

      if (raw) {
        setSlots(JSON.parse(raw));
      } else {
        setSlots(Array(9).fill(null));
      }
    } catch (e) {
      console.log('Load error', e);
    }
  }

  async function saveBinder(updated: BinderCard[]) {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setSlots(updated);
    } catch (e) {
      console.log('Save error', e);
    }
  }

  function removeCard(index: number) {
    const updated = [...slots];
    updated[index] = null;
    saveBinder(updated);
  }

  function handleSlotTap(index: number) {
    if (!isEditing) return;

    const card = slots[index];

    if (!card) {
      router.push(`/search?slot=${index}`);
      return;
    }

    Alert.alert('Edit Card', `"${card.name}"`, [
      {
        text: 'Replace',
        onPress: () => router.push(`/search?slot=${index}`),
      },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => removeCard(index),
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  }

  function handleDrop(fromIndex: number, toIndex: number) {
    if (!isEditing || fromIndex === toIndex) return;

    const updated = [...slots];
    const fromCard = updated[fromIndex];
    const toCard = updated[toIndex];

    updated[toIndex] = fromCard;
    updated[fromIndex] = toCard ?? null;

    saveBinder(updated);
  }

  return (
    <DraxProvider>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Binder</Text>

          <Pressable
            style={[styles.editButton, isEditing && styles.doneButton]}
            onPress={() => setIsEditing((prev) => !prev)}
          >
            <Text style={styles.editButtonText}>
              {isEditing ? 'Done' : 'Edit'}
            </Text>
          </Pressable>
        </View>

        <Text style={styles.modeText}>
          {isEditing
            ? 'Tap a card to replace or remove it. Hold a card to drag it.'
            : 'View mode'}
        </Text>

        <View style={styles.grid}>
          {slots.map((card, index) => (
            <DraxView
              key={`slot-${index}`}
              style={[
                styles.slot,
                isEditing && styles.slotEditing,
              ]}
              receivingStyle={styles.slotReceiving}
              draggable={isEditing && !!card}
              dragPayload={{ fromIndex: index }}
              longPressDelay={250}
              onReceiveDragDrop={({ dragged }) => {
                const fromIndex = dragged.payload?.fromIndex;
                if (typeof fromIndex === 'number') {
                  handleDrop(fromIndex, index);
                }
              }}
            >
              <Pressable
                style={styles.slotInner}
                onPress={() => handleSlotTap(index)}
              >
                {card ? (
                  <Image
                    source={card.image}
                    style={styles.image}
                    contentFit="contain"
                  />
                ) : (
                  <Text style={styles.plus}>{isEditing ? '+' : ''}</Text>
                )}
              </Pressable>
            </DraxView>
          ))}
        </View>
      </View>
    </DraxProvider>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    color: 'white',
    fontSize: 26,
    fontWeight: '700',
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  doneButton: {
    backgroundColor: '#16a34a',
  },
  editButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  modeText: {
    color: '#cbd5e1',
    marginBottom: 16,
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
    overflow: 'hidden',
  },
  slotInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotEditing: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  slotReceiving: {
    borderWidth: 2,
    borderColor: '#16a34a',
    backgroundColor: '#1f2937',
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