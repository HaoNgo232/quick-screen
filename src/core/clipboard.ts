/**
 * Module: Clipboard
 * Deep module encapsulating browser clipboard quirks and multi-MIME payloads.
 */
export async function copyDual(absolutePath: string, imageBlob: Blob): Promise<boolean> {
  try {
    const item = new ClipboardItem({
      'text/plain': new Blob([absolutePath], { type: 'text/plain' }),
      'image/png': imageBlob
    })
    await navigator.clipboard.write([item])
    return true
  } catch (err) {
    console.warn('Dual clipboard write failed, falling back to text:', err)
    return copyText(absolutePath)
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Clipboard write failed:', err)
    return false
  }
}
