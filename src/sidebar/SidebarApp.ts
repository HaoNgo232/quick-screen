import { captureEngine } from '../core/captureEngine'
import { historyStore } from '../core/historyStore'
import type { CaptureItem } from '../types/capture'

let isBusy = false

// Crisp vector SVG definitions (Stroke 1.75 - 2, geometric, minimal)
const ICONS = {
  viewfinder: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8V5a1 1 0 0 1 1-1h3"/><path d="M4 16v3a1 1 0 0 0 1 1h3"/><path d="M16 4h3a1 1 0 0 1 1 1v3"/><path d="M16 20h3a1 1 0 0 0 1-1v-3"/><circle cx="12" cy="12" r="3"/><line x1="8" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="16" y2="12"/></svg>`,
  camera: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  layers: `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`,
  copy: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
  image: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  check: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  close: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
  sidebar: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/></svg>`,
  emptyFrame: `<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>`
}

function formatTimestamp(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

function notify(text: string) {
  const toast = document.getElementById('qs-toast')
  if (!toast) return
  toast.innerHTML = `${ICONS.check} <span>${text}</span>`
  toast.classList.add('active')
  setTimeout(() => {
    toast.classList.remove('active')
  }, 2200)
}

export default async function initSidebarApp() {
  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <div class="qs-shell">
      <!-- Header -->
      <header class="qs-header">
        <div class="qs-brand">
          <div class="qs-brand-icon">${ICONS.viewfinder}</div>
          <div class="qs-brand-info">
            <h1 class="qs-brand-title">quick-screen</h1>
            <span class="qs-brand-tagline">AI Screen Capture Bridge</span>
          </div>
        </div>
        <div class="qs-header-controls">
          <button id="btn-dock-sidebar" class="qs-btn-icon" title="Dock to Side Panel" type="button">
            ${ICONS.sidebar}
          </button>
          <div class="qs-status-pill">
            <span class="qs-status-dot"></span>
            <span>READY</span>
          </div>
        </div>
      </header>

      <!-- Action Trigger Deck -->
      <section class="qs-trigger-deck">
        <button id="btn-capture-active" class="qs-btn qs-btn-primary" type="button">
          ${ICONS.camera}
          <span>Capture Active Tab (Full Page)</span>
        </button>

        <button id="btn-capture-batch" class="qs-btn qs-btn-secondary" type="button">
          ${ICONS.layers}
          <span>Capture All Open Tabs (Batch)</span>
        </button>

        <!-- Progress Telemetry -->
        <div id="telemetry-box" class="qs-telemetry-box" style="display: none;">
          <div class="qs-loader"></div>
          <div class="qs-telemetry-info">
            <span id="telemetry-message">Initializing...</span>
            <div class="qs-progress-track">
              <div id="telemetry-bar-fill" class="qs-progress-fill" style="width: 0%;"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- History Controls -->
      <div class="qs-section-bar">
        <div class="qs-section-heading">
          <span>Recent Captures</span>
          <span id="feed-count" class="qs-counter">0</span>
        </div>
        <button id="btn-purge-history" class="qs-link-danger" type="button">
          Clear history
        </button>
      </div>

      <!-- Feed List -->
      <div id="capture-feed" class="qs-feed">
        <div class="qs-empty-feed">
          <div class="qs-empty-icon">${ICONS.emptyFrame}</div>
          <span class="qs-empty-label">No captures recorded</span>
          <span class="qs-empty-hint">Trigger capture above to auto-save and copy path for AI</span>
        </div>
      </div>

      <!-- Toast Feedback -->
      <div id="qs-toast" class="qs-toast-overlay"></div>
    </div>
  `

  const btnCaptureActive = document.getElementById('btn-capture-active') as HTMLButtonElement
  const btnCaptureBatch = document.getElementById('btn-capture-batch') as HTMLButtonElement
  const btnPurge = document.getElementById('btn-purge-history') as HTMLButtonElement
  const telemetryBox = document.getElementById('telemetry-box') as HTMLDivElement
  const telemetryMsg = document.getElementById('telemetry-message') as HTMLSpanElement
  const telemetryBar = document.getElementById('telemetry-bar-fill') as HTMLDivElement
  const feedContainer = document.getElementById('capture-feed') as HTMLDivElement
  const feedCount = document.getElementById('feed-count') as HTMLSpanElement
  const btnDockSidebar = document.getElementById('btn-dock-sidebar') as HTMLButtonElement | null

  if (btnDockSidebar) {
    btnDockSidebar.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
        if (tab?.windowId && chrome.sidePanel?.open) {
          await chrome.sidePanel.open({ windowId: tab.windowId })
          window.close()
        }
      } catch (err) {
        console.warn('Could not open side panel:', err)
      }
    })
  }

  async function renderFeed() {
    const items = await historyStore.list()
    feedCount.textContent = String(items.length)

    if (items.length === 0) {
      feedContainer.innerHTML = `
        <div class="qs-empty-feed">
          <div class="qs-empty-icon">${ICONS.emptyFrame}</div>
          <span class="qs-empty-label">No captures recorded</span>
          <span class="qs-empty-hint">Trigger capture above to auto-save and copy path for AI</span>
        </div>
      `
      return
    }

    feedContainer.innerHTML = items
      .map(
        (item: CaptureItem) => `
        <article class="qs-item" data-id="${item.id}">
          <div class="qs-item-thumb" data-id="${item.id}" title="Click to open full-page viewer in new tab">
            <img src="${item.thumbnailDataUrl}" alt="${item.pageTitle}" loading="lazy" />
          </div>
          <div class="qs-item-body">
            <h3 class="qs-item-title" title="${item.pageTitle}">${item.pageTitle}</h3>
            <div class="qs-item-meta">${formatTimestamp(item.timestamp)} &bull; ${item.width}&times;${item.height}px</div>
            <div class="qs-item-path" title="${item.absolutePath}">${item.absolutePath}</div>
            
            <div class="qs-item-toolbar">
              <button class="qs-tool-btn qs-tool-btn-primary qs-action-copy-path" data-path="${item.absolutePath}" title="Copy absolute path">
                ${ICONS.copy}
                <span>Path</span>
              </button>
              <button class="qs-tool-btn qs-action-copy-image" data-id="${item.id}" title="Copy raw image to clipboard">
                ${ICONS.image}
                <span>Image</span>
              </button>
              <button class="qs-tool-btn qs-tool-btn-danger qs-action-delete" data-id="${item.id}" title="Remove entry">
                ${ICONS.trash}
              </button>
            </div>
          </div>
        </article>
      `
      )
      .join('')

    // Bind card action buttons
    feedContainer.querySelectorAll<HTMLButtonElement>('.qs-action-copy-path').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const path = btn.getAttribute('data-path')
        if (path) {
          await captureEngine.copyTextArtifact(path)
          notify('Path copied to clipboard')
        }
      })
    })

    feedContainer.querySelectorAll<HTMLButtonElement>('.qs-action-copy-image').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')
        const item = items.find((i) => i.id === id)
        if (item) {
          const ok = await captureEngine.copyImageArtifact(item.absolutePath, item.thumbnailDataUrl)
          if (ok) {
            notify('Raw image copied to clipboard')
          } else {
            notify('Failed to copy image')
          }
        }
      })
    })

    feedContainer.querySelectorAll<HTMLButtonElement>('.qs-action-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')
        if (id) {
          await historyStore.remove(id)
          await renderFeed()
          notify('Removed from history')
        }
      })
    })

    // Bind click on thumbnails to open full-page Viewer Tab
    feedContainer.querySelectorAll<HTMLDivElement>('.qs-item-thumb').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        const id = thumb.getAttribute('data-id')
        if (id) {
          chrome.tabs.create({
            url: chrome.runtime.getURL(`options/index.html?id=${encodeURIComponent(id)}`)
          })
        }
      })
    })
  }

  // Active Tab Capture
  btnCaptureActive.addEventListener('click', async () => {
    if (isBusy) return
    isBusy = true
    btnCaptureActive.disabled = true
    btnCaptureBatch.disabled = true
    telemetryBox.style.display = 'flex'
    telemetryBar.style.width = '10%'
    telemetryMsg.textContent = 'Measuring viewport...'

    try {
      await captureEngine.captureActive((p) => {
        telemetryMsg.textContent = p.message || 'Capturing...'
        const percent = Math.round((p.currentSlice / Math.max(1, p.totalSlices)) * 100)
        telemetryBar.style.width = `${percent}%`
      })

      notify('Capture complete & path copied')
      await renderFeed()
    } catch (err: any) {
      console.error('Capture error:', err)
      notify(`Error: ${err?.message || 'Capture failed'}`)
    } finally {
      isBusy = false
      btnCaptureActive.disabled = false
      btnCaptureBatch.disabled = false
      setTimeout(() => {
        telemetryBox.style.display = 'none'
        telemetryBar.style.width = '0%'
      }, 700)
    }
  })

  // Batch Tabs Capture
  btnCaptureBatch.addEventListener('click', async () => {
    if (isBusy) return
    isBusy = true
    btnCaptureActive.disabled = true
    btnCaptureBatch.disabled = true
    telemetryBox.style.display = 'flex'
    telemetryBar.style.width = '5%'
    telemetryMsg.textContent = 'Indexing open tabs...'

    try {
      const result = await captureEngine.captureBatch((msg, current, total) => {
        telemetryMsg.textContent = msg
        const percent = Math.round((current / Math.max(1, total)) * 100)
        telemetryBar.style.width = `${percent}%`
      })

      notify(`Captured ${result.items.length} tabs & paths copied`)
      await renderFeed()
    } catch (err: any) {
      console.error('Batch error:', err)
      notify(`Error: ${err?.message || 'Batch capture failed'}`)
    } finally {
      isBusy = false
      btnCaptureActive.disabled = false
      btnCaptureBatch.disabled = false
      setTimeout(() => {
        telemetryBox.style.display = 'none'
        telemetryBar.style.width = '0%'
      }, 700)
    }
  })

  // Purge History
  btnPurge.addEventListener('click', async () => {
    if (confirm('Clear all recorded captures from history?')) {
      await historyStore.clear()
      await renderFeed()
      notify('History cleared')
    }
  })

  // Initial render
  await renderFeed()
}

initSidebarApp()
