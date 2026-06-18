import { redirect } from 'next/navigation'

// Il catalogo è ora la "Library" (discover in stile streaming).
export default async function CatalogIndexRedirect({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { bucket } = await searchParams
  redirect(bucket ? `/library?bucket=${bucket}` : '/library')
}
