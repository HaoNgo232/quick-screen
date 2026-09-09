console.log(
  '[From the background context] Hello from the background worker/script!'
)

const isFirefoxLike =
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'firefox' ||
  import.meta.env.EXTENSION_PUBLIC_BROWSER === 'gecko-based'

if (isFirefoxLike) {
  browser.browserAction?.onClicked?.addListener(() => {
    browser.sidebarAction?.open()
  })

  browser.runtime.onMessage.addListener((message: any) => {
    if (!message || message.type !== 'openSidebar') return
    browser.sidebarAction?.open()
  })
}

if (!isFirefoxLike && chrome.sidePanel?.setPanelBehavior) {
  // Keep openPanelOnActionClick false so toolbar click opens the floating Popup,
  // preventing the webpage from being squeezed by the Side Panel!
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false }).catch(() => {})
}

chrome.runtime.onMessage.addListener((message) => {
  if (!message || message.type !== 'openSidebar') return

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const activeTabId = tabs && tabs[0] && tabs[0].id
    const windowId = tabs && tabs[0] && tabs[0].windowId
    if (!chrome.sidePanel?.open) return

    try {
      if (activeTabId) {
        chrome.sidePanel.open({ tabId: activeTabId })
      } else if (windowId) {
        chrome.sidePanel.open({ windowId })
      }
    } catch (error) {
      console.error(error)
    }
  })
})
