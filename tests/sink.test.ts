import { describe, it, expect } from 'bun:test'
import { AutoSink, type ArtifactSink } from '../src/core/sink'

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
