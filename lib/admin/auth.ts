import { createSupabaseServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

type ProfileRow = {
  id?: string | null
  email?: string | null
  is_superadmin?: boolean | null
  [key: string]: unknown
}

type AdminContext = {
  supabase: ReturnType<typeof createSupabaseServerClient>
  userId: string
  userEmail: string | null
  profile: ProfileRow | null
  profileId: string | null
  isSuperadmin: boolean
}

async function getProfileByField(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  field: 'id' | 'email',
  value: string,
  requireSuperadmin = false
): Promise<ProfileRow | null> {
  let query = supabase
    .from('profiles')
    .select('*')
    .eq(field, value)
    .limit(1)
  if (requireSuperadmin) {
    query = query.eq('is_superadmin', true)
  }

  const { data, error } = await query.maybeSingle()

  if (error || !data) {
    return null
  }

  return data as ProfileRow
}

async function loadAdminContext(): Promise<AdminContext | null> {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  let profile = await getProfileByField(supabase, 'id', user.id, true)
  if (!profile && user.email) {
    profile = await getProfileByField(supabase, 'email', user.email, true)
  }
  if (!profile) {
    profile = await getProfileByField(supabase, 'id', user.id)
  }
  if (!profile && user.email) {
    profile = await getProfileByField(supabase, 'email', user.email)
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? null,
    profile,
    profileId: typeof profile?.id === 'string' ? profile.id : null,
    isSuperadmin: Boolean(profile?.is_superadmin),
  }
}

export async function requireSuperadminPage() {
  const context = await loadAdminContext()

  if (!context) {
    redirect('/login')
  }

  if (!context.isSuperadmin) {
    redirect('/protected')
  }

  return context
}

export async function getSuperadminActionContext(): Promise<
  { context: AdminContext } | { error: string }
> {
  const context = await loadAdminContext()

  if (!context) {
    return { error: 'Please sign in again.' }
  }

  if (!context.isSuperadmin) {
    return { error: 'Only superadmins can use admin actions.' }
  }

  if (!context.profileId) {
    return { error: 'Missing profiles.id for signed-in admin user.' }
  }

  return { context }
}
