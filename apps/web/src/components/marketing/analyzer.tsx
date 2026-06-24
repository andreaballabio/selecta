'use client'

import { useRef, useState } from 'react'
import { Upload, ArrowRight, RotateCcw, Music2 } from 'lucide-react'

/* Analizzatore dell'hero — azione diretta:
   drag & drop reale di un file, click per sfogliare, o demo d'esempio.
   Stati: idle → run → done. Animazioni in CSS (affidabili, sempre visibili). */

const MATCHES: [string, number][] = [['Solid Grooves', 94], ['HOTTRAX', 88], ['Repopulate Mars', 81]]
type Status = 'idle' | 'run' | 'done'

export function Analyzer() {
  const [status, setStatus] = useState<Status>('idle')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('demo-track.wav')
  const inputRef = useRef<HTMLInputElement>(null)

  const start = (name: string) => {
    setFileName(name)
    setStatus('run')
    window.setTimeout(() => setStatus('done'), 1900)
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files?.[0]
    start(f ? f.name : 'demo-track.wav')
  }
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) start(f.name)
  }

  return (
    <div className="glass-liquid relative mx-auto w-full max-w-[560px] overflow-hidden rounded-[30px] p-2.5 text-left">
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onPick} />

      {/* ── IDLE ── */}
      {status === 'idle' && (
        <div
          className="a-in"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <div className={`flex cursor-pointer flex-col items-center gap-4 rounded-[22px] border-2 border-dashed px-6 py-12 text-center transition-all duration-300 ${
            dragging ? 'scale-[1.01] border-text/60 bg-text/[0.05]' : 'border-faint/30 hover:border-text/30'
          }`}>
            <span className={`glass flex h-16 w-16 items-center justify-center rounded-2xl text-text ${dragging ? '' : 'float'}`}>
              {dragging ? <Music2 className="h-7 w-7" /> : <Upload className="h-7 w-7" />}
            </span>
            <span>
              <span className="block text-base font-semibold text-text">{dragging ? 'Rilascia per analizzare' : 'Trascina qui la tua traccia'}</span>
              <span className="mt-1 block text-sm text-faint">MP3 · WAV · fino a 50 MB</span>
            </span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); start('demo-track.wav') }}
              className="glass glass-hover group/btn mt-1 inline-flex items-center gap-2 rounded-full px-6 py-3 text-[15px] font-semibold text-text"
            >
              Analizza una demo d’esempio
              <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-0.5" />
            </button>
          </div>
        </div>
      )}

      {/* ── RUN ── */}
      {status === 'run' && (
        <div className="a-in relative flex flex-col items-center gap-5 overflow-hidden px-6 py-14">
          <div className="pointer-events-none absolute inset-0">
            <div className="scan absolute inset-y-0 w-1/3" style={{ background: 'linear-gradient(90deg, transparent, var(--glass-hi), transparent)', opacity: 0.55 }} />
          </div>
          <div className="flex h-12 items-end gap-1.5">
            {[18, 32, 12, 36, 22, 40, 16, 30, 20].map((h, i) => (
              <span key={i} className="eq-bar w-1.5 rounded-full bg-text" style={{ height: h, animationDelay: `${i * 0.09}s` }} />
            ))}
          </div>
          <p className="text-sm text-muted">Leggo la firma timbrica di <span className="font-medium text-text">{fileName}</span>…</p>
          <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-surface-2">
            <div className="progress-fill h-full rounded-full bg-text" />
          </div>
        </div>
      )}

      {/* ── DONE ── */}
      {status === 'done' && (
        <div className="a-in px-3 pb-3 pt-4">
          <div className="mb-5 flex items-center justify-between">
            <p className="truncate font-mono text-xs uppercase tracking-[0.18em] text-muted">Suona come · <span className="text-text">{fileName}</span></p>
            <button onClick={() => setStatus('idle')} className="ml-3 inline-flex shrink-0 items-center gap-1 text-xs text-faint transition-colors hover:text-text">
              <RotateCcw className="h-3.5 w-3.5" /> Riprova
            </button>
          </div>
          <div className="space-y-4">
            {MATCHES.map(([name, pct], i) => (
              <div key={name} className="a-in" style={{ animationDelay: `${0.08 + i * 0.12}s` }}>
                <div className="mb-1.5 flex items-baseline justify-between">
                  <span className="font-medium">{name}</span>
                  <span className="font-mono text-sm text-muted">{pct}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                  <div className="bar-grow h-full rounded-full bg-text" style={{ width: `${pct}%`, animationDelay: `${0.12 + i * 0.12}s` }} />
                </div>
              </div>
            ))}
          </div>
          <button className="glass glass-hover group/cta a-in mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-[15px] font-semibold text-text" style={{ animationDelay: '0.45s' }}>
            Carica la tua traccia per il match reale
            <ArrowRight className="h-4 w-4 transition-transform group-hover/cta:translate-x-0.5" />
          </button>
        </div>
      )}
    </div>
  )
}
