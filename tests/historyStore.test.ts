import { describe, it, expect, beforeEach } from 'bun:test'
import { HistoryStore } from '../src/core/historyStore'
import type { CaptureItem } from '../src/types/capture'

// Mock chrome.storage.local
const mockStorage: Record<string, any> = {}
;(globalThis as any).chrome = {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: mockStorage[key] || [] }),
      set: async (items: Record<string, any>) => {
        Object.assign(mockStorage, items)
      },
      remove: async (key: string) => {
        delete mockStorage[key]
      }
    }
  }
}

describe('HistoryStore Deep Module', () => {
  let store: HistoryStore

  beforeEach(() => {
    store = new HistoryStore()
    delete mockStorage['qs_recent_captures']
  })

  it('adds and lists captures', async () => {
    const item: CaptureItem = {
      id: '1',
      filename: 'a.png',
      absolutePath: '/tmp/a.png',
      pageTitle: 'Test Page',
      url: 'https://example.com',
      timestamp: 12345,
      thumbnailDataUrl: 'data:...',
      width: 100,
      height: 200
    }

    await store.add(item)
    const list = await store.list()
    expect(list.length).toBe(1)
    expect(list[0].id).toBe('1')
  })

  it('caps history at 30 items (FIFO)', async () => {
    for (let i = 0; i < 35; i++) {
      await store.add({
        id: `id-${i}`,
        filename: `${i}.png`,
        absolutePath: `/tmp/${i}.png`,
        pageTitle: `Page ${i}`,
        url: 'https://example.com',
        timestamp: i,
        thumbnailDataUrl: 'data:...',
        width: 100,
        height: 200
      })
    }

    const list = await store.list()
    expect(list.length).toBe(30)
    expect(list[0].id).toBe('id-34') // Most recent first
  })

  it('removes item by id and clears all', async () => {
    await store.add({
      id: 'item-1',
      filename: '1.png',
      absolutePath: '/tmp/1.png',
      pageTitle: 'Page 1',
      url: 'https://example.com',
      timestamp: 1,
      thumbnailDataUrl: 'data:...',
      width: 100,
      height: 200
    })

    await store.remove('item-1')
    expect((await store.list()).length).toBe(0)

    await store.add({
      id: 'item-2',
      filename: '2.png',
      absolutePath: '/tmp/2.png',
      pageTitle: 'Page 2',
      url: 'https://example.com',
      timestamp: 2,
      thumbnailDataUrl: 'data:...',
      width: 100,
      height: 200
    })

    await store.clear()
    expect((await store.list()).length).toBe(0)
  })
})
