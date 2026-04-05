import AsyncStorage from '@react-native-async-storage/async-storage';

export const FAVORITES_STORAGE_KEY = 'favorite-cards';

export type FavoriteCard = {
  id: string;
  name: string;
  image: string;
  setName?: string;
  number?: string;
};

export async function getFavorites(): Promise<FavoriteCard[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVORITES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.log('Get favorites error', error);
    return [];
  }
}

export async function saveFavorites(cards: FavoriteCard[]) {
  try {
    await AsyncStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cards));
  } catch (error) {
    console.log('Save favorites error', error);
  }
}

export async function addFavorite(card: FavoriteCard) {
  const favorites = await getFavorites();

  if (favorites.some((favorite) => favorite.id === card.id)) {
    return favorites;
  }

  const updated = [card, ...favorites];
  await saveFavorites(updated);
  return updated;
}

export async function removeFavorite(cardId: string) {
  const favorites = await getFavorites();
  const updated = favorites.filter((favorite) => favorite.id !== cardId);
  await saveFavorites(updated);
  return updated;
}

export async function toggleFavorite(card: FavoriteCard) {
  const favorites = await getFavorites();
  const exists = favorites.some((favorite) => favorite.id === card.id);

  if (exists) {
    const updated = favorites.filter((favorite) => favorite.id !== card.id);
    await saveFavorites(updated);
    return updated;
  }

  const updated = [card, ...favorites];
  await saveFavorites(updated);
  return updated;
}