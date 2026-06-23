import { getSessionUser } from '@/lib/session'
import { notFound } from 'next/navigation'
import DirectoryProfile from '@/components/admin/DirectoryProfile'

export default async function DirectoryProfilePage({ params }: { params: Promise<{ id: string }> }) {
  await getSessionUser() // 守衛：未登入自動導去 /login
  const { id } = await params
  const memberId = Number(id)
  if (!memberId) notFound()
  return <DirectoryProfile memberId={memberId} />
}
