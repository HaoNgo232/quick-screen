import type { SinkHealth } from '../types/capture'

/**
 * Seam: ArtifactSink
 * Two real adapters exist: NativeHostSink (/tmp via stdio) and DownloadApiSink (Downloads API).
 */
export interface ArtifactSink {
  save(filename: string, dataUrl: string, copyClipboard?: boolean): Promise<string>
  saveBatch?(items: { filename: string; dataUrl: string }[]): Promise<string[]>
  copyClipboard?(text: string): Promise<boolean>
  copyImage?(filepath: string): Promise<boolean>
  readFile?(filepath: string): Promise<string | null>
  readFileChunk?(filepath: string, offset: number, chunkSize?: number): Promise<{ data: string; eof: boolean; totalSize: number } | null>
  openFile?(filepath: string): Promise<boolean>
  checkHealth?(): Promise<SinkHealth>
}

export const NATIVE_HOST_NAME = 'com.quickscreen.host'

/**
 * Adapter 1: NativeHostSink
 * Saves directly to /tmp/quick-shot/ with zero prompts via native messaging host.
 */
export class NativeHostSink implements ArtifactSink {
  async save(filename: string, dataUrl: string, copyClipboard = true): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendNativeMessage(
          NATIVE_HOST_NAME,
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
          NATIVE_HOST_NAME,
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
          NATIVE_HOST_NAME,
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

  async readFile(filepath: string): Promise<string | null> {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendNativeMessage(
          NATIVE_HOST_NAME,
          { action: 'read_file', filepath },
          (response) => {
            if (!chrome.runtime.lastError && response?.status === 'ok' && response.dataUrl) {
              resolve(response.dataUrl)
            } else {
              resolve(null)
            }
          }
        )
      } catch {
        resolve(null)
      }
    })
  }

  async readFileChunk(filepath: string, offset: number, chunkSize = 512 * 1024): Promise<{ data: string; eof: boolean; totalSize: number } | null> {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendNativeMessage(
          NATIVE_HOST_NAME,
          { action: 'read_file_chunk', filepath, offset, chunkSize },
          (response) => {
            if (!chrome.runtime.lastError && response?.status === 'ok' && response.data) {
              resolve(response)
            } else {
              resolve(null)
            }
          }
        )
      } catch {
        resolve(null)
      }
    })
  }

  async openFile(filepath: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendNativeMessage(
          NATIVE_HOST_NAME,
          { action: 'open_file', filepath },
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
          NATIVE_HOST_NAME,
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

  async checkHealth(): Promise<SinkHealth> {
    return new Promise((resolve) => {
      let settled = false
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true
          resolve({ mode: 'native', directory: '/tmp/quick-shot', healthy: false })
        }
      }, 2000)

      try {
        chrome.runtime.sendNativeMessage(
          NATIVE_HOST_NAME,
          { action: 'ping' },
          (response) => {
            if (settled) return
            settled = true
            clearTimeout(timer)
            if (chrome.runtime.lastError || !response || response.status !== 'ok' || !response.pong) {
              resolve({ mode: 'native', directory: '/tmp/quick-shot', healthy: false })
            } else {
              resolve({ mode: 'native', directory: '/tmp/quick-shot', healthy: true })
            }
          }
        )
      } catch {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ mode: 'native', directory: '/tmp/quick-shot', healthy: false })
        }
      }
    })
  }
}

/**
 * Adapter 2: DownloadApiSink
 * Universal fallback writing into ~/Downloads/quick-shot/ via chrome.downloads.
 */
export class DownloadApiSink implements ArtifactSink {
  async save(filename: string, dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      chrome.downloads.download(
        {
          url: dataUrl,
          filename: `quick-shot/${filename}`,
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

  async checkHealth(): Promise<SinkHealth> {
    return { mode: 'download', directory: 'Downloads/quick-shot', healthy: true }
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

  async readFile(filepath: string): Promise<string | null> {
    if (this.nativeSink.readFile) {
      return await this.nativeSink.readFile(filepath)
    }
    return null
  }

  async readFileChunk(filepath: string, offset: number, chunkSize?: number): Promise<{ data: string; eof: boolean; totalSize: number } | null> {
    if (this.nativeSink.readFileChunk) {
      return await this.nativeSink.readFileChunk(filepath, offset, chunkSize)
    }
    return null
  }

  async openFile(filepath: string): Promise<boolean> {
    if (this.nativeSink.openFile) {
      return await this.nativeSink.openFile(filepath)
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

  async checkHealth(): Promise<SinkHealth> {
    if (this.nativeSink.checkHealth) {
      try {
        const health = await this.nativeSink.checkHealth()
        if (health && health.healthy) {
          return health
        }
      } catch {
        // Native sink threw or failed, fall back
      }
    }
    if (this.downloadSink.checkHealth) {
      return await this.downloadSink.checkHealth()
    }
    return { mode: 'download', directory: 'Downloads/quick-shot', healthy: true }
  }
}
