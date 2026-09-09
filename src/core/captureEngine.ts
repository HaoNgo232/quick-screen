import type { PageDimensions, CaptureItem, CaptureProgress } from '../types/capture'
import { AutoSink, type ArtifactSink } from './sink'
import { historyStore, HistoryStore } from './historyStore'
import { copyDual, copyText } from './clipboard'

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

async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    if (pong && pong.status === 'PONG') return true
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content_scripts/content-0.js']
      })
      await new Promise((r) => setTimeout(r, 150))
      return true
    } catch (err) {
      console.warn('Could not inject content script:', err)
      return false
    }
  }
  return true
}

export interface CaptureTabOptions {
  onProgress?: (p: CaptureProgress) => void
  skipClipboard?: boolean
  skipToast?: boolean
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

    await ensureContentScript(tab.id)

    options?.onProgress?.({
      currentSlice: 0,
      totalSlices: 1,
      status: 'preparing',
      message: 'Đang chuẩn bị trang...'
    })

    // 1. Measure page dimensions
    const dims: PageDimensions = await chrome.tabs.sendMessage(tab.id, {
      type: 'PREPARE_CAPTURE'
    })

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
    for (let i = 0; i < totalSlices; i++) {
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

      const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
      const img = await loadImage(dataUrl)

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

    // 5. Restore page DOM state
    await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_CAPTURE' })

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
    const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.8)

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
      await copyDual(absolutePath, imageBlob)
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

    // 11. Record into history
    await this.history.add(captureItem)

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
  async captureActive(onProgress?: (p: CaptureProgress) => void): Promise<CaptureItem> {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    const activeTab = tabs[0]
    if (!activeTab || !activeTab.id) {
      throw new Error('Không tìm thấy tab đang kích hoạt')
    }
    return this.captureTab(activeTab, { onProgress })
  }

  /**
   * Captures all open tabs across the current browser window.
   */
  async captureBatch(
    onProgress?: (status: string, current: number, total: number) => void
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
      const targetTab = validTabs[i]
      if (!targetTab.id) continue

      onProgress?.(
        `Đang chụp tab ${i + 1}/${validTabs.length}: ${targetTab.title || 'Tab'}`,
        i + 1,
        validTabs.length
      )

      await chrome.tabs.update(targetTab.id, { active: true })
      await new Promise((r) => setTimeout(r, 350))

      try {
        const item = await this.captureTab(targetTab, {
          skipClipboard: true,
          skipToast: true
        })
        capturedItems.push(item)
      } catch (err) {
        console.error(`Lỗi khi chụp tab ${targetTab.id}:`, err)
      }
    }

    if (initialActiveTabId) {
      await chrome.tabs.update(initialActiveTabId, { active: true })
      await new Promise((r) => setTimeout(r, 200))
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
}

export const captureEngine = new CaptureEngine()
