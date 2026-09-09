import type { PageDimensions, CaptureItem, CaptureProgress } from '../types/capture'

const STORAGE_KEY = 'qs_recent_captures'
const MAX_CANVAS_HEIGHT = 16000

export function sanitizeFilename(title: string): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

  const cleanTitle = (title || 'webpage')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove Vietnamese accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 35)

  return `${timestamp}_${cleanTitle || 'page'}.png`
}

export async function ensureContentScript(tabId: number): Promise<boolean> {
  try {
    const pong = await chrome.tabs.sendMessage(tabId, { type: 'PING' })
    if (pong && pong.status === 'PONG') return true
  } catch (_e) {
    // Inject if not available
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

export async function copyDualClipboard(absolutePath: string, imageBlob: Blob): Promise<boolean> {
  try {
    const clipboardItem = new ClipboardItem({
      'text/plain': new Blob([absolutePath], { type: 'text/plain' }),
      'image/png': imageBlob
    })
    await navigator.clipboard.write([clipboardItem])
    return true
  } catch (err) {
    console.warn('Dual clipboard write failed, attempting plain text fallback:', err)
    try {
      await navigator.clipboard.writeText(absolutePath)
      return true
    } catch (fallbackErr) {
      console.error('Clipboard copy failed:', fallbackErr)
      return false
    }
  }
}

export async function copyPathOnly(path: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(path)
    return true
  } catch (err) {
    console.error('Failed to copy path:', err)
    return false
  }
}

export async function getRecentCaptures(): Promise<CaptureItem[]> {
  const data = await chrome.storage.local.get(STORAGE_KEY)
  return (data[STORAGE_KEY] as CaptureItem[]) || []
}

export async function saveRecentCapture(item: CaptureItem): Promise<void> {
  const current = await getRecentCaptures()
  const updated = [item, ...current.filter((i) => i.id !== item.id)].slice(0, 30)
  await chrome.storage.local.set({ [STORAGE_KEY]: updated })
}

export async function clearRecentCaptures(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY)
}

export async function deleteCapture(id: string): Promise<void> {
  const current = await getRecentCaptures()
  const updated = current.filter((item) => item.id !== id)
  await chrome.storage.local.set({ [STORAGE_KEY]: updated })
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

export async function saveViaNativeHost(filename: string, dataUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendNativeMessage(
        'com.quickscreen.host',
        { action: 'save', filename, base64Data: dataUrl },
        (response) => {
          if (chrome.runtime.lastError || !response || response.status !== 'ok') {
            console.warn('Native host not available, falling back to download API:', chrome.runtime.lastError?.message || response?.error)
            resolve(null)
          } else {
            resolve(response.absolutePath)
          }
        }
      )
    } catch (err) {
      console.warn('sendNativeMessage error:', err)
      resolve(null)
    }
  })
}

function downloadFile(dataUrl: string, filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: dataUrl,
        filename: `quick-screen/${filename}`,
        saveAs: false,
        conflictAction: 'uniquify'
      },
      (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          return reject(new Error(chrome.runtime.lastError?.message || 'Download failed'))
        }

        const pollInterval = setInterval(() => {
          chrome.downloads.search({ id: downloadId }, (items) => {
            if (!items || items.length === 0) return
            const item = items[0]
            if (item.state === 'complete') {
              clearInterval(pollInterval)
              resolve(item.filename) // Absolute local filesystem path!
            } else if (item.state === 'interrupted') {
              clearInterval(pollInterval)
              reject(new Error(`Download interrupted: ${item.error}`))
            }
          })
        }, 100)

        setTimeout(() => {
          clearInterval(pollInterval)
          reject(new Error('Download timeout after 20s'))
        }, 20000)
      }
    )
  })
}

export async function captureFullPage(
  tab: chrome.tabs.Tab,
  onProgress?: (progress: CaptureProgress) => void
): Promise<CaptureItem> {
  if (!tab.id) throw new Error('Tab has no valid ID')

  await ensureContentScript(tab.id)

  onProgress?.({
    currentSlice: 0,
    totalSlices: 1,
    status: 'preparing',
    message: 'Đang chuẩn bị trang...'
  })

  // 1. Get dimensions
  const dims: PageDimensions = await chrome.tabs.sendMessage(tab.id, {
    type: 'PREPARE_CAPTURE'
  })

  const { totalHeight, viewportHeight, viewportWidth, devicePixelRatio, pageTitle, url } = dims

  // 2. Setup master canvas with adaptive scale
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

  // Calculate slice coordinates
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

  // 3. Scroll and capture each slice
  for (let i = 0; i < totalSlices; i++) {
    const slice = slices[i]
    onProgress?.({
      currentSlice: i + 1,
      totalSlices,
      status: 'scrolling',
      message: `Đang cuộn và chụp khung ${i + 1}/${totalSlices}...`
    })

    // Scroll to position
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SCROLL_TO',
      x: 0,
      y: slice.y,
      hideFixed: i > 0
    })

    // Capture visible area
    const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })
    const img = await loadImage(dataUrl)

    onProgress?.({
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
      // For the last overlapping slice, only draw the bottom remnant
      const remainingUnscaled = totalHeight - drawnHeight
      if (remainingUnscaled > 0) {
        const sourceRemnantH = Math.round(remainingUnscaled * (img.height / viewportHeight))
        const sourceStartY = img.height - sourceRemnantH
        const destY = Math.round(drawnHeight * devicePixelRatio * scale)
        const destH = canvasHeight - destY

        ctx.drawImage(
          img,
          0,
          sourceStartY,
          img.width,
          sourceRemnantH,
          0,
          destY,
          canvasWidth,
          destH
        )
      }
    }
  }

  // 4. Restore page state
  await chrome.tabs.sendMessage(tab.id, { type: 'RESTORE_CAPTURE' })

  onProgress?.({
    currentSlice: totalSlices,
    totalSlices,
    status: 'saving',
    message: 'Đang lưu ảnh và copy đường dẫn...'
  })

  // 5. Generate thumbnail (max width 200px)
  const thumbCanvas = document.createElement('canvas')
  const thumbScale = Math.min(1, 200 / canvasWidth)
  thumbCanvas.width = Math.round(canvasWidth * thumbScale)
  thumbCanvas.height = Math.round(canvasHeight * thumbScale)
  const thumbCtx = thumbCanvas.getContext('2d')
  if (thumbCtx) {
    thumbCtx.drawImage(masterCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height)
  }
  const thumbnailDataUrl = thumbCanvas.toDataURL('image/jpeg', 0.8)

  // 6. Convert master canvas to Blob & DataURL
  const fullDataUrl = masterCanvas.toDataURL('image/png')
  const imageBlob = await new Promise<Blob>((resolve, reject) => {
    masterCanvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })

  // 7. Save file and get absolute path
  const filename = sanitizeFilename(pageTitle)
  let absolutePath = await saveViaNativeHost(filename, fullDataUrl)

  if (!absolutePath) {
    absolutePath = await downloadFile(fullDataUrl, filename)
  }

  // 8. Copy to dual clipboard
  await copyDualClipboard(absolutePath, imageBlob)

  // 9. Trigger toast on page
  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SHOW_TOAST',
      message: '✓ Đã chụp & copy path vào clipboard!',
      filePath: absolutePath
    })
  } catch (_e) {
    // Ignore if tab closed or detached
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

  // 10. Persist in storage
  await saveRecentCapture(captureItem)

  onProgress?.({
    currentSlice: totalSlices,
    totalSlices,
    status: 'done',
    message: 'Hoàn tất!'
  })

  return captureItem
}

export async function captureAllTabs(
  onProgress?: (progressText: string, current: number, total: number) => void
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

  // Remember active tab to switch back
  const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true })
  const initialActiveTabId = activeTabs[0]?.id

  const capturedItems: CaptureItem[] = []

  for (let i = 0; i < validTabs.length; i++) {
    const targetTab = validTabs[i]
    if (!targetTab.id) continue

    onProgress?.(`Đang chụp tab ${i + 1}/${validTabs.length}: ${targetTab.title || 'Tab'}`, i + 1, validTabs.length)

    // Activate tab
    await chrome.tabs.update(targetTab.id, { active: true })
    // Delay for paint
    await new Promise((r) => setTimeout(r, 350))

    try {
      const item = await captureFullPage(targetTab)
      capturedItems.push(item)
    } catch (err) {
      console.error(`Lỗi khi chụp tab ${targetTab.id}:`, err)
    }
  }

  // Switch back to original active tab
  if (initialActiveTabId) {
    await chrome.tabs.update(initialActiveTabId, { active: true })
  }

  const combinedPaths = capturedItems.map((i) => i.absolutePath).join('\n')

  // Copy list of paths to clipboard
  await copyPathOnly(combinedPaths)

  // Show Toast on current tab
  if (initialActiveTabId) {
    try {
      await chrome.tabs.sendMessage(initialActiveTabId, {
        type: 'SHOW_TOAST',
        message: `✓ Đã chụp ${capturedItems.length} tabs & copy toàn bộ path!`,
        filePath: `${capturedItems.length} đường dẫn đã nạp vào clipboard`
      })
    } catch (_e) {}
  }

  return { items: capturedItems, combinedPaths }
}
