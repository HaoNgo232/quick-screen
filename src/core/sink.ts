/**
 * Seam: ArtifactSink
 * Two real adapters exist: NativeHostSink (/tmp via stdio) and DownloadApiSink (Downloads API).
 */
export interface ArtifactSink {
  save(filename: string, dataUrl: string, copyClipboard?: boolean): Promise<string>
  saveBatch?(items: { filename: string; dataUrl: string }[]): Promise<string[]>
  copyClipboard?(text: string): Promise<boolean>
  copyImage?(filepath: string): Promise<boolean>
}

/**
 * Adapter 1: NativeHostSink
 * Saves directly to /tmp/quick-screen/ with zero prompts via native messaging host.
 */
export class NativeHostSink implements ArtifactSink {
  async save(filename: string, dataUrl: string, copyClipboard = true): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendNativeMessage(
          'com.quickscreen.host',
          { action: 'save', filename, base64Data: dataUrl, copyClipboard },
          (response) => {
            if (chrome.runtime.lastError || !response || response.status !== 'ok') {
              reject(new Error(chrome.runtime.lastError?.message || response?.error || 'Native host failed'))
            } else {
              resolve(response.absolutePath)
            }
          }
        )
      } catch (err) {
        reject(err)
      }
    })
  }

  async copyClipboard(text: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendNativeMessage(
          'com.quickscreen.host',
          { action: 'copy_text', text },
          (response) => {
            resolve(response?.status === 'ok')
          }
        )
      } catch {
        resolve(false)
      }
    })
  }

  async copyImage(filepath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendNativeMessage(
          'com.quickscreen.host',
          { action: 'copy_image', filepath },
          (response) => {
            resolve(response?.status === 'ok')
          }
        )
      } catch {
        resolve(false)
      }
    })
  }

  async saveBatch(items: { filename: string; dataUrl: string }[]): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendNativeMessage(
          'com.quickscreen.host',
          {
            action: 'save_batch',
            items: items.map((i) => ({ filename: i.filename, base64Data: i.dataUrl }))
          },
          (response) => {
            if (chrome.runtime.lastError || !response || response.status !== 'ok') {
              reject(new Error(chrome.runtime.lastError?.message || response?.error || 'Native batch failed'))
            } else {
              resolve(response.paths)
            }
          }
        )
      } catch (err) {
        reject(err)
      }
    })
  }
}

/**
 * Adapter 2: DownloadApiSink
 * Universal fallback writing into ~/Downloads/quick-screen/ via chrome.downloads.
 */
export class DownloadApiSink implements ArtifactSink {
  async save(filename: string, dataUrl: string): Promise<string> {
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
            return reject(new Error(chrome.runtime.lastError?.message || 'Download API failed'))
          }

          const pollInterval = setInterval(() => {
            chrome.downloads.search({ id: downloadId }, (items) => {
              if (!items || items.length === 0) return
              const item = items[0]
              if (item.state === 'complete') {
                clearInterval(pollInterval)
                resolve(item.filename)
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
}

/**
 * Composite Adapter: AutoSink
 * Prioritizes NativeHostSink for zero-prompt /tmp, transparently falling back to DownloadApiSink.
 */
export class AutoSink implements ArtifactSink {
  constructor(
    private nativeSink: ArtifactSink = new NativeHostSink(),
    private downloadSink: ArtifactSink = new DownloadApiSink()
  ) {}

  async save(filename: string, dataUrl: string, copyClipboard = true): Promise<string> {
    try {
      return await this.nativeSink.save(filename, dataUrl, copyClipboard)
    } catch {
      return await this.downloadSink.save(filename, dataUrl, copyClipboard)
    }
  }

  async copyClipboard(text: string): Promise<boolean> {
    if (this.nativeSink.copyClipboard) {
      const ok = await this.nativeSink.copyClipboard(text)
      if (ok) return true
    }
    return false
  }

  async copyImage(filepath: string): Promise<boolean> {
    if (this.nativeSink.copyImage) {
      const ok = await this.nativeSink.copyImage(filepath)
      if (ok) return true
    }
    return false
  }

  async saveBatch(items: { filename: string; dataUrl: string }[]): Promise<string[]> {
    try {
      if (this.nativeSink.saveBatch) {
        return await this.nativeSink.saveBatch(items)
      }
    } catch {}

    const results: string[] = []
    for (const item of items) {
      results.push(await this.downloadSink.save(item.filename, item.dataUrl))
    }
    return results
  }
}
