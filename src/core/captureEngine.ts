import type { PageDimensions, CaptureItem, CaptureProgress } from '../types/capture'
import { AutoSink, type ArtifactSink } from './sink'
import { historyStore, HistoryStore } from './historyStore'
import { copyDual, copyText, copyImageOnly } from './clipboard'
import { putImageBlob, getImageBlob } from './imageStore'

const MAX_CANVAS_HEIGHT = 16000

function sanitizeFilename(title: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

  const cleanTitle = (title || 'webpage')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 35)

  return `${timestamp}_${cleanTitle || 'page'}.png`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
    img.src = src
  })
}

async function waitForTabReady(tabId: number, timeoutMs = 7000): Promise<chrome.tabs.Tab | null> {
  try {
    const tab = await chrome.tabs.get(tabId)
    if (!tab.discarded && tab.status === 'complete') {
      return tab
    }

    return new Promise((resolve) => {
      const timer = setTimeout(async () => {
        chrome.tabs.onUpdated.removeListener(listener)
        const current = await chrome.tabs.get(tabId).catch(() => null)
        resolve(current)
      }, timeoutMs)

      function listener(updatedTabId: number, changeInfo: { status?: string }, updatedTab: chrome.tabs.Tab) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timer)
          chrome.tabs.onUpdated.removeListener(listener)
          resolve(updatedTab)
        }
      }

      chrome.tabs.onUpdated.addListener(listener)
    })
  } catch {
    return null
  }
}

async function ensureContentScript(tabId: number, retries = 3): Promise<boolean> {
  for (let i = 0; i < retries; i++) {
    try {
      const pong = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
      if (pong && pong.status === 'PONG') return true
    } catch {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content_scripts/content-0.js']
        })
        await new Promise((r) => setTimeout(r, 200))
      } catch {
        await new Promise((r) => setTimeout(r, 250))
      }
    }
  }
  return false
}

let lastCaptureTime = 0

async function safeCaptureVisibleTab(windowId?: number, retries = 5, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) {
    throw new DOMException('Quá trình chụp đã bị dừng', 'AbortError')
  }
  const minInterval = 550 // Minimum 550ms interval between calls to safely conform to MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND (2/sec)
  const elapsed = Date.now() - lastCaptureTime
  if (elapsed < minInterval) {
    await new Promise((r) => setTimeout(r, minInterval - elapsed))
    if (signal?.aborted) {
      throw new DOMException('Quá trình chụp đã bị dừng', 'AbortError')
    }
  }

  for (let attempt = 0; attempt < retries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Quá trình chụp đã bị dừng', 'AbortError')
    }
    try {
      lastCaptureTime = Date.now()
      const targetWindowId = windowId || chrome.windows.WINDOW_ID_CURRENT
      return await chrome.tabs.captureVisibleTab(targetWindowId, { format: 'png' })
    } catch (err: any) {
      if (signal?.aborted) {
        throw new DOMException('Quá trình chụp đã bị dừng', 'AbortError')
      }
      const msg = String(err?.message || '')
      if ((msg.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') || msg.includes('quota')) && attempt < retries - 1) {
        // Backoff wait if Chromium's token bucket is exhausted
        await new Promise((r) => setTimeout(r, 700 + attempt * 400))
        continue
      }
      throw err
    }
  }
  throw new Error('Đã vượt quá giới hạn chụp của trình duyệt (quota exceeded), vui lòng thử lại sau giây lát')
}

export interface CaptureTabOptions {
  onProgress?: (p: CaptureProgress) => void
  skipClipboard?: boolean
  skipToast?: boolean
  signal?: AbortSignal
}

/**
 * Module: CaptureEngine
 * Deep module encapsulating browser scrolling, canvas stitching, adaptive scaling,
 * artifact dispatch, dual clipboard writing, and history recording.
 */
export class CaptureEngine {
  constructor(
    private sink: ArtifactSink = new AutoSink(),
    private history: HistoryStore = historyStore
  ) {}

  /**
   * Captures the full page of a specific tab.
   */
  async captureTab(
    tab: chrome.tabs.Tab,
    options?: CaptureTabOptions
  ): Promise<CaptureItem> {
    if (!tab.id) throw new Error('Tab has no valid ID')

    const hasScript = await ensureContentScript(tab.id)

    options?.onProgress?.({
      currentSlice: 0,
      totalSlices: 1,
      status: 'preparing',
      message: 'Đang chuẩn bị trang...'
    })

    let dims: PageDimensions | null = null
    if (hasScript) {
      try {
        dims = await chrome.tabs.sendMessage(tab.id, { type: 'PREPARE_CAPTURE' })
      } catch {}
    }

    if (options?.signal?.aborted) {
      throw new DOMException('Quá trình chụp đã bị dừng bởi người dùng', 'AbortError')
    }

    if (!dims) {
      // Fallback to visible viewport capture for restricted or unscriptable pages
      const dataUrl = await safeCaptureVisibleTab(tab.windowId, 5, options?.signal)
      const img = await loadImage(dataUrl)
      const canvasWidth = img.width
      const canvasHeight = img.height
      const masterCanvas = document.createElement('canvas')
      masterCanvas.width = canvasWidth
      masterCanvas.height = canvasHeight
      const ctx = masterCanvas.getContext('2d')
      if (!ctx) throw new Error('Could not create 2D canvas context')
      ctx.drawImage(img, 0, 0)

      const thumbCanvas = document.createElement('canvas')
      const thumbScale = Math.min(1, 200 / canvasWidth)
      thumbCanvas.width = Math.round(canvasWidth * thumbScale)
      thumbCanvas.height = Math.round(canvasHeight * thumbScale)
      const thumbCtx = thumbCanvas.getContext('2d')
      if (thumbCtx) {
        thumbCtx.drawImage(masterCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
      }
      const thumbnailDataUrl = thumbCanvas.toDataURL('image/png')
      const imageBlob = await new Promise<Blob>((resolve, reject) => {
        masterCanvas.toBlob((blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        }, 'image/png')
      })

      const pageTitle = tab.title || 'webpage'
      const url = tab.url || ''
      const filename = sanitizeFilename(pageTitle)
      const shouldCopy = !options?.skipClipboard
      const absolutePath = await this.sink.save(filename, dataUrl, shouldCopy)

      if (shouldCopy) {
        const ok = await copyDual(absolutePath, imageBlob)
        if (!ok && this.sink.copyClipboard) {
          await this.sink.copyClipboard(absolutePath)
        }
      }

      const captureItem: CaptureItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        filename,
        absolutePath,
        pageTitle,
        url,
        timestamp: Date.now(),
        thumbnailDataUrl,
        width: canvasWidth,
        height: canvasHeight
      }

      await this.history.add(captureItem)
      await putImageBlob(captureItem.id, imageBlob)
      return captureItem
    }

    const { totalHeight, viewportHeight, viewportWidth, devicePixelRatio, pageTitle, url } = dims

    // 2. Setup master canvas with adaptive scaling
    const rawCanvasHeight = Math.round(totalHeight * devicePixelRatio)
    const rawCanvasWidth = Math.round(viewportWidth * devicePixelRatio)
    const scale = rawCanvasHeight > MAX_CANVAS_HEIGHT ? MAX_CANVAS_HEIGHT / rawCanvasHeight : 1
    const canvasWidth = Math.round(rawCanvasWidth * scale)
    const canvasHeight = Math.round(rawCanvasHeight * scale)

    const masterCanvas = document.createElement('canvas')
    masterCanvas.width = canvasWidth
    masterCanvas.height = canvasHeight
    const ctx = masterCanvas.getContext('2d')
    if (!ctx) throw new Error('Could not create 2D canvas context')

    // 3. Plan slice coordinates
    const slices: { y: number; isLast: boolean }[] = []
    let currentY = 0

    while (currentY < totalHeight) {
      if (currentY + viewportHeight >= totalHeight) {
        slices.push({
          y: Math.max(0, totalHeight - viewportHeight),
          isLast: true
        })
        break
      } else {
        slices.push({ y: currentY, isLast: false })
        currentY += viewportHeight
      }
    }

    const totalSlices = slices.length
    let drawnHeight = 0

    // 4. Scroll, capture and stitch
    try {
      for (let i = 0; i < totalSlices; i++) {
        if (options?.signal?.aborted) {
          throw new DOMException('Quá trình chụp đã bị dừng bởi người dùng', 'AbortError')
        }
        const slice = slices[i]
        options?.onProgress?.({
          currentSlice: i + 1,
          totalSlices,
          status: 'scrolling',
          message: `Đang cuộn và chụp khung ${i + 1}/${totalSlices}...`
        })

        await chrome.tabs.sendMessage(tab.id, {
          type: 'SCROLL_TO',
          x: 0,
          y: slice.y,
          hideFixed: i > 0
        })

        const dataUrl = await safeCaptureVisibleTab(tab.windowId, 5, options?.signal)
        const img = await loadImage(dataUrl)

        if (options?.signal?.aborted) {
          throw new DOMException('Quá trình chụp đã bị dừng bởi người dùng', 'AbortError')
        }

        options?.onProgress?.({
          currentSlice: i + 1,
          totalSlices,
          status: 'stitching',
          message: `Đang ghép mảnh ${i + 1}/${totalSlices}...`
        })

        if (!slice.isLast) {
          const sliceDestY = Math.round(slice.y * devicePixelRatio * scale)
          const sliceDestH = Math.round(viewportHeight * devicePixelRatio * scale)
          ctx.drawImage(img, 0, 0, img.width, img.height, 0, sliceDestY, canvasWidth, sliceDestH)
          drawnHeight = slice.y + viewportHeight
        } else {
          const remainingUnscaled = totalHeight - drawnHeight
          if (remainingUnscaled > 0) {
            const sourceRemnantH = Math.round(remainingUnscaled * (img.height / viewportHeight))
            const sourceStartY = img.height - sourceRemnantH
            const destY = Math.round(drawnHeight * devicePixelRatio * scale)
            const destH = canvasHeight - destY

            ctx.drawImage(img, 0, sourceStartY, img.width, sourceRemnantH, 0, destY, canvasWidth, destH)
          }
        }
      }
    } finally {
      // 5. Restore page DOM state safely
      if (hasScript) {
        await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_CAPTURE' }).catch(() => {})
      }
    }

    if (options?.signal?.aborted) {
      throw new DOMException('Quá trình chụp đã bị dừng bởi người dùng', 'AbortError')
    }

    options?.onProgress?.({
      currentSlice: totalSlices,
      totalSlices,
      status: 'saving',
      message: 'Đang lưu ảnh và copy đường dẫn...'
    })

    // 6. Generate thumbnail for history UI
    const thumbCanvas = document.createElement('canvas')
    const thumbScale = Math.min(1, 200 / canvasWidth)
    thumbCanvas.width = Math.round(canvasWidth * thumbScale)
    thumbCanvas.height = Math.round(canvasHeight * thumbScale)
    const thumbCtx = thumbCanvas.getContext('2d')
    if (thumbCtx) {
      thumbCtx.drawImage(masterCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
    }
    const thumbnailDataUrl = thumbCanvas.toDataURL('image/png')

    // 7. Extract PNG blob & data URL
    const fullDataUrl = masterCanvas.toDataURL('image/png')
    const imageBlob = await new Promise<Blob>((resolve, reject) => {
      masterCanvas.toBlob((blob) => {
        if (blob) resolve(blob)
        else reject(new Error('Canvas toBlob failed'))
      }, 'image/png')
    })

    // 8. Persist through ArtifactSink seam
    const filename = sanitizeFilename(pageTitle)
    const shouldCopy = !options?.skipClipboard
    const absolutePath = await this.sink.save(filename, fullDataUrl, shouldCopy)

    // 9. Write dual clipboard (only if not in batch mode)
    if (shouldCopy) {
      const ok = await copyDual(absolutePath, imageBlob)
      if (!ok && this.sink.copyClipboard) {
        await this.sink.copyClipboard(absolutePath)
      }
    }

    // 10. Trigger in-page toast feedback (only if not in batch mode)
    if (!options?.skipToast) {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_TOAST',
          message: 'Đã chụp & copy path vào clipboard!',
          filePath: absolutePath
        })
      } catch {}
    }

    const captureItem: CaptureItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      filename,
      absolutePath,
      pageTitle,
      url,
      timestamp: Date.now(),
      thumbnailDataUrl,
      width: canvasWidth,
      height: canvasHeight
    }

    // 11. Record into history and cache full resolution blob in IndexedDB
    await this.history.add(captureItem)
    await putImageBlob(captureItem.id, imageBlob)

    options?.onProgress?.({
      currentSlice: totalSlices,
      totalSlices,
      status: 'done',
      message: 'Hoàn tất!'
    })

    return captureItem
  }

  /**
   * Captures the active tab in current window.
   */
  async captureActive(
    onProgress?: (p: CaptureProgress) => void,
    signal?: AbortSignal
  ): Promise<CaptureItem> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]
    if (!activeTab || !activeTab.id) {
      throw new Error('Không tìm thấy tab đang kích hoạt')
    }
    return this.captureTab(activeTab, { onProgress, signal })
  }

  /**
   * Captures all open tabs across the current browser window.
   */
  async captureBatch(
    onProgress?: (status: string, current: number, total: number) => void,
    signal?: AbortSignal
  ): Promise<{ items: CaptureItem[]; combinedPaths: string }> {
    const tabs = await chrome.tabs.query({ currentWindow: true })
    const validTabs = tabs.filter(
      (t) =>
        t.id &&
        t.url &&
        !t.url.startsWith('chrome://') &&
        !t.url.startsWith('edge://') &&
        !t.url.startsWith('about:') &&
        !t.url.startsWith('chrome-extension://')
    )

    if (validTabs.length === 0) {
      throw new Error('Không có tab web hợp lệ nào để chụp')
    }

    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const initialActiveTabId = activeTabs[0]?.id
    const capturedItems: CaptureItem[] = []

    for (let i = 0; i < validTabs.length; i++) {
      if (signal?.aborted) break
      const targetTab = validTabs[i]
      if (!targetTab.id) continue

      onProgress?.(
        `Đang chụp tab ${i + 1}/${validTabs.length}: ${targetTab.title || 'Tab'}`,
        i + 1,
        validTabs.length
      )

      try {
        await chrome.tabs.update(targetTab.id, { active: true })
        if (signal?.aborted) break
        const readyTab = await waitForTabReady(targetTab.id)
        if (signal?.aborted) break
        await new Promise((r) => setTimeout(r, 450))
        if (signal?.aborted) break

        const item = await this.captureTab(readyTab || targetTab, {
          skipClipboard: true,
          skipToast: true,
          signal
        })
        capturedItems.push(item)
      } catch (err: any) {
        if (err?.name === 'AbortError' || signal?.aborted) {
          break
        }
        console.error(`Lỗi khi chụp tab ${targetTab.id}:`, err)
      }
    }

    if (initialActiveTabId) {
      try {
        await chrome.tabs.update(initialActiveTabId, { active: true })
        await new Promise((r) => setTimeout(r, 200))
      } catch {}
    }

    if (signal?.aborted && capturedItems.length === 0) {
      throw new DOMException('Quá trình chụp batch đã bị dừng bởi người dùng', 'AbortError')
    }

    const combinedPaths = capturedItems.map((i) => i.absolutePath).join('\n')

    // 1. Copy via native host (X11 / Wayland OS level)
    if (this.sink.copyClipboard) {
      await this.sink.copyClipboard(combinedPaths)
    }
    // 2. Also copy via browser clipboard
    await copyText(combinedPaths)

    if (initialActiveTabId) {
      try {
        await chrome.tabs.sendMessage(initialActiveTabId, {
          type: 'SHOW_TOAST',
          message: `Đã chụp ${capturedItems.length} tabs & copy toàn bộ path!`,
          filePath: `${capturedItems.length} đường dẫn đã nạp vào clipboard`
        })
      } catch {}
    }

    return { items: capturedItems, combinedPaths }
  }

  /**
   * Copies text/path to clipboard.
   * Prioritizes native host (xclip) for OS clipboard reliability, falling back to browser clipboard.
   */
  async copyTextArtifact(text: string): Promise<boolean> {
    if (this.sink.copyClipboard) {
      const ok = await this.sink.copyClipboard(text)
      if (ok) return true
    }
    return copyText(text)
  }

  /**
   * Copies raw image binary of a captured artifact to clipboard.
   * Prioritizes native host for 100% full-resolution PNG fidelity on Linux.
   */
  async copyImageArtifact(filepath: string, fallbackDataUrl?: string): Promise<boolean> {
    if (this.sink.copyImage) {
      const ok = await this.sink.copyImage(filepath)
      if (ok) return true
    }

    if (fallbackDataUrl) {
      try {
        const res = await fetch(fallbackDataUrl)
        const blob = await res.blob()
        const pngBlob = blob.type === 'image/png' ? blob : new Blob([await blob.arrayBuffer()], { type: 'image/png' })
        return await copyImageOnly(pngBlob)
      } catch {
        return false
      }
    }
    return false
  }

  /**
   * Opens the captured image with the OS default image viewer via native host.
   */
  async openArtifact(filepath: string): Promise<boolean> {
    if (this.sink.openFile) {
      return await this.sink.openFile(filepath)
    }
    return false
  }

  /**
   * Reads the full-resolution captured PNG image dataUrl via native host.
   */
  async readArtifactImage(filepath: string): Promise<string | null> {
    if (this.sink.readFile) {
      return await this.sink.readFile(filepath)
    }
    return null
  }

  /**
   * Reads the full-resolution captured PNG image as a Blob via native host chunking.
   * Safely handles arbitrarily large images (e.g. 25MB) avoiding the 1MB Native Messaging limit.
   */
  async readArtifactBlob(filepath: string): Promise<Blob | null> {
    if (!this.sink.readFileChunk) return null

    let offset = 0
    const chunks: BlobPart[] = []
    const chunkSize = 512 * 1024

    while (true) {
      const res = await this.sink.readFileChunk(filepath, offset, chunkSize)
      if (!res) return null

      const binary = atob(res.data)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i)
      }
      chunks.push(bytes)

      if (res.eof) break
      offset += bytes.length
    }

    return new Blob(chunks, { type: 'image/png' })
  }
}

export const captureEngine = new CaptureEngine()
