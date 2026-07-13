import { useEffect, useRef, useState } from 'react'
import { css } from '../css'
import { HoverButton } from './ui/HoverButton'
import { cfg } from '../config'
import { useChat } from '../state/ChatProvider'
import { useMediaAttach } from '../hooks/useMediaAttach'
import { useDictation } from '../hooks/useDictation'

function micBtnStyle(active: boolean) {
  return (
    'position:relative;flex:none;width:42px;height:42px;display:grid;place-items:center;border-radius:13px;cursor:pointer;transition:all .18s ease;border:1px solid ' +
    (active ? 'rgba(255,80,80,.7)' : 'rgba(255,255,255,.18)') +
    ';background:' +
    (active ? 'rgba(255,80,80,.18)' : 'rgba(255,255,255,.05)') +
    ';color:' +
    (active ? '#ffd0d0' : '#cfe1ff') +
    ';'
  )
}

export function Composer() {
  const { activeBot, bots, busy, send, resetToken } = useChat()
  const c = cfg[activeBot]
  const settings = bots[activeBot].settings

  const [input, setInput] = useState('')
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const inputRef = useRef(input)
  inputRef.current = input

  const media = useMediaAttach()
  const dictation = useDictation(() => inputRef.current, setInput)

  // Reset composer when switching assistant / starting a new chat.
  useEffect(() => {
    setInput('')
    media.clear()
    if (taRef.current) taRef.current.style.height = 'auto'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetToken])

  const settingsSummary = c.fields
    .map((f) => {
      const opt = f.options.find((o) => o.v === settings[f.key])
      return opt ? opt.l || opt.v : ''
    })
    .filter(Boolean)
    .join(' · ')

  const sendDisabled = busy || !(input.trim() || media.pendingImage)

  function onInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
    setInput(el.value)
  }

  function doSend() {
    if (sendDisabled) return
    send(input, media.pendingImage)
    setInput('')
    media.clear()
    if (taRef.current) taRef.current.style.height = 'auto'
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      doSend()
    }
  }

  return (
    <div style={css('flex:none;padding:10px 22px 20px;background:linear-gradient(0deg,#101424 60%,transparent);')}>
      <div style={css('max-width:760px;margin:0 auto;')}>
        <div style={css('background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.16);border-radius:20px;padding:9px 10px 9px 12px;box-shadow:0 12px 28px rgba(6,24,66,.35);')}>
          {media.pendingImage && (
            <div style={css('display:flex;align-items:center;gap:10px;margin:2px 4px 9px;padding:6px;border-radius:14px;background:rgba(8,12,24,.55);border:1px solid rgba(255,255,255,.1);width:max-content;max-width:100%;')}>
              <img src={media.pendingImage.dataURL} alt="پیش‌نمایش" style={css('width:46px;height:46px;object-fit:cover;border-radius:9px;border:1px solid rgba(255,255,255,.18);')} />
              <span style={css('font-size:.78rem;color:rgba(245,250,255,.72);')}>
                {media.pendingImage.isVideo ? 'فریمِ ویدیو پیوست شد' : 'تصویر پیوست شد'}
              </span>
              <HoverButton
                onClick={() => media.clear()}
                aria-label="حذف تصویر"
                styleStr="width:26px;height:26px;display:grid;place-items:center;border-radius:8px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.18);"
                hoverStr="background:rgba(255,255,255,.18);"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
              </HoverButton>
            </div>
          )}
          <div style={css('display:flex;align-items:flex-end;gap:6px;')}>
            <input ref={media.fileRef} type="file" accept="image/*" onChange={media.onPickImage} style={css('display:none;')} />
            <input ref={media.videoRef} type="file" accept="video/*" onChange={media.onPickVideo} style={css('display:none;')} />
            <HoverButton
              onClick={() => media.openFile()}
              aria-label="پیوست تصویر"
              title="پیوست تصویر"
              styleStr="flex:none;width:42px;height:42px;display:grid;place-items:center;border-radius:13px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);transition:all .18s ease;"
              hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);color:#fff;"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3.5" y="5" width="17" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="8.5" cy="9.5" r="1.6" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 16.5l4.5-4 3 2.6 3.5-3.3L20 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </HoverButton>
            <HoverButton
              onClick={() => media.openVideo()}
              aria-label="پیوست ویدیو"
              title="پیوست ویدیو"
              styleStr="flex:none;width:42px;height:42px;display:grid;place-items:center;border-radius:13px;cursor:pointer;color:#cfe1ff;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.18);transition:all .18s ease;"
              hoverStr="background:rgba(22,122,254,.18);border-color:rgba(22,122,254,.6);color:#fff;"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
                <path d="M16 10l5-2.5v9L16 14" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </HoverButton>
            <button
              onClick={() => dictation.toggle()}
              aria-label="گفتن به‌جای نوشتن"
              title="گفتن به‌جای نوشتن"
              style={css(micBtnStyle(dictation.listening))}
            >
              {dictation.listening && (
                <span style={css('position:absolute;inset:-3px;border-radius:14px;border:2px solid rgba(255,80,80,.55);animation:mrcRing 1.1s ease-out infinite;pointer-events:none;')} />
              )}
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={css('position:relative;z-index:1;')}>
                <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
                <path d="M6 11a6 6 0 0 0 12 0M12 17v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
            <textarea
              ref={taRef}
              value={input}
              onChange={onInput}
              onKeyDown={onKey}
              rows={1}
              placeholder={c.placeholder}
              style={css('flex:1;min-width:0;resize:none;max-height:160px;background:transparent;border:0;outline:none;color:#f7fbff;font-family:inherit;font-size:1rem;line-height:1.7;padding:8px 6px;')}
            />
            <HoverButton
              onClick={doSend}
              disabled={sendDisabled}
              aria-label="ارسال"
              styleStr="flex:none;width:44px;height:44px;display:grid;place-items:center;border-radius:14px;cursor:pointer;color:#fff;border:1px solid #167afe;background:linear-gradient(180deg,#2488ff,#1460ca);box-shadow:inset 0 0 40px rgba(21,21,29,.24);transition:all .2s ease;"
              hoverStr="filter:brightness(1.08);transform:translateY(-1px);"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M12 19V5M12 5l-6 6M12 5l6 6" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </HoverButton>
          </div>
        </div>
        <div style={css('margin-top:9px;text-align:center;font-size:.74rem;color:rgba(245,250,255,.42);')}>
          {settingsSummary} &middot; برای ارسال Enter بزن
        </div>
      </div>
    </div>
  )
}
