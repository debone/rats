import { GAME_ID } from '@/consts';
import { DEFAULT_STORAGE } from '@/data/storage';

export type StorageData = typeof DEFAULT_STORAGE;

/**
 * The ID of the local storage where the data is stored.
 */
const STORAGE_ID = `${GAME_ID}_storage`;

export const storage = {
  /**
   * Initializes the storage data to the default if not already set.
   */
  readyStorage() {
    if (!localStorage.getItem(STORAGE_ID)) this.setStorage(DEFAULT_STORAGE);
  },
  /**
   * Retrieves the storage data.
   * @returns The storage data if it exists, undefined otherwise.
   */
  getStorage(): StorageData | undefined {
    const data = localStorage.getItem(STORAGE_ID);

    return data ? JSON.parse(data) : undefined;
  },
  /**
   * Retrieves a specific value from the storage data.
   * @param key - The key of the value to retrieve.
   * @returns The retrieved value.
   */
  getStorageItem<T extends keyof StorageData>(key: T): StorageData[T] | undefined {
    const data = this.getStorage();

    return data ? data[key] : undefined;
  },
  /**
   * Sets a specific value in the storage data.
   * @param key - The key of the value to set.
   * @param value - The value to set.
   * @returns The set value.
   */
  setStorageItem<T extends keyof StorageData>(key: T, value: StorageData[T]): StorageData[T] {
    const data = this.getStorage()!;

    // Check if storage and intended item exists
    if (data && key in data) {
      data[key] = value;

      // Replace local storage
      this.setStorage(data);
    }

    return data[key];
  },
  /**
   * Removes a specific value from the storage data.
   * @param key - The key of the value to remove.
   * @returns The removed value.
   */
  removeStorageItem<T extends keyof StorageData>(key: T): StorageData[T] | undefined {
    const data = this.getStorage()!;

    if (data && key in data) {
      const value = data[key];
      delete data[key];
      this.setStorage(data);
      return value;
    }

    return undefined;
  },
  /**
   * Sets the entire storage data.
   * @param data - The data to set.
   * @returns The set data.
   */
  setStorage(data: StorageData) {
    return localStorage.setItem(STORAGE_ID, JSON.stringify(data, undefined, 2));
  },

  /**
   * Retrieves a specific value from the storage data.
   * @param key - The key of the value to retrieve.
   * @returns The retrieved value.
   */
  get<T extends keyof StorageData>(key: T): StorageData[T] | undefined {
    return this.getStorageItem(key);
  },
  /**
   * Retrieves a specific value from the storage data.
   * @param key - The key of the value to retrieve.
   * @param defaultValue - The default value to return if the value is not found.
   * @returns The retrieved value.
   */
  getOrDefault<T extends keyof StorageData>(key: T, defaultValue: StorageData[T]): StorageData[T] {
    return this.getStorageItem(key) ?? defaultValue;
  },
  /**
   * Sets a specific value in the storage data.
   * @param key - The key of the value to set.
   * @param value - The value to set.
   * @returns The set value.
   */
  set<T extends keyof StorageData>(key: T, value: StorageData[T]) {
    this.setStorageItem(key, value);
  },
  /**
   * Removes a specific value from the storage data.
   * @param key - The key of the value to remove.
   * @returns The removed value.
   */
  remove<T extends keyof StorageData>(key: T) {
    return this.removeStorageItem(key);
  },
};
