import AsyncStorage from '@react-native-async-storage/async-storage';

export type BinderCard =
  | {
      id: string;
      name: string;
      image: string;
    }
  | null;

export type BinderPage = BinderCard[];

export type PickerTarget = {
  pageIndex: number;
  slotIndex: number;
};

export type BinderData = {
  pages: BinderPage[];
  currentPage: number;
};

export const BINDER_PAGES_KEY = 'binder-pages';
export const BINDER_CURRENT_PAGE_KEY = 'binder-current-page';
export const PICKER_TARGET_KEY = 'binder-picker-target';
export const BINDER_PAGE_SIZE = 9;

export function createEmptyPage(): BinderPage {
  return Array.from({ length: BINDER_PAGE_SIZE }, (): BinderCard => null);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidBinderCard(value: unknown): value is Exclude<BinderCard, null> {
  if (!isObject(value)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.image === 'string'
  );
}

function normalizeCard(value: unknown): BinderCard {
  if (value === null) return null;
  if (isValidBinderCard(value)) return value;
  return null;
}

function normalizePage(value: unknown): BinderPage {
  if (!Array.isArray(value)) {
    return createEmptyPage();
  }

  const page: BinderPage = value
    .slice(0, BINDER_PAGE_SIZE)
    .map((item): BinderCard => normalizeCard(item));

  while (page.length < BINDER_PAGE_SIZE) {
    page.push(null);
  }

  return page;
}

function normalizePages(value: unknown): BinderPage[] {
  if (!Array.isArray(value) || value.length === 0) {
    return [createEmptyPage()];
  }

  return value.map((page): BinderPage => normalizePage(page));
}

function normalizeCurrentPage(value: unknown, totalPages: number): number {
  const pageNumber =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
      ? Number(value)
      : 0;

  if (Number.isNaN(pageNumber)) return 0;
  if (pageNumber < 0) return 0;
  if (pageNumber >= totalPages) return totalPages - 1;

  return pageNumber;
}

export async function loadBinderData(): Promise<BinderData> {
  try {
    const [rawPages, rawCurrentPage] = await Promise.all([
      AsyncStorage.getItem(BINDER_PAGES_KEY),
      AsyncStorage.getItem(BINDER_CURRENT_PAGE_KEY),
    ]);

    const parsedPages: unknown = rawPages ? JSON.parse(rawPages) : null;
    const pages = normalizePages(parsedPages);
    const currentPage = normalizeCurrentPage(rawCurrentPage, pages.length);

    return {
      pages,
      currentPage,
    };
  } catch (error) {
    console.log('loadBinderData error', error);

    return {
      pages: [createEmptyPage()],
      currentPage: 0,
    };
  }
}

export async function saveBinderData(data: BinderData): Promise<void> {
  const pages = normalizePages(data.pages);
  const currentPage = normalizeCurrentPage(data.currentPage, pages.length);

  await Promise.all([
    AsyncStorage.setItem(BINDER_PAGES_KEY, JSON.stringify(pages)),
    AsyncStorage.setItem(BINDER_CURRENT_PAGE_KEY, String(currentPage)),
  ]);
}

export async function savePickerTarget(target: PickerTarget): Promise<void> {
  await AsyncStorage.setItem(PICKER_TARGET_KEY, JSON.stringify(target));
}

export async function loadPickerTarget(): Promise<PickerTarget | null> {
  try {
    const raw = await AsyncStorage.getItem(PICKER_TARGET_KEY);

    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);

    if (!isObject(parsed)) return null;
    if (typeof parsed.pageIndex !== 'number') return null;
    if (typeof parsed.slotIndex !== 'number') return null;

    return {
      pageIndex: parsed.pageIndex,
      slotIndex: parsed.slotIndex,
    };
  } catch (error) {
    console.log('loadPickerTarget error', error);
    return null;
  }
}

export async function clearPickerTarget(): Promise<void> {
  await AsyncStorage.removeItem(PICKER_TARGET_KEY);
}

export async function setCurrentBinderPage(pageIndex: number): Promise<BinderData> {
  const data = await loadBinderData();
  const currentPage = normalizeCurrentPage(pageIndex, data.pages.length);

  const updated: BinderData = {
    pages: data.pages,
    currentPage,
  };

  await saveBinderData(updated);
  return updated;
}

export async function addBinderPage(): Promise<BinderData> {
  const data = await loadBinderData();

  const updated: BinderData = {
    pages: [...data.pages, createEmptyPage()],
    currentPage: data.pages.length,
  };

  await saveBinderData(updated);
  return updated;
}

export async function deleteBinderPage(pageIndex: number): Promise<BinderData> {
  const data = await loadBinderData();

  if (data.pages.length === 1) {
    return data;
  }

  const nextPages = data.pages.filter((_, index) => index !== pageIndex);

  const updated: BinderData = {
    pages: nextPages,
    currentPage:
      pageIndex >= nextPages.length ? nextPages.length - 1 : pageIndex,
  };

  await saveBinderData(updated);
  return updated;
}

export async function updateBinderPage(
  pageIndex: number,
  updater: (page: BinderPage) => BinderPage
): Promise<BinderData> {
  const data = await loadBinderData();
  const nextPages: BinderPage[] = [...data.pages];

  while (nextPages.length <= pageIndex) {
    nextPages.push(createEmptyPage());
  }

  const currentPageData = normalizePage(nextPages[pageIndex]);
  const updatedPage = normalizePage(updater([...currentPageData]));
  nextPages[pageIndex] = updatedPage;

  const updated: BinderData = {
    pages: nextPages,
    currentPage: normalizeCurrentPage(data.currentPage, nextPages.length),
  };

  await saveBinderData(updated);
  return updated;
}

export async function placeCardInBinder(
  pageIndex: number,
  slotIndex: number,
  card: Exclude<BinderCard, null>
): Promise<BinderData> {
  return updateBinderPage(pageIndex, (page) => {
    if (slotIndex < 0 || slotIndex >= BINDER_PAGE_SIZE) {
      return page;
    }

    const nextPage = [...page];
    nextPage[slotIndex] = card;
    return nextPage;
  });
}

export async function removeCardFromBinder(
  pageIndex: number,
  slotIndex: number
): Promise<BinderData> {
  return updateBinderPage(pageIndex, (page) => {
    if (slotIndex < 0 || slotIndex >= BINDER_PAGE_SIZE) {
      return page;
    }

    const nextPage = [...page];
    nextPage[slotIndex] = null;
    return nextPage;
  });
}

export async function moveCardInBinder(
  pageIndex: number,
  fromIndex: number,
  toIndex: number
): Promise<BinderData> {
  return updateBinderPage(pageIndex, (page) => {
    if (fromIndex < 0 || fromIndex >= BINDER_PAGE_SIZE) {
      return page;
    }

    if (toIndex < 0 || toIndex >= BINDER_PAGE_SIZE) {
      return page;
    }

    if (fromIndex === toIndex) {
      return page;
    }

    const nextPage = [...page];
    const fromCard = nextPage[fromIndex];
    const toCard = nextPage[toIndex];

    nextPage[toIndex] = fromCard;
    nextPage[fromIndex] = toCard ?? null;

    return nextPage;
  });
}

export async function moveCardBetweenPages(
  fromPageIndex: number,
  fromSlotIndex: number,
  toPageIndex: number,
  toSlotIndex: number
): Promise<BinderData> {
  const data = await loadBinderData();
  const nextPages: BinderPage[] = [...data.pages];

  while (nextPages.length <= fromPageIndex) {
    nextPages.push(createEmptyPage());
  }

  while (nextPages.length <= toPageIndex) {
    nextPages.push(createEmptyPage());
  }

  const fromPage = normalizePage(nextPages[fromPageIndex]);
  const toPage = normalizePage(nextPages[toPageIndex]);

  if (
    fromSlotIndex < 0 ||
    fromSlotIndex >= BINDER_PAGE_SIZE ||
    toSlotIndex < 0 ||
    toSlotIndex >= BINDER_PAGE_SIZE
  ) {
    return data;
  }

  const movingCard = fromPage[fromSlotIndex];

  if (!movingCard) {
    return data;
  }

  const updatedFromPage = [...fromPage];
  const updatedToPage = [...toPage];

  updatedFromPage[fromSlotIndex] = null;
  updatedToPage[toSlotIndex] = movingCard;

  nextPages[fromPageIndex] = updatedFromPage;
  nextPages[toPageIndex] = updatedToPage;

  const updated: BinderData = {
    pages: nextPages,
    currentPage: normalizeCurrentPage(toPageIndex, nextPages.length),
  };

  await saveBinderData(updated);
  return updated;
}

export async function deleteCardsFromBinderPage(
  pageIndex: number,
  slotIndexes: number[]
): Promise<BinderData> {
  return updateBinderPage(pageIndex, (page) => {
    const nextPage = [...page];

    slotIndexes.forEach((slotIndex) => {
      if (slotIndex >= 0 && slotIndex < BINDER_PAGE_SIZE) {
        nextPage[slotIndex] = null;
      }
    });

    return nextPage;
  });
}