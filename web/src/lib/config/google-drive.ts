export type GoogleDriveEnv = {
  clientEmail: string
  privateKey: string
  folderId: string
}

type GoogleDriveSettingsSource = {
  clientEmail?: string
  privateKey?: string
  folderId?: string
}

export function hasGoogleDriveEnv(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(
    env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim() &&
      env.GOOGLE_DRIVE_PRIVATE_KEY?.trim() &&
      env.GOOGLE_DRIVE_FOLDER_ID?.trim(),
  )
}

export function getGoogleDriveEnv(env: NodeJS.ProcessEnv = process.env): GoogleDriveEnv {
  const clientEmail = env.GOOGLE_DRIVE_CLIENT_EMAIL?.trim()
  const privateKeyRaw = env.GOOGLE_DRIVE_PRIVATE_KEY?.trim()
  const folderId = env.GOOGLE_DRIVE_FOLDER_ID?.trim()

  if (!clientEmail || !privateKeyRaw || !folderId) {
    throw new Error(
      'GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID are required for Google Drive storage.',
    )
  }

  return {
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
    folderId,
  }
}

export function hasGoogleDriveSettings(settings: GoogleDriveSettingsSource) {
  return Boolean(settings.clientEmail?.trim() && settings.privateKey?.trim() && settings.folderId?.trim())
}

export function getGoogleDriveEnvFromSettings(settings: GoogleDriveSettingsSource): GoogleDriveEnv {
  const clientEmail = settings.clientEmail?.trim()
  const privateKeyRaw = settings.privateKey?.trim()
  const folderId = settings.folderId?.trim()

  if (!clientEmail || !privateKeyRaw || !folderId) {
    throw new Error(
      'GOOGLE_DRIVE_CLIENT_EMAIL, GOOGLE_DRIVE_PRIVATE_KEY, and GOOGLE_DRIVE_FOLDER_ID are required for Google Drive storage.',
    )
  }

  return {
    clientEmail,
    privateKey: privateKeyRaw.replace(/\\n/g, '\n'),
    folderId,
  }
}
