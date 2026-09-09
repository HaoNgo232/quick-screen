import { describe, it, expect } from 'bun:test'
import { spawn } from 'child_process'
import * as fs from 'fs'

describe('Native Messaging Host Bridge', () => {
  it('responds to ping with status ok and pong true', async () => {
    const proc = spawn((process.env.HOME + '/.local/bin/quick-screen-host'), [], {
      stdio: ['pipe', 'pipe', 'inherit']
    })

    const msg = JSON.stringify({ action: 'ping' })
    const msgBuffer = Buffer.from(msg, 'utf-8')
    const lenBuffer = Buffer.alloc(4)
    lenBuffer.writeUInt32LE(msgBuffer.length, 0)

    proc.stdin.write(Buffer.concat([lenBuffer, msgBuffer]))

    const response = await new Promise<any>((resolve) => {
      proc.stdout.once('data', (data) => {
        const length = data.readUInt32LE(0)
        const payload = JSON.parse(data.subarray(4, 4 + length).toString('utf-8'))
        resolve(payload)
      })
    })

    proc.kill()
    expect(response.status).toBe('ok')
    expect(response.pong).toBe(true)
  })

  it('saves base64 png directly to /tmp/quick-screen', async () => {
    const proc = spawn((process.env.HOME + '/.local/bin/quick-screen-host'), [], {
      stdio: ['pipe', 'pipe', 'inherit']
    })

    const testFilename = 'test-suite-capture.png'
    // 1x1 transparent PNG base64
    const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
    const msg = JSON.stringify({
      action: 'save',
      filename: testFilename,
      base64Data: `data:image/png;base64,${pngBase64}`
    })

    const msgBuffer = Buffer.from(msg, 'utf-8')
    const lenBuffer = Buffer.alloc(4)
    lenBuffer.writeUInt32LE(msgBuffer.length, 0)

    proc.stdin.write(Buffer.concat([lenBuffer, msgBuffer]))

    const response = await new Promise<any>((resolve) => {
      proc.stdout.once('data', (data) => {
        const length = data.readUInt32LE(0)
        const payload = JSON.parse(data.subarray(4, 4 + length).toString('utf-8'))
        resolve(payload)
      })
    })

    proc.kill()

    expect(response.status).toBe('ok')
    expect(response.absolutePath).toBe(`/tmp/quick-screen/${testFilename}`)
    expect(fs.existsSync(`/tmp/quick-screen/${testFilename}`)).toBe(true)

    // Cleanup test artifact
    fs.unlinkSync(`/tmp/quick-screen/${testFilename}`)
  })

  it('handles copy_image action successfully', async () => {
    const testFile = '/tmp/quick-screen/test-copy-img.png'
    fs.mkdirSync('/tmp/quick-screen', { recursive: true })
    fs.writeFileSync(testFile, Buffer.from('fake-png'))

    const proc = spawn((process.env.HOME + '/.local/bin/quick-screen-host'), [], {
      stdio: ['pipe', 'pipe', 'inherit']
    })

    const msg = JSON.stringify({ action: 'copy_image', filepath: testFile })
    const msgBuffer = Buffer.from(msg, 'utf-8')
    const lenBuffer = Buffer.alloc(4)
    lenBuffer.writeUInt32LE(msgBuffer.length, 0)

    proc.stdin.write(Buffer.concat([lenBuffer, msgBuffer]))

    const response = await new Promise<any>((resolve) => {
      proc.stdout.once('data', (data) => {
        const length = data.readUInt32LE(0)
        const payload = JSON.parse(data.subarray(4, 4 + length).toString('utf-8'))
        resolve(payload)
      })
    })

    proc.kill()
    fs.unlinkSync(testFile)

    expect(response.status).toBe('ok')
    expect(response.filepath).toBe(testFile)
  })

  it('handles read_file action returning base64 dataUrl', async () => {
    const testFile = '/tmp/quick-screen/test-read-file.png'
    fs.mkdirSync('/tmp/quick-screen', { recursive: true })
    fs.writeFileSync(testFile, Buffer.from('quick-screen-test-data'))

    const proc = spawn((process.env.HOME + '/.local/bin/quick-screen-host'), [], {
      stdio: ['pipe', 'pipe', 'inherit']
    })

    const msg = JSON.stringify({ action: 'read_file', filepath: testFile })
    const msgBuffer = Buffer.from(msg, 'utf-8')
    const lenBuffer = Buffer.alloc(4)
    lenBuffer.writeUInt32LE(msgBuffer.length, 0)

    proc.stdin.write(Buffer.concat([lenBuffer, msgBuffer]))

    const response = await new Promise<any>((resolve) => {
      proc.stdout.once('data', (data) => {
        const length = data.readUInt32LE(0)
        const payload = JSON.parse(data.subarray(4, 4 + length).toString('utf-8'))
        resolve(payload)
      })
    })

    proc.kill()
    fs.unlinkSync(testFile)

    expect(response.status).toBe('ok')
    expect(response.dataUrl).toContain('data:image/png;base64,')
  })
})
