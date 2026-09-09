import { describe, it, expect } from 'bun:test'
import { spawnSync, spawn } from 'child_process'
import * as path from 'path'

const HOST_SCRIPT = path.resolve(__dirname, '../native-host/quick_screen_host.py')

describe('PlatformAdapter Unit & Seam Verification', () => {
  it('LinuxAdapter resolves storage dir to /tmp/quick-screen', () => {
    const pyCode = `
import sys
sys.path.insert(0, '${path.dirname(HOST_SCRIPT)}')
from quick_screen_host import LinuxAdapter
adapter = LinuxAdapter()
print(adapter.get_storage_dir())
`
    const res = spawnSync('python3', ['-c', pyCode], { encoding: 'utf-8' })
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe('/tmp/quick-screen')
  })

  it('WindowsAdapter resolves storage dir based on TEMP environment variable', () => {
    const pyCode = `
import sys, os
sys.path.insert(0, '${path.dirname(HOST_SCRIPT)}')
from quick_screen_host import WindowsAdapter
os.environ['TEMP'] = 'C:\\\\Users\\\\Test\\\\AppData\\\\Local\\\\Temp'
adapter = WindowsAdapter()
print(adapter.get_storage_dir())
`
    const res = spawnSync('python3', ['-c', pyCode], { encoding: 'utf-8' })
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe('C:\\Users\\Test\\AppData\\Local\\Temp/quick-screen'.replace('/', path.sep))
  })

  it('get_platform_adapter selects WindowsAdapter on win32 and LinuxAdapter on linux', () => {
    const pyCode = `
import sys
sys.path.insert(0, '${path.dirname(HOST_SCRIPT)}')
from quick_screen_host import get_platform_adapter, WindowsAdapter, LinuxAdapter

sys.platform = 'win32'
assert isinstance(get_platform_adapter(), WindowsAdapter)

sys.platform = 'linux'
assert isinstance(get_platform_adapter(), LinuxAdapter)
print('OK')
`
    const res = spawnSync('python3', ['-c', pyCode], { encoding: 'utf-8' })
    expect(res.status).toBe(0)
    expect(res.stdout.trim()).toBe('OK')
  })

  it('native host python script runs directly and responds to ping', async () => {
    const proc = spawn('python3', [HOST_SCRIPT], {
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
})
