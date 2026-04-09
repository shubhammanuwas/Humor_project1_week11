import { createSupabaseServerClient } from '@/lib/supabase/server'
import SignOutButton from './sign-out-button'
import { revalidatePath } from 'next/cache'
import CaptionPipeline from './caption-pipeline'

type CaptionRow = {
  [key: string]: string | number | boolean | null
}

type VoteDirection = 'up' | 'down'

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>

function getCaptionId(row: CaptionRow): string {
  const rawId = row.id ?? row.caption_id
  if (rawId === null || rawId === undefined) {
    return ''
  }
  return String(rawId)
}

function getCaptionText(row: CaptionRow): string {
  const textCandidates = [
    row.caption,
    row.text,
    row.content,
    row.body,
    row.caption_text,
  ]

  for (const value of textCandidates) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return JSON.stringify(row)
}

async function resolveProfileId(
  supabase: SupabaseClient,
  authUserId: string
): Promise<string> {
  const byUserId = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', authUserId)
    .limit(1)
    .maybeSingle()

  if (!byUserId.error && byUserId.data?.id) {
    return String(byUserId.data.id)
  }

  const byAuthUserId = await supabase
    .from('profiles')
    .select('id')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle()

  if (!byAuthUserId.error && byAuthUserId.data?.id) {
    return String(byAuthUserId.data.id)
  }

  return authUserId
}

async function insertVote(
  supabase: SupabaseClient,
  captionId: string,
  profileId: string,
  direction: VoteDirection
): Promise<{ success: boolean; errorMessage?: string }> {
  const payloads: Array<Record<string, string | number>> = [
    {
      caption_id: captionId,
      profile_id: profileId,
      created_by_user_id: profileId,
      modified_by_user_id: profileId,
      vote_value: direction === 'up' ? 1 : -1,
    },
    {
      caption_id: captionId,
      profile_id: profileId,
      created_by_user_id: profileId,
      modified_by_user_id: profileId,
      vote_value: direction === 'up' ? 1 : -1,
    },
    {
      caption_id: captionId,
      profile_id: profileId,
      created_by_user_id: profileId,
      modified_by_user_id: profileId,
      vote_value: direction === 'up' ? 'up' : 'down',
    },
    {
      caption_id: captionId,
      profile_id: profileId,
      created_by_user_id: profileId,
      modified_by_user_id: profileId,
      vote_value: direction === 'up' ? 'up' : 'down',
    },
  ]

  for (const payload of payloads) {
    const { error } = await supabase.from('caption_votes').insert(payload)
    if (!error) {
      return { success: true }
    }
  }

  const { error } = await supabase.from('caption_votes').insert({
    caption_id: captionId,
    profile_id: profileId,
    created_by_user_id: profileId,
    modified_by_user_id: profileId,
    vote_value: direction === 'up' ? 1 : -1,
  })

  return {
    success: false,
    errorMessage: error?.message ?? 'Unknown insert error',
  }
}

async function voteCaption(formData: FormData) {
  'use server'

  const captionId = String(formData.get('caption_id') ?? '')
  const direction = String(formData.get('direction') ?? '') as VoteDirection

  if (!captionId || (direction !== 'up' && direction !== 'down')) {
    return
  }

  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return
  }

  const profileId = await resolveProfileId(supabase, user.id)
  const result = await insertVote(supabase, captionId, profileId, direction)
  if (!result.success) {
    console.error('Vote insert error:', result.errorMessage)
    return
  }

  revalidatePath('/protected')
}

async function getCaptions() {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase.from('captions').select('*').limit(25)

  if (error) {
    console.error('Captions fetch error:', error.message)
    return []
  }

  return (data ?? []) as CaptionRow[]
}

export default async function ProtectedPage() {
  const supabase = createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const captions = await getCaptions()

  return (
    <main className="page-shell">
      <div className="page-grid protected-grid">
        <section className="panel stack-sm">
          <div className="hero-layout">
            <div className="stack-sm">
              <h1 className="title">Protected Workspace</h1>
              <p className="subtitle">
                Generate captions, review outputs, and rank the ones worth keeping.
              </p>
              <div className="hero-meta">
                <span className="pill pill-brand">Signed in</span>
                <span className="pill pill-accent mono">{user?.email ?? 'Unknown user'}</span>
              </div>
              <p className="section-note">
                Each vote writes a row into `caption_votes`, so this page doubles as your
                testing and ranking workspace.
              </p>
            </div>
            <div className="action-row">
              <SignOutButton />
            </div>
          </div>
          <div className="stat-grid workspace-stats">
            <div className="stat-card workspace-stat-card">
              <div className="stat-label">Caption feed</div>
              <div className="stat-value">{captions.length}</div>
            </div>
            <div className="stat-card workspace-stat-card">
              <div className="stat-label">Primary action</div>
              <div className="stat-value stat-text">Upload + Rank</div>
            </div>
            <div className="stat-card workspace-stat-card">
              <div className="stat-label">State</div>
              <div className="stat-value stat-text">Live</div>
            </div>
          </div>
        </section>

        <div className="workspace-columns">
          <div className="workspace-rail">
            <CaptionPipeline />
          </div>

          <section className="panel stack-sm workspace-feed">
            <div className="section-header">
              <div className="stack-sm section-tight">
                <h2 className="section-title">Caption Feed</h2>
                <p className="section-note">
                  Browse previously generated captions and give quick positive or negative
                  feedback.
                </p>
              </div>
              <span className="pill pill-brand">{captions.length} loaded</span>
            </div>
            <div className="soft-divider" />
            {captions.length === 0 ? (
              <p>No captions found (or access is blocked by RLS).</p>
            ) : (
              <ul className="list-reset caption-list">
                {captions.map((caption, idx) => {
                  const captionId = getCaptionId(caption)
                  const captionText = getCaptionText(caption)
                  const disabled = captionId.length === 0

                  return (
                    <li
                      key={`${captionId || 'missing-id'}-${idx}`}
                      className="card caption-card stack-sm"
                    >
                      <div className="caption-index-row">
                        <span className="caption-index">#{idx + 1}</span>
                      </div>
                      <p className="caption-text">{captionText}</p>
                      <div className="caption-actions">
                        <form action={voteCaption}>
                          <input type="hidden" name="caption_id" value={captionId} />
                          <input type="hidden" name="direction" value="up" />
                          <button type="submit" disabled={disabled} className="btn btn-upvote">
                            Upvote
                          </button>
                        </form>
                        <form action={voteCaption}>
                          <input type="hidden" name="caption_id" value={captionId} />
                          <input type="hidden" name="direction" value="down" />
                          <button type="submit" disabled={disabled} className="btn btn-downvote">
                            Downvote
                          </button>
                        </form>
                      </div>
                      {disabled ? (
                        <p className="status-error">
                          Missing caption id column (expected id or caption_id).
                        </p>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
