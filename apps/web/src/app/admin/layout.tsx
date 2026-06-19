import { requireAdminPage } from '@/lib/require-admin'
import AdminShell from '@/components/admin/admin-shell'

// Le pagine admin leggono dati col service role: l'autorizzazione va verificata
// a ogni richiesta lato server. `force-dynamic` evita che il gate venga
// "congelato" in una pagina statica.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdminPage()
  return <AdminShell>{children}</AdminShell>
}
