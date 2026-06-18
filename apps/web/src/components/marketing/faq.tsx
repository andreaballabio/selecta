'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'

const ITEMS = [
  { q: 'Quanto costa analizzare una traccia?', a: 'Niente. L’analisi del sound e il match con le label sono gratis — è il nostro gancio. Paghi solo se vuoi funzioni Pro (statistiche, featured, priorità di scouting).' },
  { q: 'Le percentuali di match sono reali?', a: 'Sì. Confrontiamo la firma timbrica della tua traccia con i cataloghi delle label via similarità sugli embedding audio. Niente “tutto al 100%”: la scala è assoluta e ti diciamo il perché di ogni match.' },
  { q: 'Cosa succede quando pubblico nel catalogo?', a: 'La traccia entra nella vetrina pubblica, raggruppata per come suona. DJ e label la ascoltano, mettono like e la salvano. Solo stream, niente download: i tuoi file restano tuoi.' },
  { q: 'Devo cedere i diritti della mia musica?', a: 'No. Concedi solo la licenza per ospitarla e farla ascoltare in streaming sulla piattaforma. Pubblichi solo tracce originali di cui sei l’autore.' },
  { q: 'Per chi è pensata Selecta?', a: 'Producer Tech House che vogliono capire dove possono firmare, farsi ascoltare dai DJ e costruire un’identità condivisibile (press kit) — e label/DJ che cercano sound nuovo curato per come suona.' },
  { q: 'Le label mi ascoltano davvero?', a: 'Il catalogo è curato per suono e leggibile dalle label per il loro stile: niente firehose. Più la tua traccia gira (ascolti, like, salvataggi), più emerge nelle classifiche che le label guardano.' },
]

export function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <div className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/40">
      {ITEMS.map((it, i) => {
        const isOpen = open === i
        return (
          <div key={i}>
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-surface-2/50"
              aria-expanded={isOpen}
            >
              <span className="font-medium text-text">{it.q}</span>
              <Plus className={`h-5 w-5 shrink-0 text-muted transition-transform duration-300 ${isOpen ? 'rotate-45 text-accent' : ''}`} />
            </button>
            <div className={`grid transition-all duration-300 ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-muted">{it.a}</p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
