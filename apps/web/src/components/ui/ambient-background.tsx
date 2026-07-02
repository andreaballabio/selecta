/**
 * Sfondo ambient monocromo (orbi sfocati che derivano lentamente) da mettere
 * dietro le pagine app: dà al vetro (.glass) qualcosa da rifrangere, così il
 * design system dell'hero vale su tutto il sito. Fisso, dietro il contenuto,
 * niente interazioni. Rispetta prefers-reduced-motion (drift disattivato).
 */
export function AmbientBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="drift-a absolute -left-40 top-[-8rem] h-[38rem] w-[38rem] rounded-full blur-[130px]" style={{ background: 'radial-gradient(circle, var(--orb-1), transparent 70%)' }} />
      <div className="drift-b absolute right-[-10rem] top-[26%] h-[34rem] w-[34rem] rounded-full blur-[130px]" style={{ background: 'radial-gradient(circle, var(--orb-2), transparent 70%)' }} />
      <div className="drift-c absolute bottom-[-10rem] left-1/4 h-[30rem] w-[30rem] rounded-full blur-[130px]" style={{ background: 'radial-gradient(circle, var(--orb-1), transparent 70%)' }} />
    </div>
  )
}
