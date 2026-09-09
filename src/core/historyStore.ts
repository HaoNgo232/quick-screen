import type { CaptureItem } from '../types/capture'

const STORAGE_KEY = 'qs_recent_captures'
const MAX_HISTORY_ITEMS = 30

/**
 * Module: HistoryStore
 * Deep module encapsulating capture persistence, deduplication, and FIFO capping.
 */
export class HistoryStore {
  async list(): Promise<CaptureItem[]> {
    const data = await chrome.storage.local.get(STORAGE_KEY)
    return (data[STORAGE_KEY] as CaptureItem[]) || []
  }

  async add(item: CaptureItem): Promise<void> {
    const current = await this.list()
    const updated = [item, ...current.filter((i) => i.id !== item.id)].slice(0, MAX_HISTORY_ITEMS)
    await chrome.storage.local.set({ [STORAGE_KEY]: updated })
  }

  async remove(id: string): Promise<void> {
    const current = await this.list()
    const updated = current.filter((i) => i.id !== id)
    await chrome.storage.local.set({ [STORAGE_KEY]: updated })
  }

  async clear(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY)
  }
}

export const historyStore = new HistoryStore()
