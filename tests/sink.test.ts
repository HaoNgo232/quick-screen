import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AutoSink, NativeHostSink, DownloadApiSink, type ArtifactSink } from '../src/core/sink'
import type { SinkHealth } from '../src/types/capture'

class SuccessfulSink implements ArtifactSink {
  async save(filename: string): Promise<string> {
    return `/custom/path/${filename}`
  }
}

class FailingSink implements ArtifactSink {
  async save(): Promise<string> {
    throw new Error('Connection refused')
  }
}

class HealthyNativeSink implements ArtifactSink {
  async save(filename: string): Promise<string> {
    return `/tmp/quick-shot/${filename}`
  }
  async checkHealth(): Promise<SinkHealth> {
    return { mode: 'native', directory: '/tmp/quick-shot', healthy: true }
  }
}

class UnhealthyNativeSink implements ArtifactSink {
  async save(filename: string): Promise<string> {
    return `/tmp/quick-shot/${filename}`
  }
  async checkHealth(): Promise<SinkHealth> {
    return { mode: 'native', directory: '/tmp/quick-shot', healthy: false }
  }
}

class RejectingNativeSink implements ArtifactSink {
  async save(): Promise<string> {
    throw new Error('Native host unavailable')
  }
  async checkHealth(): Promise<SinkHealth> {
    throw new Error('Connection refused')
  }
}

class HealthyDownloadSink implements ArtifactSink {
  async save(filename: string): Promise<string> {
    return `Downloads/quick-shot/${filename}`
  }
  async checkHealth(): Promise<SinkHealth> {
    return { mode: 'download', directory: 'Downloads/quick-shot', healthy: true }
  }
}

describe('ArtifactSink Seam', () => {
  it('uses primary sink when it succeeds', async () => {
    const primary = new SuccessfulSink()
    const fallback = new FailingSink()
    const autoSink = new AutoSink(primary, fallback)

    const result = await autoSink.save('test.png', 'data:image/png;base64,AAA')
    expect(result).toBe('/custom/path/test.png')
  })

  it('transparently falls back to secondary sink when primary fails', async () => {
    const primary = new FailingSink()
    const fallback = new SuccessfulSink()
    const autoSink = new AutoSink(primary, fallback)

    const result = await autoSink.save('fallback.png', 'data:image/png;base64,BBB')
    expect(result).toBe('/custom/path/fallback.png')
  })
})

describe('ArtifactSink Health Checking', () => {
  let originalChrome: any

  beforeEach(() => {
    originalChrome = (globalThis as any).chrome
  })

  afterEach(() => {
    ;(globalThis as any).chrome = originalChrome
  })

  it('DownloadApiSink reports healthy download mode', async () => {
    const downloadSink = new DownloadApiSink()
    const health = await downloadSink.checkHealth()
    expect(health).toEqual({
      mode: 'download',
      directory: 'Downloads/quick-shot',
      healthy: true
    })
  })

  it('AutoSink returns native health when native sink is healthy', async () => {
    const nativeSink = new HealthyNativeSink()
    const downloadSink = new HealthyDownloadSink()
    const autoSink = new AutoSink(nativeSink, downloadSink)

    const health = await autoSink.checkHealth()
    expect(health).toEqual({
      mode: 'native',
      directory: '/tmp/quick-shot',
      healthy: true
    })
  })

  it('AutoSink falls back to download sink when native sink returns healthy: false', async () => {
    const nativeSink = new UnhealthyNativeSink()
    const downloadSink = new HealthyDownloadSink()
    const autoSink = new AutoSink(nativeSink, downloadSink)

    const health = await autoSink.checkHealth()
    expect(health).toEqual({
      mode: 'download',
      directory: 'Downloads/quick-shot',
      healthy: true
    })
  })

  it('AutoSink falls back to download sink when native sink rejects', async () => {
    const nativeSink = new RejectingNativeSink()
    const downloadSink = new HealthyDownloadSink()
    const autoSink = new AutoSink(nativeSink, downloadSink)

    const health = await autoSink.checkHealth()
    expect(health).toEqual({
      mode: 'download',
      directory: 'Downloads/quick-shot',
      healthy: true
    })
  })

  it('NativeHostSink reports healthy when ping succeeds', async () => {
    ;(globalThis as any).chrome = {
      runtime: {
        lastError: null,
        sendNativeMessage: (target: string, msg: any, callback: (res: any) => void) => {
          expect(target).toBe('com.quickscreen.host')
          expect(msg).toEqual({ action: 'ping' })
          callback({ status: 'ok', pong: true })
        }
      }
    }

    const nativeSink = new NativeHostSink()
    const health = await nativeSink.checkHealth()
    expect(health).toEqual({
      mode: 'native',
      directory: '/tmp/quick-shot',
      healthy: true
    })
  })

  it('NativeHostSink reports healthy: false when lastError is set', async () => {
    ;(globalThis as any).chrome = {
      runtime: {
        lastError: { message: 'Host not found' },
        sendNativeMessage: (_target: string, _msg: any, callback: (res: any) => void) => {
          callback(null)
        }
      }
    }

    const nativeSink = new NativeHostSink()
    const health = await nativeSink.checkHealth()
    expect(health).toEqual({
      mode: 'native',
      directory: '/tmp/quick-shot',
      healthy: false
    })
  })

  it('NativeHostSink reports healthy: false when sendNativeMessage throws', async () => {
    ;(globalThis as any).chrome = {
      runtime: {
        sendNativeMessage: () => {
          throw new Error('Native messaging not allowed')
        }
      }
    }

    const nativeSink = new NativeHostSink()
    const health = await nativeSink.checkHealth()
    expect(health).toEqual({
      mode: 'native',
      directory: '/tmp/quick-shot',
      healthy: false
    })
  })
})
