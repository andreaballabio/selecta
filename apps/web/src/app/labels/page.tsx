import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchDirectory } from '@/lib/labels'
import { AppShell } from '@/components/app/app-shell'
import { LabelsExplorer, type DirLabel } from '@/components/labels/labels-explorer'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Label — Selecta' }

export default async function LabelsPage() {
  const sb = createAdminClient()
  const labels = await fetchDirectory(sb)

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold text-text">Label</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Scopri le etichette <strong className="text-text">per suono</strong>: difficoltà, apertura ai nuovi e dove mandare la demo.
            Tutto calcolato dai dati del catalogo, non da opinioni.
          </p>
        </header>
        <LabelsExplorer labels={labels as DirLabel[]} />
      </div>
    </AppShell>
  )
}
