/**
 * Module: Clipboard
 * Deep module encapsulating browser clipboard quirks and multi-MIME payloads.
 */

function fallbackExecCommand(text: string): boolean {
  try {
    if (typeof document === 'undefined') return false
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    textArea.setAttribute('readonly', '')
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    return successful
  } catch {
    return false
  }
}

export async function copyDual(absolutePath: string, imageBlob: Blob): Promise<boolean> {
  const isFocused = typeof document !== 'undefined' && typeof document.hasFocus === 'function' && document.hasFocus()
  if (isFocused && typeof navigator !== 'undefined' && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        'text/plain': new Blob([absolutePath], { type: 'text/plain' }),
        'image/png': imageBlob
      })
      await navigator.clipboard.write([item])
      return true
    } catch {
      // Fallback silently to text copy
    }
  }
  return copyText(absolutePath)
}

export async function copyText(text: string): Promise<boolean> {
  const isFocused = typeof document !== 'undefined' && typeof document.hasFocus === 'function' && document.hasFocus()
  if (isFocused && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback to execCommand below
    }
  }

  // Fallback to execCommand
  if (fallbackExecCommand(text)) {
    return true
  }

  return false
}

export async function copyImageOnly(imageBlob: Blob): Promise<boolean> {
  const isFocused = typeof document !== 'undefined' && typeof document.hasFocus === 'function' && document.hasFocus()
  if (isFocused && typeof navigator !== 'undefined' && navigator.clipboard?.write) {
    try {
      const item = new ClipboardItem({
        'image/png': imageBlob
      })
      await navigator.clipboard.write([item])
      return true
    } catch {
      return false
    }
  }
  return false
}
