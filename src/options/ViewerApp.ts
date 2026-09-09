import { historyStore } from '../core/historyStore'
import { captureEngine } from '../core/captureEngine'
import { getImageBlob } from '../core/imageStore'
import type { CaptureItem } from '../types/capture'

const ICONS = {
  viewfinder: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M4 16v3a1 1 0 0 0 1 1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M16 20h3a1 1 0 0 0 1-1v-3"/><circle cx="12" cy="12" r="3"/><line x1="8" y1="12" x2="6" y2="12"/></svg>`,
  copy: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  check: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  zoom: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`,
  external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

function showToast(message: string) {
  const existing = document.querySelector('.qs-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.className = 'qs-toast'
  toast.innerHTML = `${ICONS.check} <span>${message}</span>`
  document.body.appendChild(toast)

  setTimeout(() => {
    toast.remove()
  }, 2200)
}

export async function initViewerApp() {
  const root = document.getElementById('viewer-root')
  if (!root) return

  const params = new URLSearchParams(window.location.search)
  const id = params.get('id')

  if (!id) {
    root.innerHTML = `
      <div class="qs-viewer-empty">
        <span>No screenshot ID specified</span>
      </div>
    `
    return
  }

  const items = await historyStore.list()
  const item = items.find((i: CaptureItem) => i.id === id)

  if (!item) {
    root.innerHTML = `
      <div class="qs-viewer-empty">
        <span>Screenshot not found in recent captures</span>
      </div>
    `
    return
  }

  document.title = `${item.pageTitle} - quick-screen Viewer`

  root.innerHTML = `
    <header class="qs-viewer-header">
      <div class="qs-viewer-brand">
        <div class="qs-viewer-icon">${ICONS.viewfinder}</div>
        <div class="qs-viewer-info">
          <div class="qs-viewer-title-row">
            <h1 class="qs-viewer-title" title="${item.pageTitle}">${item.pageTitle}</h1>
            <span class="qs-viewer-tag">${item.width}&times;${item.height}px</span>
          </div>
          <div class="qs-viewer-meta">
            <span>${formatTimestamp(item.timestamp)}</span>
            <span>&bull;</span>
            <span title="${item.absolutePath}">${item.absolutePath}</span>
          </div>
        </div>
      </div>
      <div class="qs-viewer-actions">
        <button id="viewer-btn-zoom" class="qs-btn" title="Toggle between Fit Width and 100% Actual Size">
          ${ICONS.zoom}
          <span id="viewer-zoom-label">Actual Size (100%)</span>
        </button>
        <button id="viewer-btn-open-os" class="qs-btn" title="Open with OS image viewer (Xviewer/Pix)">
          ${ICONS.external}
          <span>Open in App</span>
        </button>
        <button id="viewer-btn-copy-path" class="qs-btn qs-btn-primary" title="Copy file path to clipboard">
          ${ICONS.copy}
          <span>Copy Path</span>
        </button>
        <button id="viewer-btn-close" class="qs-btn" title="Close viewer tab (Esc)">
          ${ICONS.close}
          <span>Close</span>
        </button>
      </div>
    </header>

    <main class="qs-viewer-canvas">
      <div id="viewer-loading" class="qs-viewer-loading">
        <div class="qs-spinner"></div>
        <span>Loading full resolution screenshot...</span>
      </div>
      <div id="viewer-img-wrap" class="qs-viewer-img-wrap" style="display: none;">
        <img id="viewer-img" class="qs-viewer-img" alt="${item.pageTitle}" />
      </div>
    </main>
  `

  const btnZoom = document.getElementById('viewer-btn-zoom') as HTMLButtonElement
  const zoomLabel = document.getElementById('viewer-zoom-label') as HTMLSpanElement
  const btnOpenOs = document.getElementById('viewer-btn-open-os') as HTMLButtonElement
  const btnCopyPath = document.getElementById('viewer-btn-copy-path') as HTMLButtonElement
  const btnClose = document.getElementById('viewer-btn-close') as HTMLButtonElement
  const loadingEl = document.getElementById('viewer-loading') as HTMLDivElement
  const imgWrap = document.getElementById('viewer-img-wrap') as HTMLDivElement
  const imgEl = document.getElementById('viewer-img') as HTMLImageElement

  let isActualSize = false

  btnZoom.addEventListener('click', () => {
    isActualSize = !isActualSize
    if (isActualSize) {
      imgWrap.classList.add('actual-size')
      zoomLabel.textContent = 'Fit Width'
    } else {
      imgWrap.classList.remove('actual-size')
      zoomLabel.textContent = 'Actual Size (100%)'
    }
  })

  btnOpenOs.addEventListener('click', async () => {
    const ok = await captureEngine.openArtifact(item.absolutePath)
    if (ok) {
      showToast('Opened in system image viewer')
    } else {
      showToast('Could not open file in system')
    }
  })

  btnCopyPath.addEventListener('click', async () => {
    await captureEngine.copyTextArtifact(item.absolutePath)
    showToast('Path copied to clipboard')
  })

  btnClose.addEventListener('click', () => {
    window.close()
  })

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.close()
    }
  })

  // 1. Try to load from IndexedDB cache
  let imageBlob: Blob | null = null
  try {
    imageBlob = await getImageBlob(item.id)
  } catch {}

  // 2. Fallback to native host chunked reader
  if (!imageBlob && item.absolutePath) {
    try {
      imageBlob = await captureEngine.readArtifactBlob(item.absolutePath)
    } catch (err) {
      console.warn('Native host chunk reader failed:', err)
    }
  }

  // 3. Fallback to thumbnail dataUrl as last resort
  if (imageBlob) {
    const objectUrl = URL.createObjectURL(imageBlob)
    imgEl.src = objectUrl
  } else {
    imgEl.src = item.thumbnailDataUrl
  }

  imgEl.onload = () => {
    loadingEl.style.display = 'none'
    imgWrap.style.display = 'block'
  }

  imgEl.onerror = () => {
    loadingEl.innerHTML = '<span>Failed to render image</span>'
  }
}

initViewerApp()
