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
  external: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>`,
  minus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
  plus: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`
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
  const foundItem = items.find((i: CaptureItem) => i.id === id)

  if (!foundItem) {
    root.innerHTML = `
      <div class="qs-viewer-empty">
        <span>Screenshot not found in recent captures</span>
      </div>
    `
    return
  }

  const item: CaptureItem = foundItem

  document.title = `${item.pageTitle} - quick-shot Viewer`

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
        <div class="qs-btn-group qs-zoom-group">
          <button id="viewer-btn-zoom-out" class="qs-btn qs-btn-icon" title="Zoom Out (-)">
            ${ICONS.minus}
          </button>
          <span id="viewer-zoom-indicator" class="qs-zoom-indicator" title="Current zoom level">Fit</span>
          <button id="viewer-btn-zoom-in" class="qs-btn qs-btn-icon" title="Zoom In (+)">
            ${ICONS.plus}
          </button>
          <button id="viewer-btn-fit" class="qs-btn active" title="Fit Width (W)">
            <span>Fit Width</span>
          </button>
          <button id="viewer-btn-100" class="qs-btn" title="Actual Size 100% (0)">
            <span>100%</span>
          </button>
        </div>
        <button id="viewer-btn-open-os" class="qs-btn" title="Open with OS image viewer">
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

  const btnZoomOut = document.getElementById('viewer-btn-zoom-out') as HTMLButtonElement
  const zoomIndicator = document.getElementById('viewer-zoom-indicator') as HTMLSpanElement
  const btnZoomIn = document.getElementById('viewer-btn-zoom-in') as HTMLButtonElement
  const btnFit = document.getElementById('viewer-btn-fit') as HTMLButtonElement
  const btn100 = document.getElementById('viewer-btn-100') as HTMLButtonElement
  const btnOpenOs = document.getElementById('viewer-btn-open-os') as HTMLButtonElement
  const btnCopyPath = document.getElementById('viewer-btn-copy-path') as HTMLButtonElement
  const btnClose = document.getElementById('viewer-btn-close') as HTMLButtonElement
  const loadingEl = document.getElementById('viewer-loading') as HTMLDivElement
  const imgWrap = document.getElementById('viewer-img-wrap') as HTMLDivElement
  const imgEl = document.getElementById('viewer-img') as HTMLImageElement

  let isFitWidth = true
  let currentScale = 1.0

  function getBaseScale(): number {
    if (!isFitWidth) return currentScale
    const naturalWidth = imgEl.naturalWidth || item.width || 1
    const renderedWidth = imgEl.clientWidth || naturalWidth
    return Math.round((renderedWidth / naturalWidth) * 10) / 10
  }

  function applyZoom() {
    if (isFitWidth) {
      imgWrap.classList.add('fit-width')
      imgWrap.classList.remove('custom-scale')
      imgWrap.style.width = '100%'
      imgWrap.style.maxWidth = '100%'
      imgEl.style.width = '100%'
      imgEl.style.maxWidth = '100%'
      imgEl.style.height = 'auto'

      zoomIndicator.textContent = 'Fit'
      btnFit.classList.add('active')
      btn100.classList.remove('active')
      btnZoomOut.disabled = false
      btnZoomIn.disabled = false
    } else {
      imgWrap.classList.remove('fit-width')
      imgWrap.classList.add('custom-scale')

      const naturalWidth = imgEl.naturalWidth || item.width || 1200
      const targetWidth = Math.round(naturalWidth * currentScale)

      imgWrap.style.width = `${targetWidth}px`
      imgWrap.style.maxWidth = 'none'
      imgEl.style.width = `${targetWidth}px`
      imgEl.style.maxWidth = 'none'
      imgEl.style.height = 'auto'

      zoomIndicator.textContent = `${Math.round(currentScale * 100)}%`
      btnFit.classList.remove('active')

      if (Math.abs(currentScale - 1.0) < 0.01) {
        btn100.classList.add('active')
      } else {
        btn100.classList.remove('active')
      }

      btnZoomOut.disabled = currentScale <= 0.25 + 0.001
      btnZoomIn.disabled = currentScale >= 3.0 - 0.001
    }
  }

  function zoomIn() {
    const base = isFitWidth ? getBaseScale() : currentScale
    let next = Math.round((base + 0.2) * 10) / 10
    if (base <= 0.25) {
      next = 0.4
    }
    currentScale = Math.min(3.0, Math.max(0.25, next))
    isFitWidth = false
    applyZoom()
  }

  function zoomOut() {
    const base = isFitWidth ? getBaseScale() : currentScale
    let next = Math.round((base - 0.2) * 10) / 10
    if (next < 0.25) {
      next = 0.25
    }
    currentScale = Math.max(0.25, Math.min(3.0, next))
    isFitWidth = false
    applyZoom()
  }

  function setFitWidth() {
    isFitWidth = true
    applyZoom()
  }

  function setActualSize() {
    isFitWidth = false
    currentScale = 1.0
    applyZoom()
  }

  btnZoomOut.addEventListener('click', zoomOut)
  btnZoomIn.addEventListener('click', zoomIn)
  btnFit.addEventListener('click', setFitWidth)
  btn100.addEventListener('click', setActualSize)

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
      return
    }

    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    if (e.ctrlKey || e.metaKey || e.altKey) {
      return
    }

    if (e.key === '+' || e.key === '=' || e.key === 'Add') {
      e.preventDefault()
      zoomIn()
    } else if (e.key === '-' || e.key === '_' || e.key === 'Subtract') {
      e.preventDefault()
      zoomOut()
    } else if (e.key === '0') {
      e.preventDefault()
      setActualSize()
    } else if (e.key === 'w' || e.key === 'W') {
      e.preventDefault()
      setFitWidth()
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
    applyZoom()
  }

  imgEl.onerror = () => {
    loadingEl.innerHTML = '<span>Failed to render image</span>'
  }
}

initViewerApp()
