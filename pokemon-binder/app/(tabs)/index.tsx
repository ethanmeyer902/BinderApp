import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { DraxProvider, DraxView } from 'react-native-drax';

type BinderCard = {
  id: string;
  name: string;
  image: string;
} | null;

type PendingCard = {
  id: string;
  name: string;
  image: string;
} | null;

const STORAGE_KEY = 'binder-page-1';
const PICKER_SLOT_KEY = 'binder-picker-slot';

export default function BinderScreen() {
  const params = useLocalSearchParams<{
    pendingCardId?: string;
    pendingCardName?: string;
    pendingCardImage?: string;
  }>();

  const [slots, setSlots] = useState<BinderCard[]>(Array(9).fill(null));
  const [isEditing, setIsEditing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);
  const [pendingCard, setPendingCard] = useState<PendingCard>(null);

  const lastPendingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    loadBinder();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBinder();
    }, [])
  );

  useEffect(() => {
    if (!params.pendingCardId || !params.pendingCardName || !params.pendingCardImage) {
      return;
    }

    const pendingKey = `${params.pendingCardId}-${params.pendingCardName}-${params.pendingCardImage}`;

    if (lastPendingKeyRef.current === pendingKey) {
      return;
    }

    setPendingCard({
      id: params.pendingCardId,
      name: params.pendingCardName,
      image: params.pendingCardImage,
    });

    setIsEditing(false);
    setIsSelecting(false);
    setSelectedIndexes([]);
    lastPendingKeyRef.current = pendingKey;
  }, [params.pendingCardId, params.pendingCardName, params.pendingCardImage]);

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

  async function openSearchForSlot(index: number) {
    try {
      await AsyncStorage.setItem(PICKER_SLOT_KEY, String(index));
      router.push('/(tabs)/search');
    } catch (e) {
      console.log('Picker slot save error', e);
    }
  }

  function removeCard(index: number) {
    const updated = [...slots];
    updated[index] = null;
    saveBinder(updated);
  }

  function clearPendingCardAndParams() {
    setPendingCard(null);
    router.replace('/(tabs)');
  }

  function placePendingCard(index: number) {
    if (!pendingCard) return;

    const updated = [...slots];
    updated[index] = {
      id: pendingCard.id,
      name: pendingCard.name,
      image: pendingCard.image,
    };

    saveBinder(updated);
    clearPendingCardAndParams();
  }

  function toggleSelection(index: number) {
    if (!slots[index]) return;

    setSelectedIndexes((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      return [...prev, index];
    });
  }

  function confirmDeleteSelected() {
    if (selectedIndexes.length === 0) return;

    Alert.alert(
      'Delete Selected Cards',
      `Are you sure you want to delete ${selectedIndexes.length} selected card${selectedIndexes.length === 1 ? '' : 's'}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: deleteSelectedCards,
        },
      ]
    );
  }

  function deleteSelectedCards() {
    const updated = [...slots];

    selectedIndexes.forEach((index) => {
      updated[index] = null;
    });

    saveBinder(updated);
    setSelectedIndexes([]);
    setIsSelecting(false);
  }

  function exitEditMode() {
    setIsEditing(false);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  function enterSelectMode() {
    setIsSelecting(true);
    setSelectedIndexes([]);
  }

  function cancelSelectMode() {
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  function handleSlotTap(index: number) {
    if (pendingCard) {
      placePendingCard(index);
      return;
    }

    if (!isEditing) return;

    if (isSelecting) {
      toggleSelection(index);
      return;
    }

    const card = slots[index];

    if (!card) {
      openSearchForSlot(index);
      return;
    }

    Alert.alert('Edit Card', `"${card.name}"`, [
      {
        text: 'Replace',
        onPress: () => openSearchForSlot(index),
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
    if (pendingCard) return;
    if (isSelecting) return;
    if (!isEditing || fromIndex === toIndex) return;

    const updated = [...slots];
    const fromCard = updated[fromIndex];
    const toCard = updated[toIndex];

    updated[toIndex] = fromCard;
    updated[fromIndex] = toCard ?? null;

    saveBinder(updated);
  }

  function isSelected(index: number) {
    return selectedIndexes.includes(index);
  }

  return (
    <DraxProvider>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Binder</Text>

          {pendingCard ? (
            <Pressable
              style={styles.cancelPlacementButton}
              onPress={clearPendingCardAndParams}
            >
              <Text style={styles.editButtonText}>Cancel</Text>
            </Pressable>
          ) : !isEditing ? (
            <Pressable style={styles.editButton} onPress={() => setIsEditing(true)}>
              <Text style={styles.editButtonText}>Edit</Text>
            </Pressable>
          ) : isSelecting ? (
            <View style={styles.headerActions}>
              <Pressable style={styles.cancelSelectButton} onPress={cancelSelectMode}>
                <Text style={styles.editButtonText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.deleteSelectedButton,
                  selectedIndexes.length === 0 && styles.disabledButton,
                ]}
                onPress={confirmDeleteSelected}
                disabled={selectedIndexes.length === 0}
              >
                <Text style={styles.editButtonText}>
                  Delete ({selectedIndexes.length})
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.headerActions}>
              <Pressable style={styles.selectButton} onPress={enterSelectMode}>
                <Text style={styles.editButtonText}>Select</Text>
              </Pressable>

              <Pressable style={styles.doneButton} onPress={exitEditMode}>
                <Text style={styles.editButtonText}>Done</Text>
              </Pressable>
            </View>
          )}
        </View>

        {pendingCard ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>
              Tap any slot to place {pendingCard.name}
            </Text>
          </View>
        ) : isSelecting ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>
              Tap cards to select them for deletion
            </Text>
          </View>
        ) : (
          <Text style={styles.modeText}>
            {isEditing
              ? 'Tap a card to replace or remove it. Hold a card to drag it.'
              : 'View mode'}
          </Text>
        )}

        <View style={styles.grid}>
          {slots.map((card, index) => (
            <DraxView
              key={`slot-${index}`}
              style={[
                styles.slot,
                isEditing && !pendingCard && !isSelecting && styles.slotEditing,
                pendingCard && styles.slotPending,
                isSelected(index) && styles.slotSelected,
              ]}
              receivingStyle={!pendingCard && !isSelecting ? styles.slotReceiving : undefined}
              draggable={isEditing && !pendingCard && !isSelecting && !!card}
              dragPayload={{ fromIndex: index }}
              longPressDelay={250}
              onReceiveDragDrop={({ dragged }) => {
                const fromIndex = dragged.payload?.fromIndex;
                if (typeof fromIndex === 'number') {
                  handleDrop(fromIndex, index);
                }
              }}
            >
              <Pressable style={styles.slotInner} onPress={() => handleSlotTap(index)}>
                {card ? (
                  <>
                    <Image
                      source={card.image}
                      style={styles.image}
                      contentFit="contain"
                    />
                    {isSelected(index) ? (
                      <View style={styles.selectionOverlay}>
                        <Text style={styles.selectionCheck}>✓</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.plus}>
                    {isEditing || pendingCard ? '+' : ''}
                  </Text>
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  doneButton: {
    backgroundColor: '#16a34a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  selectButton: {
    backgroundColor: '#8b5cf6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelSelectButton: {
    backgroundColor: '#64748b',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  deleteSelectedButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelPlacementButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  disabledButton: {
    opacity: 0.45,
  },
  editButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  modeText: {
    color: '#cbd5e1',
    marginBottom: 16,
  },
  pendingBanner: {
    backgroundColor: '#1e3a8a',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
  },
  pendingBannerText: {
    color: 'white',
    fontWeight: '600',
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
  slotPending: {
    borderWidth: 2,
    borderColor: '#f59e0b',
  },
  slotSelected: {
    borderWidth: 3,
    borderColor: '#ef4444',
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
  selectionOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionCheck: {
    color: 'white',
    fontWeight: '800',
    fontSize: 16,
  },
});