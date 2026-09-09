import {
  captureFullPage,
  captureAllTabs,
  getRecentCaptures,
  clearRecentCaptures,
  deleteCapture,
  copyPathOnly,
  copyDualClipboard
} from './captureEngine'
import type { CaptureItem } from '../types/capture'

let isCapturing = false

function formatTime(timestamp: number): string {
  const d = new Date(timestamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())} - ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
}

function showSidebarToast(text: string) {
  const toast = document.getElementById('sidebar-toast')
  if (!toast) return
  toast.textContent = text
  toast.classList.add('visible')
  setTimeout(() => {
    toast.classList.remove('visible')
  }, 2000)
}

export default async function initSidebarApp() {
  const root = document.getElementById('root')
  if (!root) return

  root.innerHTML = `
    <div class="qs-container">
      <header class="qs-header">
        <div class="qs-brand">
          <div class="qs-logo-icon">📸</div>
          <div class="qs-brand-text">
            <h1 class="qs-title">quick-screen</h1>
            <p class="qs-subtitle">Chụp toàn trang & copy path cho AI</p>
          </div>
        </div>
      </header>

      <!-- Action Panel -->
      <section class="qs-actions">
        <button id="btn-capture-single" class="qs-btn qs-btn-primary" type="button">
          <span class="btn-icon">⚡</span>
          <span class="btn-text">Chụp trang này (Full Page)</span>
        </button>

        <button id="btn-capture-batch" class="qs-btn qs-btn-secondary" type="button">
          <span class="btn-icon">📑</span>
          <span class="btn-text">Chụp tất cả các tab (Batch)</span>
        </button>

        <div id="capture-progress" class="qs-progress-box" style="display: none;">
          <div class="qs-spinner"></div>
          <div class="qs-progress-info">
            <span id="progress-message">Đang chuẩn bị...</span>
            <div class="qs-progress-bar">
              <div id="progress-bar-fill" class="qs-progress-fill" style="width: 0%;"></div>
            </div>
          </div>
        </div>
      </section>

      <!-- History Header -->
      <div class="qs-history-header">
        <h2 class="qs-section-title">Lịch sử chụp <span id="history-count" class="qs-badge">0</span></h2>
        <button id="btn-clear-history" class="qs-btn-text" type="button" title="Xóa toàn bộ lịch sử">
          Xóa tất cả
        </button>
      </div>

      <!-- History List -->
      <div id="history-list" class="qs-history-list">
        <div class="qs-empty-state">
          <p class="empty-icon">🖼️</p>
          <p class="empty-title">Chưa có ảnh chụp nào</p>
          <p class="empty-desc">Bấm nút chụp bên trên để lưu ảnh và tự động copy đường dẫn cho AI</p>
        </div>
      </div>

      <!-- In-sidebar feedback toast -->
      <div id="sidebar-toast" class="qs-toast"></div>
    </div>
  `

  const btnCaptureSingle = document.getElementById('btn-capture-single') as HTMLButtonElement
  const btnCaptureBatch = document.getElementById('btn-capture-batch') as HTMLButtonElement
  const btnClearHistory = document.getElementById('btn-clear-history') as HTMLButtonElement
  const progressBox = document.getElementById('capture-progress') as HTMLDivElement
  const progressMsg = document.getElementById('progress-message') as HTMLSpanElement
  const progressFill = document.getElementById('progress-bar-fill') as HTMLDivElement
  const historyList = document.getElementById('history-list') as HTMLDivElement
  const historyCount = document.getElementById('history-count') as HTMLSpanElement

  async function renderHistory() {
    const items = await getRecentCaptures()
    historyCount.textContent = String(items.length)

    if (items.length === 0) {
      historyList.innerHTML = `
        <div class="qs-empty-state">
          <p class="empty-icon">🖼️</p>
          <p class="empty-title">Chưa có ảnh chụp nào</p>
          <p class="empty-desc">Bấm nút chụp bên trên để lưu ảnh và tự động copy đường dẫn cho AI</p>
        </div>
      `
      return
    }

    historyList.innerHTML = items
      .map(
        (item) => `
        <div class="qs-card" data-id="${item.id}">
          <div class="qs-card-thumb">
            <img src="${item.thumbnailDataUrl}" alt="${item.pageTitle}" loading="lazy" />
          </div>
          <div class="qs-card-content">
            <h3 class="qs-card-title" title="${item.pageTitle}">${item.pageTitle}</h3>
            <div class="qs-card-time">${formatTime(item.timestamp)} &bull; ${item.width}x${item.height}px</div>
            <div class="qs-card-path" title="${item.absolutePath}">${item.absolutePath}</div>
            
            <div class="qs-card-actions">
              <button class="qs-action-btn qs-btn-copy-path" data-path="${item.absolutePath}" title="Copy đường dẫn">
                📋 Copy Path
              </button>
              <button class="qs-action-btn qs-btn-copy-img" data-id="${item.id}" title="Copy ảnh">
                🖼️ Copy Ảnh
              </button>
              <button class="qs-action-btn qs-action-danger qs-btn-delete" data-id="${item.id}" title="Xóa khỏi lịch sử">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `
      )
      .join('')

    // Bind event listeners for card buttons
    historyList.querySelectorAll<HTMLButtonElement>('.qs-btn-copy-path').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const path = btn.getAttribute('data-path')
        if (path) {
          await copyPathOnly(path)
          showSidebarToast('✓ Đã copy đường dẫn vào clipboard!')
        }
      })
    })

    historyList.querySelectorAll<HTMLButtonElement>('.qs-btn-copy-img').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')
        const item = items.find((i) => i.id === id)
        if (item) {
          try {
            const res = await fetch(item.thumbnailDataUrl)
            const blob = await res.blob()
            await copyDualClipboard(item.absolutePath, blob)
            showSidebarToast('✓ Đã copy ảnh & path vào clipboard!')
          } catch (err) {
            console.error(err)
            await copyPathOnly(item.absolutePath)
            showSidebarToast('✓ Đã copy đường dẫn!')
          }
        }
      })
    })

    historyList.querySelectorAll<HTMLButtonElement>('.qs-btn-delete').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id')
        if (id) {
          await deleteCapture(id)
          await renderHistory()
          showSidebarToast('Đã xóa khỏi lịch sử')
        }
      })
    })
  }

  // Handle single tab capture
  btnCaptureSingle.addEventListener('click', async () => {
    if (isCapturing) return
    isCapturing = true
    btnCaptureSingle.disabled = true
    btnCaptureBatch.disabled = true
    progressBox.style.display = 'flex'
    progressFill.style.width = '10%'
    progressMsg.textContent = 'Đang chuẩn bị...'

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const activeTab = tabs[0]
      if (!activeTab || !activeTab.id) {
        throw new Error('Không tìm thấy tab đang kích hoạt')
      }

      await captureFullPage(activeTab, (p) => {
        progressMsg.textContent = p.message || 'Đang chụp...'
        const percent = Math.round((p.currentSlice / Math.max(1, p.totalSlices)) * 100)
        progressFill.style.width = `${percent}%`
      })

      showSidebarToast('✓ Đã chụp & copy path thành công!')
      await renderHistory()
    } catch (err: any) {
      console.error('Capture error:', err)
      showSidebarToast(`Lỗi: ${err?.message || 'Không thể chụp trang'}`)
    } finally {
      isCapturing = false
      btnCaptureSingle.disabled = false
      btnCaptureBatch.disabled = false
      setTimeout(() => {
        progressBox.style.display = 'none'
        progressFill.style.width = '0%'
      }, 800)
    }
  })

  // Handle batch tab capture
  btnCaptureBatch.addEventListener('click', async () => {
    if (isCapturing) return
    isCapturing = true
    btnCaptureSingle.disabled = true
    btnCaptureBatch.disabled = true
    progressBox.style.display = 'flex'
    progressFill.style.width = '5%'
    progressMsg.textContent = 'Đang quét danh sách các tab...'

    try {
      const result = await captureAllTabs((msg, current, total) => {
        progressMsg.textContent = msg
        const percent = Math.round((current / Math.max(1, total)) * 100)
        progressFill.style.width = `${percent}%`
      })

      showSidebarToast(`✓ Đã chụp ${result.items.length} tab & copy toàn bộ path!`)
      await renderHistory()
    } catch (err: any) {
      console.error('Batch capture error:', err)
      showSidebarToast(`Lỗi: ${err?.message || 'Lỗi chụp hàng loạt'}`)
    } finally {
      isCapturing = false
      btnCaptureSingle.disabled = false
      btnCaptureBatch.disabled = false
      setTimeout(() => {
        progressBox.style.display = 'none'
        progressFill.style.width = '0%'
      }, 800)
    }
  })

  // Clear history
  btnClearHistory.addEventListener('click', async () => {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ lịch sử trong danh sách không?')) {
      await clearRecentCaptures()
      await renderHistory()
      showSidebarToast('Đã dọn sạch lịch sử')
    }
  })

  // Initial load
  await renderHistory()
}

initSidebarApp()
