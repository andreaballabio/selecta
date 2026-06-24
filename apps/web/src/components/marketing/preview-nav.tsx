import { ThemeToggle } from '@/components/ui/theme-toggle'

/** Nav glass condivisa per le pagine di confronto hero. */
export function PreviewNav({ label }: { label?: string }) {
  return (
    <>
      <div className="sticky top-4 z-40 px-4">
        <nav className="glass mx-auto flex max-w-[820px] items-center justify-between rounded-full py-2 pl-5 pr-2">
          <div className="flex items-center gap-2">
            <span className="flex items-end gap-[2px]">
              {[0, 1, 2].map((i) => <span key={i} className="eq-bar w-[3px] rounded-full bg-text" style={{ height: 13, animationDelay: `${i * 0.15}s` }} />)}
            </span>
            <span className="font-display text-[17px] font-semibold tracking-tight">Selecta</span>
          </div>
          <div className="hidden items-center gap-7 md:flex">
            <span className="text-[15px] font-medium text-muted">Catalogo</span>
            <span className="text-[15px] font-medium text-muted">Come funziona</span>
            <span className="text-[15px] font-medium text-muted">Prezzi</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button className="glass glass-hover rounded-full px-4 py-2 text-sm font-semibold text-text">Entra</button>
          </div>
        </nav>
      </div>
      {label && (
        <span className="pointer-events-none fixed left-1/2 top-[4.7rem] z-40 -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.25em] text-faint">{label}</span>
      )}
    </>
  )
}
