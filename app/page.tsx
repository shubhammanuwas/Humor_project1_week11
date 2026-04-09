import { createSupabaseServerClient } from '@/lib/supabase/server'

type ShareRow = {
  profile_id: string | null
  share_to_destination_id: string | null
}

async function getShares(): Promise<ShareRow[]> {
  const supabase = createSupabaseServerClient()
  const { data, error } = await supabase
    .from('shares')
    .select('profile_id, share_to_destination_id')

  if (error) {
    console.error('Supabase error:', error.message)
    return []
  }

  return data ?? []
}

export default async function Home() {
  const shares = await getShares()

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel">
          <h1 className="title">Supabase Shares</h1>
          <p className="subtitle">Assignment #2 data read from the shares table.</p>
        </section>

        <section className="panel">
          {shares.length === 0 ? (
            <p>No rows found.</p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>profile_id</th>
                    <th>share_to_destination_id</th>
                  </tr>
                </thead>
                <tbody>
                  {shares.map((row, idx) => (
                    <tr key={`${row.profile_id ?? 'null'}-${idx}`}>
                      <td>{row.profile_id ?? 'null'}</td>
                      <td>{row.share_to_destination_id ?? 'null'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
