export interface PageDimensions {
  totalWidth: number
  totalHeight: number
  viewportWidth: number
  viewportHeight: number
  devicePixelRatio: number
  pageTitle: string
  url: string
}

export interface CaptureItem {
  id: string
  filename: string
  absolutePath: string
  pageTitle: string
  url: string
  timestamp: number
  thumbnailDataUrl: string
  width: number
  height: number
}

export interface CaptureProgress {
  currentSlice: number
  totalSlices: number
  status: 'preparing' | 'scrolling' | 'stitching' | 'saving' | 'done' | 'error'
  message?: string
}
