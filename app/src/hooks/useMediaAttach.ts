import { useCallback, useRef, useState, type ChangeEvent } from 'react'
import { useToast } from '../state/ToastProvider'
import type { ImageData } from '../types'

function resizeImage(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const max = 1024
        let w = img.width
        let h = img.height
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h)
          w = Math.round(w * r)
          h = Math.round(h * r)
        }
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')!.drawImage(img, 0, 0, w, h)
        const dataURL = c.toDataURL('image/jpeg', 0.85)
        resolve({ dataURL, mediaType: 'image/jpeg', base64: dataURL.split(',')[1] })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function extractVideoFrame(file: File): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.preload = 'metadata'
    v.src = url
    const done = () => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    }
    const fail = (e?: unknown) => {
      done()
      reject(e || new Error('video'))
    }
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(1, (v.duration || 2) / 2)
      } catch (e) {
        fail(e)
      }
    }
    v.onseeked = () => {
      try {
        const max = 1024
        let w = v.videoWidth || 640
        let h = v.videoHeight || 360
        if (w > max || h > max) {
          const r = Math.min(max / w, max / h)
          w = Math.round(w * r)
          h = Math.round(h * r)
        }
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        c.getContext('2d')!.drawImage(v, 0, 0, w, h)
        const dataURL = c.toDataURL('image/jpeg', 0.85)
        done()
        resolve({ dataURL, mediaType: 'image/jpeg', base64: dataURL.split(',')[1] })
      } catch (e) {
        fail(e)
      }
    }
    v.onerror = () => fail(new Error('video'))
    setTimeout(() => fail(new Error('timeout')), 9000)
  })
}

/** Manages the pending image/video-frame attachment for the composer. */
export function useMediaAttach() {
  const { showToast } = useToast()
  const [pendingImage, setPendingImage] = useState<ImageData | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)

  const openFile = useCallback(() => fileRef.current?.click(), [])
  const openVideo = useCallback(() => videoRef.current?.click(), [])
  const clear = useCallback(() => setPendingImage(null), [])

  const onPickImage = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files[0]
      e.target.value = ''
      if (!file || !/^image\//.test(file.type)) return
      try {
        setPendingImage(await resizeImage(file))
      } catch {
        showToast('بارگذاریِ تصویر ناموفق بود')
      }
    },
    [showToast],
  )

  const onPickVideo = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files[0]
      e.target.value = ''
      if (!file || !/^video\//.test(file.type)) return
      showToast('در حال آماده‌سازیِ ویدیو…')
      try {
        const frame = await extractVideoFrame(file)
        setPendingImage({ ...frame, isVideo: true })
      } catch {
        showToast('نتونستم از ویدیو فریم بگیرم')
      }
    },
    [showToast],
  )

  return { pendingImage, clear, openFile, openVideo, fileRef, videoRef, onPickImage, onPickVideo }
}
