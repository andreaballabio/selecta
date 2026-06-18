/** Allowlist email admin. Configurabile via ADMIN_EMAILS (separate da virgola). */
export function adminEmails(): string[] {
  const env = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  // Fallback al proprietario se ADMIN_EMAILS non è impostata.
  return env.length ? env : ['andreaballabiomusic@gmail.com']
}

export function isAdminEmail(email?: string | null): boolean {
  return !!email && adminEmails().includes(email.toLowerCase())
}
