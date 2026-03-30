import { createClient, type SupabaseClient } from "@supabase/supabase-js"

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_API_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const SUPABASE_UPLOADS_BUCKET = "uploads"

export type UploadFileToSupabaseOptions = {
  file: File | Blob
  userId: string
  fileName?: string
  folder?: string
  bucket?: string
  cacheControl?: string
  upsert?: boolean
  supabaseClient?: SupabaseClient
}

export type UploadFileToSupabaseResult = {
  bucket: string
  path: string
  publicUrl: string
}

let supabaseClient: SupabaseClient | null = null

function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_API_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    )
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
  }

  return supabaseClient
}

function sanitizePathPart(value: string, fallback: string) {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9._-]/g, "-")
  return cleaned.length > 0 ? cleaned : fallback
}

function resolveFileName(file: File | Blob, fileName?: string) {
  if (fileName && fileName.trim().length > 0) {
    return fileName
  }

  if (typeof File !== "undefined" && file instanceof File && file.name) {
    return file.name
  }

  return "file"
}

export function buildUserScopedUploadPath(options: {
  userId: string
  fileName: string
  folder?: string
}) {
  const safeUserId = sanitizePathPart(options.userId, "unknown-user")
  const safeFileName = sanitizePathPart(options.fileName, "file")
  const safeFolder = options.folder
    ? sanitizePathPart(options.folder, "files")
    : undefined

  const uniquePrefix = `${Date.now()}-${crypto.randomUUID()}`
  return [safeUserId, safeFolder, `${uniquePrefix}-${safeFileName}`]
    .filter(Boolean)
    .join("/")
}

export async function uploadFileToSupabase(
  options: UploadFileToSupabaseOptions,
): Promise<UploadFileToSupabaseResult> {
  const {
    file,
    userId,
    folder,
    bucket = SUPABASE_UPLOADS_BUCKET,
    cacheControl = "3600",
    upsert = false,
    supabaseClient: injectedClient,
  } = options

  const fileName = resolveFileName(file, options.fileName)
  const path = buildUserScopedUploadPath({ userId, fileName, folder })
  const client = injectedClient ?? getSupabaseClient()
  const contentType = file.type || undefined

  const { data, error } = await client.storage.from(bucket).upload(path, file, {
    cacheControl,
    upsert,
    contentType,
  })

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`)
  }

  const { data: publicUrlData } = client.storage.from(bucket).getPublicUrl(data.path)

  return {
    bucket,
    path: data.path,
    publicUrl: publicUrlData.publicUrl,
  }
}
