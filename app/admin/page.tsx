import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import SignOutButton from '../protected/sign-out-button'
import SubmitButton from './submit-button'
import { getSuperadminActionContext, requireSuperadminPage } from '@/lib/admin/auth'

type GenericRow = Record<string, unknown>

type QueryParams = {
  success?: string | string[]
  error?: string | string[]
}

type AdminSupabaseClient = Awaited<ReturnType<typeof requireSuperadminPage>>['supabase']

type TableConfig = {
  key: string
  table: string
  title: string
  mode: 'read' | 'crud' | 'update'
  limit: number
  preferredColumns?: string[]
  description?: string
  createExample?: string
  updateExample?: string
  defaultIdColumn?: string
}

const IMAGE_ID_COLUMNS = ['id', 'image_id']
const IMAGE_URL_COLUMNS = ['url']

const TABLE_CONFIGS: TableConfig[] = [
  {
    key: 'profiles',
    table: 'profiles',
    title: 'Users / Profiles',
    mode: 'read',
    limit: 80,
    preferredColumns: ['id', 'email', 'first_name', 'last_name', 'is_superadmin'],
  },
  {
    key: 'images',
    table: 'images',
    title: 'Images',
    mode: 'crud',
    limit: 80,
    preferredColumns: ['id', 'url', 'profile_id', 'created_datetime_utc', 'additional_context'],
    description: 'Supports direct URL create or file upload to Supabase Storage.',
  },
  {
    key: 'humor_flavors',
    table: 'humor_flavors',
    title: 'Humor Flavors',
    mode: 'read',
    limit: 80,
    preferredColumns: ['id', 'slug', 'description', 'created_datetime_utc'],
  },
  {
    key: 'humor_flavor_steps',
    table: 'humor_flavor_steps',
    title: 'Humor Flavor Steps',
    mode: 'read',
    limit: 120,
    preferredColumns: ['id', 'humor_flavor_id', 'order_by', 'description', 'llm_model_id'],
  },
  {
    key: 'humor_mix',
    table: 'humor_flavor_mix',
    title: 'Humor Mix',
    mode: 'update',
    limit: 40,
    preferredColumns: ['id', 'humor_flavor_id', 'caption_count', 'created_datetime_utc'],
    description: 'Read existing rows and patch one record at a time with JSON.',
    updateExample: '{"caption_count":5}',
  },
  {
    key: 'terms',
    table: 'terms',
    title: 'Terms',
    mode: 'crud',
    limit: 80,
    preferredColumns: ['id', 'term', 'definition'],
    createExample: '{"term":"admin-test-term","definition":"created from admin","example":"admin example","priority":1}',
    updateExample: '{"definition":"updated from admin"}',
  },
  {
    key: 'captions',
    table: 'captions',
    title: 'Captions',
    mode: 'read',
    limit: 80,
    preferredColumns: ['id', 'content', 'profile_id', 'image_id', 'humor_flavor_id'],
  },
  {
    key: 'caption_requests',
    table: 'caption_requests',
    title: 'Caption Requests',
    mode: 'read',
    limit: 80,
    preferredColumns: ['id', 'profile_id', 'image_id', 'created_datetime_utc'],
  },
  {
    key: 'caption_examples',
    table: 'caption_examples',
    title: 'Caption Examples',
    mode: 'crud',
    limit: 80,
    preferredColumns: ['id', 'caption', 'image_description', 'explanation', 'priority'],
    createExample:
      '{"caption":"admin test caption","image_description":"brief scene description","explanation":"why this is funny","priority":0}',
    updateExample: '{"caption":"updated admin test caption"}',
  },
  {
    key: 'llm_models',
    table: 'llm_models',
    title: 'LLM Models',
    mode: 'crud',
    limit: 80,
    preferredColumns: ['id', 'name', 'llm_provider_id', 'provider_model_id', 'is_temperature_supported'],
    createExample:
      '{"name":"Admin Test Model","llm_provider_id":1,"provider_model_id":"admin-test-model","is_temperature_supported":true}',
    updateExample: '{"name":"Admin Test Model Updated"}',
  },
  {
    key: 'llm_providers',
    table: 'llm_providers',
    title: 'LLM Providers',
    mode: 'crud',
    limit: 80,
    preferredColumns: ['id', 'name', 'created_datetime_utc'],
    createExample: '{"name":"Admin Test Provider"}',
    updateExample: '{"name":"Admin Test Provider Updated"}',
  },
  {
    key: 'llm_prompt_chains',
    table: 'llm_prompt_chains',
    title: 'LLM Prompt Chains',
    mode: 'read',
    limit: 80,
    preferredColumns: ['id', 'caption_request_id', 'created_datetime_utc'],
  },
  {
    key: 'llm_responses',
    table: 'llm_model_responses',
    title: 'LLM Responses',
    mode: 'read',
    limit: 80,
  },
  {
    key: 'allowed_signup_domains',
    table: 'allowed_signup_domains',
    title: 'Allowed Signup Domains',
    mode: 'crud',
    limit: 80,
    preferredColumns: ['id', 'apex_domain', 'created_datetime_utc'],
    createExample: '{"apex_domain":"admin-test.edu"}',
    updateExample: '{"apex_domain":"updated-admin-test.edu"}',
  },
  {
    key: 'whitelisted_email_addresses',
    table: 'whitelist_email_addresses',
    title: 'Whitelisted E-mail Addresses',
    mode: 'crud',
    limit: 80,
    preferredColumns: ['id', 'email_address', 'created_datetime_utc'],
    createExample: '{"email_address":"admin-test@example.com"}',
    updateExample: '{"email_address":"updated-admin-test@example.com"}',
  },
]

function readMessage(value?: string | string[]) {
  if (Array.isArray(value)) {
    return value[0] ?? ''
  }
  return value ?? ''
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null'
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value)
    } catch {
      return '[object]'
    }
  }

  return String(value)
}

function summarizeCell(value: unknown) {
  const formatted = formatCell(value)
  const compact = formatted.replace(/\s+/g, ' ').trim()
  const isLong = compact.length > 120

  return {
    full: formatted,
    preview: isLong ? `${compact.slice(0, 117)}...` : compact,
    isLong,
    isEmpty: compact === 'null' || compact.length === 0,
  }
}

function collectColumns(rows: GenericRow[], preferred: string[] = []): string[] {
  const keys = new Set<string>()

  for (const column of preferred) {
    keys.add(column)
  }

  for (const row of rows.slice(0, 10)) {
    for (const key of Object.keys(row)) {
      keys.add(key)
    }
  }

  return Array.from(keys).slice(0, 10)
}

function uniquePayloads(items: GenericRow[]) {
  const seen = new Set<string>()
  const deduped: GenericRow[] = []

  for (const item of items) {
    const key = JSON.stringify(item)
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

function redirectWithStatus(kind: 'success' | 'error', message: string): never {
  const qs = new URLSearchParams({ [kind]: message })
  redirect(`/admin?${qs.toString()}`)
}

function parseJsonObject(raw: string, label: string): GenericRow {
  const trimmed = raw.trim()

  if (!trimmed) {
    return {}
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      throw new Error(`${label} must be a JSON object.`)
    }
    return parsed as GenericRow
  } catch (error) {
    const message = error instanceof Error ? error.message : `Invalid ${label}.`
    throw new Error(message)
  }
}

function withAuditFields(
  payload: GenericRow,
  profileId: string,
  mode: 'create' | 'update'
) {
  return {
    ...payload,
    ...(mode === 'create'
      ? {
          created_by_user_id: payload.created_by_user_id ?? profileId,
        }
      : {}),
    modified_by_user_id: payload.modified_by_user_id ?? profileId,
  }
}

function buildImagePayloadVariants(
  imageUrl: string,
  storagePath: string,
  extras: GenericRow,
  mode: 'create' | 'update',
  profileId: string
) {
  const variants: GenericRow[] = []

  for (const urlColumn of IMAGE_URL_COLUMNS) {
    const basePayload: GenericRow = { ...extras }
    if (imageUrl) {
      basePayload[urlColumn] = imageUrl
    }

    if (storagePath) {
      basePayload.additional_context =
        typeof basePayload.additional_context === 'string' && basePayload.additional_context.trim().length > 0
          ? `${basePayload.additional_context} | storage_path=${storagePath}`
          : `storage_path=${storagePath}`
    }

    variants.push(
      mode === 'create'
        ? withAuditFields(basePayload, profileId, 'create')
        : withAuditFields(basePayload, profileId, 'update')
    )
  }

  return uniquePayloads(variants)
}

async function createImageFromUrl(formData: FormData) {
  'use server'

  const auth = await getSuperadminActionContext()
  if ('error' in auth) {
    redirectWithStatus('error', auth.error)
  }

  const imageUrl = String(formData.get('image_url') ?? '').trim()
  if (!imageUrl) {
    redirectWithStatus('error', 'Image URL is required.')
  }

  const profileId = auth.context.profileId
  if (!profileId) {
    redirectWithStatus('error', 'Missing profiles.id for signed-in admin user.')
  }

  try {
    const extras = parseJsonObject(String(formData.get('record_payload') ?? ''), 'record payload')
    const payloads = buildImagePayloadVariants(imageUrl, '', extras, 'create', profileId)

    let lastError = 'Failed to create image.'
    for (const payload of payloads) {
      const { error } = await auth.context.supabase.from('images').insert(payload)
      if (!error) {
        revalidatePath('/admin')
        redirectWithStatus('success', 'Image created successfully.')
      }
      lastError = error.message
      console.error('Create image from URL failed:', payload, error.message)
    }

    redirectWithStatus('error', lastError)
  } catch (error) {
    redirectWithStatus('error', error instanceof Error ? error.message : 'Invalid image payload.')
  }
}

async function uploadImageAndCreateRecord(formData: FormData) {
  'use server'

  const auth = await getSuperadminActionContext()
  if ('error' in auth) {
    redirectWithStatus('error', auth.error)
  }

  const file = formData.get('image_file')
  const bucket = String(formData.get('bucket') ?? '').trim()
  const folder = String(formData.get('folder') ?? '').trim()

  if (!(file instanceof File) || file.size === 0) {
    redirectWithStatus('error', 'Select an image file to upload.')
  }

  if (!bucket) {
    redirectWithStatus('error', 'Storage bucket is required.')
  }

  const profileId = auth.context.profileId
  if (!profileId) {
    redirectWithStatus('error', 'Missing profiles.id for signed-in admin user.')
  }

  try {
    const extras = parseJsonObject(String(formData.get('record_payload') ?? ''), 'record payload')
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-')
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '')
    const storagePath = `${cleanFolder ? `${cleanFolder}/` : ''}${Date.now()}-${safeName}`

    const { error: uploadError } = await auth.context.supabase.storage
      .from(bucket)
      .upload(storagePath, file, {
        contentType: file.type || undefined,
        upsert: false,
      })

    if (uploadError) {
      redirectWithStatus('error', uploadError.message)
    }

    const { data: publicUrlData } = auth.context.supabase.storage.from(bucket).getPublicUrl(storagePath)
    const imageUrl = publicUrlData.publicUrl ?? ''
    const payloads = buildImagePayloadVariants(imageUrl, storagePath, extras, 'create', profileId)

    let lastError = 'Upload succeeded but image row insert failed.'
    for (const payload of payloads) {
      const { error } = await auth.context.supabase.from('images').insert(payload)
      if (!error) {
        revalidatePath('/admin')
        redirectWithStatus('success', 'Image uploaded and row created successfully.')
      }
      lastError = error.message
      console.error('Create image after upload failed:', payload, error.message)
    }

    redirectWithStatus('error', lastError)
  } catch (error) {
    redirectWithStatus('error', error instanceof Error ? error.message : 'Upload failed.')
  }
}

async function updateImage(formData: FormData) {
  'use server'

  const auth = await getSuperadminActionContext()
  if ('error' in auth) {
    redirectWithStatus('error', auth.error)
  }

  const imageId = String(formData.get('record_id') ?? '').trim()
  const idColumn = String(formData.get('id_column') ?? 'id').trim()

  if (!imageId) {
    redirectWithStatus('error', 'Image id is required for update.')
  }

  const profileId = auth.context.profileId
  if (!profileId) {
    redirectWithStatus('error', 'Missing profiles.id for signed-in admin user.')
  }

  try {
    const extras = parseJsonObject(String(formData.get('update_payload') ?? ''), 'update payload')
    const explicitUrl = typeof extras.url === 'string' ? String(extras.url) : ''
    const payloads = buildImagePayloadVariants(explicitUrl, '', extras, 'update', profileId)

    let lastError = 'Failed to update image.'
    for (const payload of payloads) {
      const { error } = await auth.context.supabase
        .from('images')
        .update(payload)
        .eq(idColumn || 'id', imageId)

      if (!error) {
        revalidatePath('/admin')
        redirectWithStatus('success', 'Image updated successfully.')
      }

      lastError = error.message
      console.error('Update image failed:', idColumn, imageId, payload, error.message)
    }

    redirectWithStatus('error', lastError)
  } catch (error) {
    redirectWithStatus('error', error instanceof Error ? error.message : 'Invalid update payload.')
  }
}

async function deleteImage(formData: FormData) {
  'use server'

  const auth = await getSuperadminActionContext()
  if ('error' in auth) {
    redirectWithStatus('error', auth.error)
  }

  const imageId = String(formData.get('record_id') ?? '').trim()
  const idColumn = String(formData.get('id_column') ?? '').trim()

  if (!imageId) {
    redirectWithStatus('error', 'Image id is required for delete.')
  }

  const candidateColumns = idColumn ? [idColumn] : IMAGE_ID_COLUMNS
  let lastError = 'Failed to delete image.'

  for (const candidateColumn of candidateColumns) {
    const { error } = await auth.context.supabase
      .from('images')
      .delete()
      .eq(candidateColumn, imageId)

    if (!error) {
      revalidatePath('/admin')
      redirectWithStatus('success', 'Image deleted successfully.')
    }

    lastError = error.message
    console.error('Delete image failed:', candidateColumn, imageId, error.message)
  }

  redirectWithStatus('error', lastError)
}

async function createGenericRow(formData: FormData) {
  'use server'

  const auth = await getSuperadminActionContext()
  if ('error' in auth) {
    redirectWithStatus('error', auth.error)
  }

  const table = String(formData.get('table') ?? '').trim()
  if (!table) {
    redirectWithStatus('error', 'Missing target table.')
  }

  const profileId = auth.context.profileId
  if (!profileId) {
    redirectWithStatus('error', 'Missing profiles.id for signed-in admin user.')
  }

  try {
    const payload = withAuditFields(
      parseJsonObject(String(formData.get('record_payload') ?? ''), 'record payload'),
      profileId,
      'create'
    )

    const { error } = await auth.context.supabase.from(table).insert(payload)
    if (error) {
      console.error('Generic create failed:', table, payload, error.message)
      redirectWithStatus('error', error.message)
    }

    revalidatePath('/admin')
    redirectWithStatus('success', `Created row in ${table}.`)
  } catch (error) {
    redirectWithStatus('error', error instanceof Error ? error.message : 'Invalid create payload.')
  }
}

async function updateGenericRow(formData: FormData) {
  'use server'

  const auth = await getSuperadminActionContext()
  if ('error' in auth) {
    redirectWithStatus('error', auth.error)
  }

  const table = String(formData.get('table') ?? '').trim()
  const idColumn = String(formData.get('id_column') ?? 'id').trim()
  const recordId = String(formData.get('record_id') ?? '').trim()

  if (!table || !recordId) {
    redirectWithStatus('error', 'Table and record id are required for update.')
  }

  const profileId = auth.context.profileId
  if (!profileId) {
    redirectWithStatus('error', 'Missing profiles.id for signed-in admin user.')
  }

  try {
    const payload = withAuditFields(
      parseJsonObject(String(formData.get('update_payload') ?? ''), 'update payload'),
      profileId,
      'update'
    )

    const { error } = await auth.context.supabase
      .from(table)
      .update(payload)
      .eq(idColumn || 'id', recordId)

    if (error) {
      console.error('Generic update failed:', table, idColumn, recordId, payload, error.message)
      redirectWithStatus('error', error.message)
    }

    revalidatePath('/admin')
    redirectWithStatus('success', `Updated row in ${table}.`)
  } catch (error) {
    redirectWithStatus('error', error instanceof Error ? error.message : 'Invalid update payload.')
  }
}

async function deleteGenericRow(formData: FormData) {
  'use server'

  const auth = await getSuperadminActionContext()
  if ('error' in auth) {
    redirectWithStatus('error', auth.error)
  }

  const table = String(formData.get('table') ?? '').trim()
  const idColumn = String(formData.get('id_column') ?? 'id').trim()
  const recordId = String(formData.get('record_id') ?? '').trim()

  if (!table || !recordId) {
    redirectWithStatus('error', 'Table and record id are required for delete.')
  }

  const { error } = await auth.context.supabase
    .from(table)
    .delete()
    .eq(idColumn || 'id', recordId)

  if (error) {
    console.error('Generic delete failed:', table, idColumn, recordId, error.message)
    redirectWithStatus('error', error.message)
  }

  revalidatePath('/admin')
  redirectWithStatus('success', `Deleted row from ${table}.`)
}

async function readTable(
  supabase: AdminSupabaseClient,
  table: string,
  limit: number
): Promise<{ rows: GenericRow[]; errorMessage: string }> {
  const { data, error } = await supabase.from(table).select('*').limit(limit)

  return {
    rows: (data ?? []) as GenericRow[],
    errorMessage: error?.message ?? '',
  }
}

function DataTable({
  title,
  rows,
  errorMessage,
  preferredColumns,
}: {
  title: string
  rows: GenericRow[]
  errorMessage: string
  preferredColumns?: string[]
}) {
  const allColumns = collectColumns(rows, preferredColumns)
  const columns = allColumns.slice(0, 5)
  const hiddenColumns = allColumns.filter((column) => !columns.includes(column))
  const rowLabel = `${rows.length} row${rows.length === 1 ? '' : 's'}`

  return (
    <section className="panel stack-sm admin-section">
      <div className="table-header-row">
        <h2 className="section-title">{title}</h2>
        <span className="table-count">{rowLabel}</span>
      </div>
      {errorMessage ? <p className="status-error">{errorMessage}</p> : null}
      {rows.length === 0 ? (
        <p>No rows returned.</p>
      ) : (
        <div className="table-wrap admin-table-shell">
          <table className="data-table admin-data-table">
            <thead>
              <tr>
                {columns.map((column) => (
                  <th key={`${title}-${column}`}>{column}</th>
                ))}
                {hiddenColumns.length > 0 ? <th key={`${title}-details`}>Details</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${title}-${index}`}>
                  {columns.map((column) => {
                    const cell = summarizeCell(row[column])

                    return (
                      <td key={`${title}-${column}-${index}`}>
                        <div className={`cell-chip ${cell.isEmpty ? 'cell-chip-muted' : ''}`}>
                          <span className="cell-preview" title={cell.full}>
                            {cell.preview}
                          </span>
                          {cell.isLong ? (
                            <details className="cell-details">
                              <summary>More</summary>
                              <pre className="cell-full mono">{cell.full}</pre>
                            </details>
                          ) : null}
                        </div>
                      </td>
                    )
                  })}
                  {hiddenColumns.length > 0 ? (
                    <td key={`${title}-details-${index}`}>
                      <details className="row-details">
                        <summary>{hiddenColumns.length} more field{hiddenColumns.length === 1 ? '' : 's'}</summary>
                        <div className="row-details-grid">
                          {hiddenColumns.map((column) => {
                            const cell = summarizeCell(row[column])

                            return (
                              <div key={`${title}-${column}-detail-${index}`} className="row-detail-card">
                                <p className="row-detail-label mono">{column}</p>
                                <pre className="row-detail-value mono">{cell.full}</pre>
                              </div>
                            )
                          })}
                        </div>
                      </details>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function JsonHint({ example }: { example: string }) {
  return <p className="form-hint mono">{example}</p>
}

function GenericCrudForms({ config }: { config: TableConfig }) {
  const createExample = config.createExample ?? '{"name":"Example"}'
  const updateExample = config.updateExample ?? '{"name":"Updated name"}'
  const defaultIdColumn = config.defaultIdColumn ?? 'id'

  return (
    <section className="panel stack-sm">
      <div className="stack-sm">
        <h2 className="section-title">{config.title} Controls</h2>
        {config.description ? <p className="subtitle admin-subtitle">{config.description}</p> : null}
      </div>

      <div className="admin-form-grid admin-form-grid-wide">
        {config.mode === 'crud' ? (
          <form action={createGenericRow} className="card stack-sm">
            <input type="hidden" name="table" value={config.table} />
            <h3 className="form-title">Create row</h3>
            <label className="stack-sm">
              <span>JSON payload</span>
              <textarea
                name="record_payload"
                className="input textarea"
                placeholder={createExample}
                required
              />
            </label>
            <JsonHint example={`Example: ${createExample}`} />
            <SubmitButton className="btn btn-primary" idleLabel="Create" pendingLabel="Creating..." />
          </form>
        ) : null}

        <form action={updateGenericRow} className="card stack-sm">
          <input type="hidden" name="table" value={config.table} />
          <h3 className="form-title">Update row</h3>
          <label className="stack-sm">
            <span>Record id</span>
            <input name="record_id" className="input" required />
          </label>
          <label className="stack-sm">
            <span>ID column</span>
            <input name="id_column" className="input" defaultValue={defaultIdColumn} />
          </label>
          <label className="stack-sm">
            <span>JSON patch payload</span>
            <textarea
              name="update_payload"
              className="input textarea"
              placeholder={updateExample}
              required
            />
          </label>
          <JsonHint example={`Example: ${updateExample}`} />
          <SubmitButton className="btn btn-primary" idleLabel="Update" pendingLabel="Updating..." />
        </form>

        {config.mode === 'crud' ? (
          <form action={deleteGenericRow} className="card stack-sm">
            <input type="hidden" name="table" value={config.table} />
            <h3 className="form-title">Delete row</h3>
            <label className="stack-sm">
              <span>Record id</span>
              <input name="record_id" className="input" required />
            </label>
            <label className="stack-sm">
              <span>ID column</span>
              <input name="id_column" className="input" defaultValue={defaultIdColumn} />
            </label>
            <SubmitButton className="btn btn-warn" idleLabel="Delete" pendingLabel="Deleting..." />
          </form>
        ) : null}
      </div>
    </section>
  )
}

function ImageCrudForms() {
  return (
    <section className="panel stack-sm">
      <div className="stack-sm">
        <h2 className="section-title">Images Controls</h2>
        <p className="subtitle admin-subtitle">
          Create by URL or upload a file to Supabase Storage, then update or delete rows from the
          <span className="mono"> images </span>
          table.
        </p>
      </div>

      <div className="admin-form-grid admin-form-grid-wide">
        <form action={createImageFromUrl} className="card stack-sm">
          <h3 className="form-title">Create from URL</h3>
          <label className="stack-sm">
            <span>Image URL</span>
            <input name="image_url" className="input" required placeholder="https://..." />
          </label>
          <label className="stack-sm">
            <span>Extra image row JSON</span>
            <textarea
              name="record_payload"
              className="input textarea"
              placeholder='{"profile_id":"...","additional_context":"optional note"}'
            />
          </label>
          <JsonHint example='Example: {"profile_id":"uuid","additional_context":"admin upload"}' />
          <SubmitButton className="btn btn-primary" idleLabel="Create" pendingLabel="Creating..." />
        </form>

        <form action={uploadImageAndCreateRecord} className="card stack-sm">
          <h3 className="form-title">Upload new image</h3>
          <label className="stack-sm">
            <span>Storage bucket</span>
            <input name="bucket" className="input" defaultValue="images" required />
          </label>
          <label className="stack-sm">
            <span>Folder (optional)</span>
            <input name="folder" className="input" placeholder="admin-uploads" />
          </label>
          <label className="stack-sm">
            <span>Image file</span>
            <input name="image_file" type="file" accept="image/*" className="file-input" required />
          </label>
          <label className="stack-sm">
            <span>Extra image row JSON</span>
            <textarea
              name="record_payload"
              className="input textarea"
              placeholder='{"profile_id":"...","additional_context":"optional note"}'
            />
          </label>
          <SubmitButton className="btn btn-primary" idleLabel="Upload" pendingLabel="Uploading..." />
        </form>

        <form action={updateImage} className="card stack-sm">
          <h3 className="form-title">Update image</h3>
          <label className="stack-sm">
            <span>Record id</span>
            <input name="record_id" className="input" required />
          </label>
          <label className="stack-sm">
            <span>ID column</span>
            <input name="id_column" className="input" defaultValue="id" />
          </label>
          <label className="stack-sm">
            <span>JSON patch payload</span>
            <textarea
              name="update_payload"
              className="input textarea"
              placeholder='{"url":"https://..."}'
              required
            />
          </label>
          <JsonHint example='Example: {"url":"https://...","additional_context":"updated note"}' />
          <SubmitButton className="btn btn-primary" idleLabel="Update" pendingLabel="Updating..." />
        </form>

        <form action={deleteImage} className="card stack-sm">
          <h3 className="form-title">Delete image</h3>
          <label className="stack-sm">
            <span>Record id</span>
            <input name="record_id" className="input" required />
          </label>
          <label className="stack-sm">
            <span>ID column (optional)</span>
            <input name="id_column" className="input" placeholder="id" />
          </label>
          <SubmitButton className="btn btn-warn" idleLabel="Delete" pendingLabel="Deleting..." />
        </form>
      </div>
    </section>
  )
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: QueryParams
}) {
  const admin = await requireSuperadminPage()

  const tableResults = await Promise.all(
    TABLE_CONFIGS.map((config) => readTable(admin.supabase, config.table, config.limit))
  )

  const resultsByKey = Object.fromEntries(
    TABLE_CONFIGS.map((config, index) => [config.key, tableResults[index]])
  ) as Record<string, { rows: GenericRow[]; errorMessage: string }>

  const successMessage = readMessage(searchParams?.success)
  const errorMessage = readMessage(searchParams?.error)

  const totalProfiles = resultsByKey.profiles.rows.length
  const totalImages = resultsByKey.images.rows.length
  const totalCaptions = resultsByKey.captions.rows.length
  const totalModels = resultsByKey.llm_models.rows.length
  const totalProviders = resultsByKey.llm_providers.rows.length
  const totalCaptionRequests = resultsByKey.caption_requests.rows.length
  const totalDomains = resultsByKey.allowed_signup_domains.rows.length
  const totalWhitelistedEmails = resultsByKey.whitelisted_email_addresses.rows.length

  const uniqueProfileIds = new Set(
    resultsByKey.images.rows
      .map((row) => row.profile_id)
      .filter((value) => typeof value === 'string' && value.length > 0)
  )

  return (
    <main className="page-shell">
      <div className="page-grid admin-page-grid">
        <section className="panel stack-sm admin-hero">
          <h1 className="title">Admin Control Room</h1>
          <p className="subtitle">
            Signed in as <span className="mono">{admin.userEmail ?? admin.userId}</span>
          </p>
          <p className="subtitle">
            Every route stays behind a login wall and only superadmins can access this page.
          </p>
          <div className="action-row">
            <SignOutButton />
            <Link className="btn btn-ghost" href="/protected">
              Back to Rating App
            </Link>
          </div>
          <div className="status-stack">
            {successMessage ? <p className="status-success status-pill">{successMessage}</p> : null}
            {errorMessage ? <p className="status-error status-pill">{errorMessage}</p> : null}
          </div>
        </section>

        <section className="panel">
          <h2 className="section-title">Stats Snapshot</h2>
          <div className="stat-grid">
            <article className="stat-card">
              <p className="stat-label">Profiles</p>
              <p className="stat-value">{totalProfiles}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Images</p>
              <p className="stat-value">{totalImages}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Captions</p>
              <p className="stat-value">{totalCaptions}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Contributors</p>
              <p className="stat-value">{uniqueProfileIds.size}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Caption requests</p>
              <p className="stat-value">{totalCaptionRequests}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">LLM models</p>
              <p className="stat-value">{totalModels}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">LLM providers</p>
              <p className="stat-value">{totalProviders}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Allowed domains</p>
              <p className="stat-value">{totalDomains}</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Whitelisted e-mails</p>
              <p className="stat-value">{totalWhitelistedEmails}</p>
            </article>
          </div>
        </section>

        <section className="panel stack-sm">
          <h2 className="section-title">Quick Notes</h2>
          <div className="notes-grid">
            <article className="note-card">
              <h3 className="form-title">JSON-powered CRUD</h3>
              <p className="subtitle admin-subtitle">
                Mutable tables use JSON payloads so the admin surface stays compatible with your
                exact schema.
              </p>
            </article>
            <article className="note-card">
              <h3 className="form-title">Images upload path</h3>
              <p className="subtitle admin-subtitle">
                Upload a file to a bucket, then the app inserts the matching row into
                <span className="mono"> images</span>.
              </p>
            </article>
            <article className="note-card">
              <h3 className="form-title">Update-only tables</h3>
              <p className="subtitle admin-subtitle">
                <span className="mono">humor_mix</span> is exposed as read/update only, matching the
                assignment requirements.
              </p>
            </article>
          </div>
        </section>

        <ImageCrudForms />

        {TABLE_CONFIGS.filter((config) => config.mode === 'crud' && config.table !== 'images').map(
          (config) => (
            <GenericCrudForms key={config.key} config={config} />
          )
        )}

        {TABLE_CONFIGS.filter((config) => config.mode === 'update').map((config) => (
          <GenericCrudForms key={config.key} config={config} />
        ))}

        {TABLE_CONFIGS.map((config) => (
          <DataTable
            key={config.key}
            title={`${config.title} (${config.mode === 'read' ? 'READ' : 'READ view'})`}
            rows={resultsByKey[config.key].rows}
            errorMessage={resultsByKey[config.key].errorMessage}
            preferredColumns={config.preferredColumns}
          />
        ))}
      </div>
    </main>
  )
}
