'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

const API_BASE_URL = 'https://api.almostcrackd.ai'

const SUPPORTED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
])

type CaptionRecord = Record<string, unknown>

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function pickCaptionText(record: CaptionRecord): string {
  const candidates = ['caption', 'text', 'content', 'body', 'caption_text']

  for (const key of candidates) {
    const value = record[key]
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }

  return JSON.stringify(record)
}

export default function CaptionPipeline() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [captions, setCaptions] = useState<CaptionRecord[]>([])
  const [lastImageId, setLastImageId] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const fileTypeValid = useMemo(() => {
    if (!file) {
      return true
    }
    return SUPPORTED_TYPES.has(file.type.toLowerCase())
  }, [file])

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreviewUrl(objectUrl)

    return () => {
      URL.revokeObjectURL(objectUrl)
    }
  }, [file])

  const runPipeline = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setCaptions([])
    setLastImageId(null)

    if (!file) {
      setErrorMessage('Select an image first.')
      return
    }

    if (!fileTypeValid) {
      setErrorMessage(`Unsupported file type: ${file.type}`)
      return
    }

    setIsLoading(true)

    try {
      const supabase = createSupabaseBrowserClient()
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError || !session?.access_token) {
        throw new Error('No valid auth token found. Sign in again.')
      }

      const token = session.access_token

      const step1Response = await fetch(`${API_BASE_URL}/pipeline/generate-presigned-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ contentType: file.type }),
      })

      const step1Data = (await parseJsonResponse(step1Response)) as {
        presignedUrl?: string
        cdnUrl?: string
      } | null

      if (!step1Response.ok || !step1Data?.presignedUrl || !step1Data.cdnUrl) {
        throw new Error(`Step 1 failed: ${step1Response.status}`)
      }

      const step2Response = await fetch(step1Data.presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      })

      if (!step2Response.ok) {
        throw new Error(`Step 2 failed: ${step2Response.status}`)
      }

      const step3Response = await fetch(`${API_BASE_URL}/pipeline/upload-image-from-url`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          imageUrl: step1Data.cdnUrl,
          isCommonUse: false,
        }),
      })

      const step3Data = (await parseJsonResponse(step3Response)) as {
        imageId?: string
      } | null

      if (!step3Response.ok || !step3Data?.imageId) {
        throw new Error(`Step 3 failed: ${step3Response.status}`)
      }

      setLastImageId(step3Data.imageId)

      const step4Response = await fetch(`${API_BASE_URL}/pipeline/generate-captions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageId: step3Data.imageId }),
      })

      const step4Data = await parseJsonResponse(step4Response)

      if (!step4Response.ok) {
        throw new Error(`Step 4 failed: ${step4Response.status}`)
      }

      const list = Array.isArray(step4Data)
        ? (step4Data as CaptionRecord[])
        : ((step4Data as { captions?: CaptionRecord[] } | null)?.captions ?? [])

      setCaptions(list)
      router.refresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setErrorMessage(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="panel stack-sm pipeline-panel">
      <div className="section-header">
        <h2 className="section-title">Generate Captions</h2>
        <span className="pill pill-accent">Upload an image to test the pipeline</span>
      </div>
      <p className="section-note">
        Supported formats: JPEG, JPG, PNG, WEBP, GIF, and HEIC.
      </p>
      <div className="pipeline-highlight">
        <div className="pipeline-highlight-label">Workflow</div>
        <div className="pipeline-highlight-text">
          Upload image, run the caption pipeline, then compare the results against the feed.
        </div>
      </div>
      <form onSubmit={runPipeline} className="stack-sm">
        <input
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic"
          className="file-input"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="status-pill">
            Selected file: <span className="mono">{file.name}</span>
          </div>
        ) : null}
        {previewUrl ? (
          <div className="image-preview-card">
            <div className="generated-caption-label">Selected image</div>
            <img src={previewUrl} alt="Uploaded preview" className="image-preview" />
          </div>
        ) : null}
        <button
          type="submit"
          disabled={isLoading || !file || !fileTypeValid}
          className="btn btn-primary"
        >
          {isLoading ? 'Processing...' : 'Upload And Generate Captions'}
        </button>
      </form>

      {!fileTypeValid ? (
        <p className="status-error">
          File type not supported. Use jpeg, jpg, png, webp, gif, or heic.
        </p>
      ) : null}

      {errorMessage ? (
        <div className="status-pill status-error">Error: {errorMessage}</div>
      ) : null}

      {lastImageId ? (
        <div className="status-pill generated-image-id">
          Image ID: <span className="mono">{lastImageId}</span>
        </div>
      ) : null}

      {captions.length > 0 ? (
        <div className="stack-sm">
          <div className="status-pill">
            Generated captions were added to the main caption feed below. You can vote on them
            there.
          </div>
          <ul className="list-reset stack-sm generated-list">
          {captions.map((record, index) => (
            <li key={`generated-caption-${index}`} className="card generated-caption-card">
              <div className="generated-caption-label">Generated #{index + 1}</div>
              <p className="caption-text">{pickCaptionText(record)}</p>
            </li>
          ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
