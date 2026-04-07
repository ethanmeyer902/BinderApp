import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  FlatList,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Dimensions,
  Modal,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import { DraxProvider, DraxView } from 'react-native-drax';
import {
  BinderCard,
  addBinderPage,
  deleteBinderPage,
  deleteCardsFromBinderPage,
  loadBinderData,
  moveCardBetweenPages,
  moveCardInBinder,
  placeCardInBinder,
  removeCardFromBinder,
  savePickerTarget,
  setCurrentBinderPage,
} from '@/lib/binderStorage';

type PendingCard = {
  id: string;
  name: string;
  image: string;
} | null;

type PendingMove = {
  card: Exclude<BinderCard, null>;
  fromPageIndex: number;
  fromSlotIndex: number;
} | null;

const SCREEN_WIDTH = Dimensions.get('window').width;
const HORIZONTAL_PADDING = 16;
const PAGE_WIDTH = SCREEN_WIDTH - HORIZONTAL_PADDING * 2;

export default function BinderScreen() {
  const params = useLocalSearchParams<{
    pendingCardId?: string;
    pendingCardName?: string;
    pendingCardImage?: string;
  }>();

  const [pages, setPages] = useState<BinderCard[][]>([]);
  const [currentPage, setCurrentPage] = useState(0);

  const [isEditing, setIsEditing] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedIndexes, setSelectedIndexes] = useState<number[]>([]);

  const [pendingCard, setPendingCard] = useState<PendingCard>(null);
  const [pendingMove, setPendingMove] = useState<PendingMove>(null);

  const [pagesModalVisible, setPagesModalVisible] = useState(false);
  const [movePageModalVisible, setMovePageModalVisible] = useState(false);

  const lastPendingKeyRef = useRef<string | null>(null);
  const pagerRef = useRef<ScrollView | null>(null);
  const hasMountedPagerRef = useRef(false);

  const slots = useMemo(() => {
    return pages[currentPage] ?? Array(9).fill(null);
  }, [pages, currentPage]);

  const showSinglePageEditor = isEditing || !!pendingCard || !!pendingMove;

  useEffect(() => {
    refreshBinder();
  }, []);

  useFocusEffect(
    useCallback(() => {
      refreshBinder();
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

    setPendingMove(null);
    setIsEditing(false);
    setIsSelecting(false);
    setSelectedIndexes([]);
    lastPendingKeyRef.current = pendingKey;
  }, [params.pendingCardId, params.pendingCardName, params.pendingCardImage]);

  useEffect(() => {
    if (!pagerRef.current || pages.length === 0 || showSinglePageEditor) return;

    const clampedPage = Math.max(0, Math.min(currentPage, pages.length - 1));
    const x = clampedPage * PAGE_WIDTH;

    if (!hasMountedPagerRef.current) {
      pagerRef.current.scrollTo({ x, animated: false });
      hasMountedPagerRef.current = true;
      return;
    }

    pagerRef.current.scrollTo({ x, animated: true });
  }, [currentPage, pages.length, showSinglePageEditor]);

  async function refreshBinder() {
    const data = await loadBinderData();
    setPages(data.pages);
    setCurrentPage(data.currentPage);
  }

  async function openSearchForSlot(index: number) {
    await savePickerTarget({
      pageIndex: currentPage,
      slotIndex: index,
    });

    router.push('/(tabs)/search');
  }

  async function removeCard(index: number) {
    const updated = await removeCardFromBinder(currentPage, index);
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
  }

  function clearPendingCardAndParams() {
    setPendingCard(null);
    router.replace('/(tabs)');
  }

  function cancelPendingMove() {
    setPendingMove(null);
  }

  async function placePendingCard(index: number) {
    if (!pendingCard) return;

    const existingCard = slots[index];

    if (existingCard) {
      Alert.alert(
        'Replace Card',
        `Replace "${existingCard.name}" with "${pendingCard.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: async () => {
              const updated = await placeCardInBinder(currentPage, index, {
                id: pendingCard.id,
                name: pendingCard.name,
                image: pendingCard.image,
              });

              setPages(updated.pages);
              setCurrentPage(updated.currentPage);
              clearPendingCardAndParams();
            },
          },
        ]
      );
      return;
    }

    const updated = await placeCardInBinder(currentPage, index, {
      id: pendingCard.id,
      name: pendingCard.name,
      image: pendingCard.image,
    });

    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    clearPendingCardAndParams();
  }

  async function placeMovedCard(index: number) {
    if (!pendingMove) return;

    const existingCard = slots[index];

    const finalizeMove = async () => {
      const updated = await moveCardBetweenPages(
        pendingMove.fromPageIndex,
        pendingMove.fromSlotIndex,
        currentPage,
        index
      );

      setPages(updated.pages);
      setCurrentPage(updated.currentPage);
      setPendingMove(null);
    };

    if (existingCard) {
      Alert.alert(
        'Replace Card',
        `Replace "${existingCard.name}" with "${pendingMove.card.name}"?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Replace',
            style: 'destructive',
            onPress: finalizeMove,
          },
        ]
      );
      return;
    }

    await finalizeMove();
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
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: deleteSelectedCards,
        },
      ]
    );
  }

  async function deleteSelectedCards() {
    const updated = await deleteCardsFromBinderPage(currentPage, selectedIndexes);
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    setSelectedIndexes([]);
    setIsSelecting(false);
  }

  function enterEditMode() {
    setPendingCard(null);
    setPendingMove(null);
    setIsEditing(true);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  function exitEditMode() {
    setIsEditing(false);
    setIsSelecting(false);
    setSelectedIndexes([]);
    setPendingMove(null);
  }

  function enterSelectMode() {
    setIsSelecting(true);
    setSelectedIndexes([]);
  }

  function cancelSelectMode() {
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  function startMoveToAnotherPage(index: number) {
    const card = slots[index];
    if (!card) return;

    setPendingCard(null);
    setPendingMove({
      card,
      fromPageIndex: currentPage,
      fromSlotIndex: index,
    });
    setMovePageModalVisible(true);
  }

  async function chooseMoveDestinationPage(pageIndex: number) {
    setMovePageModalVisible(false);

    const updated = await setCurrentBinderPage(pageIndex);
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    setIsEditing(false);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  async function chooseMoveDestinationNewPage() {
    setMovePageModalVisible(false);

    const updated = await addBinderPage();
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    setIsEditing(false);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  function handleSlotTap(index: number) {
    if (pendingMove) {
      placeMovedCard(index);
      return;
    }

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
        text: 'Move to Another Page',
        onPress: () => startMoveToAnotherPage(index),
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

  async function handleDrop(fromIndex: number, toIndex: number) {
    if (pendingCard || pendingMove) return;
    if (isSelecting) return;
    if (!isEditing || fromIndex === toIndex) return;

    const updated = await moveCardInBinder(currentPage, fromIndex, toIndex);
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
  }

  function isSelected(index: number) {
    return selectedIndexes.includes(index);
  }

  async function openPage(pageIndex: number) {
    setPagesModalVisible(false);
    const updated = await setCurrentBinderPage(pageIndex);
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  async function handleAddPage() {
    setPagesModalVisible(false);
    const updated = await addBinderPage();
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  function confirmDeletePage() {
    setPagesModalVisible(false);

    if (pages.length === 1) {
      Alert.alert('Cannot Delete Page', 'Your binder must have at least one page.');
      return;
    }

    Alert.alert(
      'Delete Page',
      `Are you sure you want to delete page ${currentPage + 1}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: handleDeletePage,
        },
      ]
    );
  }

  async function handleDeletePage() {
    const updated = await deleteBinderPage(currentPage);
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  async function handlePageSwipeEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>
  ) {
    const pageWidth = event.nativeEvent.layoutMeasurement.width;
    const offsetX = event.nativeEvent.contentOffset.x;
    const nextPage = Math.round(offsetX / pageWidth);

    if (nextPage === currentPage) return;
    if (nextPage < 0 || nextPage >= pages.length) return;

    const updated = await setCurrentBinderPage(nextPage);
    setPages(updated.pages);
    setCurrentPage(updated.currentPage);
    setIsSelecting(false);
    setSelectedIndexes([]);
  }

  function renderPageDots() {
    return (
      <View style={styles.pageDotsRow}>
        {pages.map((_, index) => (
          <View
            key={`dot-${index}`}
            style={[
              styles.pageDot,
              index === currentPage && styles.pageDotActive,
            ]}
          />
        ))}
      </View>
    );
  }

  function renderPagesModal() {
    return (
      <Modal
        visible={pagesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPagesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pages</Text>

            <Pressable style={styles.modalPrimaryButton} onPress={handleAddPage}>
              <Text style={styles.modalPrimaryButtonText}>Add Page</Text>
            </Pressable>

            <Pressable style={styles.modalDangerButton} onPress={confirmDeletePage}>
              <Text style={styles.modalPrimaryButtonText}>Delete Current Page</Text>
            </Pressable>

            <Text style={styles.modalSectionLabel}>Go To Page</Text>

            <FlatList
              data={pages}
              keyExtractor={(_, index) => `page-option-${index}`}
              style={styles.pageList}
              renderItem={({ index }) => (
                <Pressable
                  style={[
                    styles.pageListItem,
                    index === currentPage && styles.pageListItemActive,
                  ]}
                  onPress={() => openPage(index)}
                >
                  <Text style={styles.pageListItemText}>
                    Page {index + 1}
                    {index === currentPage ? ' (Current)' : ''}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setPagesModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  function renderMovePageModal() {
    const pageOptions = pages
      .map((_, index) => index)
      .filter((index) => index !== currentPage);

    return (
      <Modal
        visible={movePageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMovePageModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Move to Another Page</Text>

            <Text style={styles.modalSubtitle}>
              Choose a page, then tap the destination slot.
            </Text>

            <FlatList
              data={pageOptions}
              keyExtractor={(item) => `move-page-${item}`}
              style={styles.pageList}
              ListEmptyComponent={
                <Text style={styles.emptyModalText}>
                  No other pages yet. Add a new one below.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={styles.pageListItem}
                  onPress={() => chooseMoveDestinationPage(item)}
                >
                  <Text style={styles.pageListItemText}>Page {item + 1}</Text>
                </Pressable>
              )}
            />

            <Pressable
              style={styles.modalPrimaryButton}
              onPress={chooseMoveDestinationNewPage}
            >
              <Text style={styles.modalPrimaryButtonText}>Add New Page</Text>
            </Pressable>

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => {
                setMovePageModalVisible(false);
                cancelPendingMove();
              }}
            >
              <Text style={styles.modalCloseButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    );
  }

  function renderEditableGrid(pageSlots: BinderCard[]) {
    return (
      <View style={styles.pageContainerSingle}>
        <View style={styles.grid}>
          {pageSlots.map((card, slotIndex) => (
            <DraxView
              key={`current-page-slot-${slotIndex}`}
              style={[
                styles.slot,
                isEditing &&
                  !pendingCard &&
                  !pendingMove &&
                  !isSelecting &&
                  styles.slotEditing,
                (pendingCard || pendingMove) && styles.slotPending,
                isSelected(slotIndex) && styles.slotSelected,
              ]}
              receivingStyle={
                !pendingCard && !pendingMove && !isSelecting
                  ? styles.slotReceiving
                  : undefined
              }
              draggable={
                isEditing &&
                !pendingCard &&
                !pendingMove &&
                !isSelecting &&
                !!card
              }
              dragPayload={{ fromIndex: slotIndex }}
              longPressDelay={250}
              onReceiveDragDrop={({ dragged }) => {
                const payload = dragged.payload as
                  | { fromIndex?: number }
                  | undefined;

                const fromIndex = payload?.fromIndex;

                if (typeof fromIndex === 'number') {
                  handleDrop(fromIndex, slotIndex);
                }
              }}
            >
              <Pressable
                style={styles.slotInner}
                onPress={() => handleSlotTap(slotIndex)}
              >
                {card ? (
                  <>
                    <Image
                      source={card.image}
                      style={styles.image}
                      contentFit="contain"
                    />
                    {isSelected(slotIndex) ? (
                      <View style={styles.selectionOverlay}>
                        <Text style={styles.selectionCheck}>✓</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text style={styles.plus}>
                    {isEditing || pendingCard || pendingMove ? '+' : ''}
                  </Text>
                )}
              </Pressable>
            </DraxView>
          ))}
        </View>
      </View>
    );
  }

  function renderSwipePager() {
    return (
      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handlePageSwipeEnd}
        contentContainerStyle={styles.pagesScrollContent}
      >
        {pages.map((pageSlots, pageIndex) => (
          <View key={`binder-page-${pageIndex}`} style={styles.pageContainer}>
            <View style={styles.grid}>
              {pageSlots.map((card, slotIndex) => (
                <Pressable
                  key={`page-${pageIndex}-slot-${slotIndex}`}
                  style={styles.slot}
                  onPress={() => {}}
                >
                  <View style={styles.slotInner}>
                    {card ? (
                      <Image
                        source={card.image}
                        style={styles.image}
                        contentFit="contain"
                      />
                    ) : null}
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  return (
    <DraxProvider>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>My Binder</Text>

          {pendingCard ? (
            <Pressable style={styles.cancelPlacementButton} onPress={clearPendingCardAndParams}>
              <Text style={styles.editButtonText}>Cancel</Text>
            </Pressable>
          ) : pendingMove ? (
            <Pressable style={styles.cancelPlacementButton} onPress={cancelPendingMove}>
              <Text style={styles.editButtonText}>Cancel Move</Text>
            </Pressable>
          ) : !isEditing ? (
            <Pressable style={styles.editButton} onPress={enterEditMode}>
              <Text style={styles.editButtonText}>Edit Page</Text>
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
                <Text style={styles.editButtonText}>Delete ({selectedIndexes.length})</Text>
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

        <View style={styles.pageInfoRow}>
          <View style={styles.pageInfoTopRow}>
            <Text style={styles.pageText}>
              Page {currentPage + 1} / {pages.length || 1}
            </Text>

            <Pressable
              style={styles.pagesButton}
              onPress={() => setPagesModalVisible(true)}
            >
              <Text style={styles.pagesButtonText}>Pages</Text>
            </Pressable>
          </View>

          {renderPageDots()}
        </View>

        {pendingMove ? (
          <View style={styles.pendingBanner}>
            <Text style={styles.pendingBannerText}>
              Tap a slot on this page to move {pendingMove.card.name}
            </Text>
          </View>
        ) : pendingCard ? (
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
              ? 'Tap a card to replace, remove, or move it to another page. Hold a card to drag it on this page.'
              : 'Swipe to change binder pages'}
          </Text>
        )}

        {showSinglePageEditor ? renderEditableGrid(slots) : renderSwipePager()}

        {renderPagesModal()}
        {renderMovePageModal()}
      </View>
    </DraxProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#10131a',
    paddingTop: 70,
    paddingHorizontal: HORIZONTAL_PADDING,
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
  pageInfoRow: {
    marginBottom: 12,
  },
  pageInfoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  pagesButton: {
    backgroundColor: '#334155',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  pagesButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  pageText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  pageDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#475569',
  },
  pageDotActive: {
    backgroundColor: '#3b82f6',
    width: 18,
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
  pagesScrollContent: {
    flexDirection: 'row',
  },
  pageContainer: {
    width: PAGE_WIDTH,
  },
  pageContainerSingle: {
    width: '100%',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#10131a',
    borderRadius: 16,
    padding: 16,
    maxHeight: '80%',
  },
  modalTitle: {
    color: 'white',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSubtitle: {
    color: '#cbd5e1',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalSectionLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 8,
  },
  modalPrimaryButton: {
    backgroundColor: '#0f766e',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  modalDangerButton: {
    backgroundColor: '#b91c1c',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 6,
  },
  modalPrimaryButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  pageList: {
    marginTop: 8,
    marginBottom: 12,
  },
  pageListItem: {
    backgroundColor: '#1d2430',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  pageListItemActive: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  pageListItemText: {
    color: 'white',
    fontWeight: '600',
  },
  modalCloseButton: {
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: {
    color: 'white',
    fontWeight: '700',
  },
  emptyModalText: {
    color: '#cbd5e1',
    textAlign: 'center',
    marginBottom: 12,
  },
});