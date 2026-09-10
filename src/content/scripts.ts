import type { PageDimensions } from '../types/capture'

let originalScrollX = 0
let originalScrollY = 0
let originalOverflow = ''
let fixedElements: HTMLElement[] = []

function findFixedElements(): HTMLElement[] {
  const elements: HTMLElement[] = []
  const allNodes = document.querySelectorAll<HTMLElement>('body *')

  for (let i = 0; i < allNodes.length; i++) {
    const el = allNodes[i]
    if (!el || !(el instanceof HTMLElement)) continue
    
    // Ignore our own toast root if present
    if (el.hasAttribute('data-quickscreen-toast')) continue

    const style = window.getComputedStyle(el)
    if (style.position === 'fixed' || style.position === 'sticky') {
      elements.push(el)
    }
  }
  return elements
}

function showToast(message?: string, filePath?: string) {
  const existingToast = document.getElementById('quickscreen-toast-container')
  if (existingToast) {
    existingToast.remove()
  }

  const toastContainer = document.createElement('div')
  toastContainer.id = 'quickscreen-toast-container'
  toastContainer.setAttribute('data-quickscreen-toast', 'true')
  toastContainer.style.cssText = `
    position: fixed !important;
    top: 24px !important;
    right: 24px !important;
    left: auto !important;
    bottom: auto !important;
    transform: translateX(20px) !important;
    background: rgba(24, 24, 27, 0.95) !important;
    backdrop-filter: blur(16px) !important;
    -webkit-backdrop-filter: blur(16px) !important;
    border: 1px solid rgba(52, 211, 153, 0.4) !important;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3), 0 0 20px rgba(52, 211, 153, 0.2) !important;
    border-radius: 12px !important;
    padding: 12px 18px !important;
    z-index: 2147483647 !important;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
    color: #ffffff !important;
    display: flex !important;
    align-items: center !important;
    gap: 12px !important;
    max-width: 90vw !important;
    cursor: ${filePath ? 'pointer' : 'default'} !important;
    opacity: 0 !important;
    transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
    pointer-events: auto !important;
  `

  const icon = document.createElement('div')
  icon.style.cssText = `
    width: 28px !important;
    height: 28px !important;
    background: #059669 !important;
    border-radius: 50% !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex-shrink: 0 !important;
    color: white !important;
    font-size: 16px !important;
    font-weight: bold !important;
  `
  icon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'

  const content = document.createElement('div')
  content.style.cssText = `
    display: flex !important;
    flex-direction: column !important;
    gap: 2px !important;
    overflow: hidden !important;
  `

  const title = document.createElement('div')
  title.style.cssText = `
    font-weight: 600 !important;
    font-size: 13.5px !important;
    color: #f4f4f5 !important;
    white-space: nowrap !important;
  `
  title.textContent = message || 'Screenshot captured & path copied!'

  content.appendChild(title)

  if (filePath) {
    const pathSnippet = document.createElement('div')
    pathSnippet.style.cssText = `
      font-size: 11.5px !important;
      color: #a1a1aa !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
      max-width: 450px !important;
    `
    pathSnippet.textContent = filePath
    content.appendChild(pathSnippet)
  }

  const closeBtn = document.createElement('button')
  closeBtn.setAttribute('type', 'button')
  closeBtn.setAttribute('aria-label', 'Close')
  closeBtn.style.cssText = `
    background: transparent !important;
    border: none !important;
    color: #a1a1aa !important;
    cursor: pointer !important;
    padding: 4px !important;
    margin-left: 4px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    border-radius: 6px !important;
    outline: none !important;
    flex-shrink: 0 !important;
    transition: color 0.15s ease, background-color 0.15s ease !important;
  `
  closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'

  closeBtn.addEventListener('mouseenter', () => {
    closeBtn.style.color = '#ffffff'
    closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)'
  })
  closeBtn.addEventListener('mouseleave', () => {
    closeBtn.style.color = '#a1a1aa'
    closeBtn.style.backgroundColor = 'transparent'
  })

  let isDismissed = false
  let dismissTimer: ReturnType<typeof setTimeout> | null = null

  const dismissToast = () => {
    if (isDismissed) return
    isDismissed = true
    if (dismissTimer) {
      clearTimeout(dismissTimer)
      dismissTimer = null
    }
    toastContainer.style.opacity = '0'
    toastContainer.style.transform = 'translateX(20px)'
    setTimeout(() => {
      if (toastContainer.parentNode) {
        toastContainer.remove()
      }
    }, 250)
  }

  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    dismissToast()
  })

  toastContainer.appendChild(icon)
  toastContainer.appendChild(content)
  toastContainer.appendChild(closeBtn)
  document.body.appendChild(toastContainer)

  // Trigger smooth slide in
  requestAnimationFrame(() => {
    toastContainer.style.opacity = '1'
    toastContainer.style.transform = 'translateX(0)'
  })

  if (filePath) {
    toastContainer.title = 'Click to re-copy path'
    toastContainer.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(filePath)
        title.textContent = 'Path re-copied!'
      } catch (err) {
        console.error('Re-copy error:', err)
      }
    })
  }

  dismissTimer = setTimeout(() => {
    dismissToast()
  }, 3500)
}

/**
 * Main message handler for extension capture requests
 */
function handleRuntimeMessage(
  message: any,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response?: any) => void
) {
  if (!message || !message.type) return false

  switch (message.type) {
    case 'PING': {
      sendResponse({ status: 'PONG' })
      return false
    }

    case 'PREPARE_CAPTURE': {
      originalScrollX = window.scrollX
      originalScrollY = window.scrollY
      originalOverflow = document.documentElement.style.overflow

      document.documentElement.style.overflow = 'hidden'
      fixedElements = findFixedElements()

      const totalWidth = Math.max(
        document.documentElement.scrollWidth,
        document.body ? document.body.scrollWidth : 0,
        window.innerWidth
      )

      const totalHeight = Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0,
        window.innerHeight
      )

      const dimensions: PageDimensions = {
        totalWidth,
        totalHeight,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio || 1,
        pageTitle: document.title || 'Untitled',
        url: window.location.href
      }

      sendResponse(dimensions)
      return false
    }

    case 'SCROLL_TO': {
      const { x, y, hideFixed } = message

      if (hideFixed) {
        for (const el of fixedElements) {
          if (!el.hasAttribute('data-qs-orig-vis')) {
            el.setAttribute('data-qs-orig-vis', el.style.visibility || 'visible')
            el.style.visibility = 'hidden'
          }
        }
      } else {
        for (const el of fixedElements) {
          if (el.hasAttribute('data-qs-orig-vis')) {
            el.style.visibility = ''
            el.removeAttribute('data-qs-orig-vis')
          }
        }
      }

      window.scrollTo({
        left: x,
        top: y,
        behavior: 'instant' as ScrollBehavior
      })

      // Allow frame rendering
      setTimeout(() => {
        sendResponse({
          scrolled: true,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        })
      }, 120)

      return true // asynchronous response
    }

    case 'RESTORE_CAPTURE': {
      for (const el of fixedElements) {
        if (el.hasAttribute('data-qs-orig-vis')) {
          el.style.visibility = ''
          el.removeAttribute('data-qs-orig-vis')
        }
      }
      fixedElements = []

      window.scrollTo({
        left: originalScrollX,
        top: originalScrollY,
        behavior: 'instant' as ScrollBehavior
      })

      document.documentElement.style.overflow = originalOverflow
      sendResponse({ restored: true })
      return false
    }

    case 'SHOW_TOAST': {
      showToast(message.message, message.filePath)
      sendResponse({ shown: true })
      return false
    }

    default:
      return false
  }
}

/**
 * Extension.js entrypoint
 */
export default function initial() {
  chrome.runtime.onMessage.addListener(handleRuntimeMessage)

  return () => {
    chrome.runtime.onMessage.removeListener(handleRuntimeMessage)
  }
}
