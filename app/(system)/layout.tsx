import { getSessionUser } from '@/lib/session'
import { resolveRolePermissions } from '@/lib/platform-config'
import Sidebar from '@/components/Sidebar'
import TopBar from '@/components/TopBar'

export default async function SystemLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const perms = await resolveRolePermissions(user.companyId, user.roleCode)
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)' }}>
      <Sidebar roleCode={user.roleCode} visibleCodes={perms.visibleModuleCodes} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <TopBar user={user} />
        <main style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {children}
        </main>
      </div>
    </div>
  )
}
