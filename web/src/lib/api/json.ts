export type JsonBodyResult<T> =
  | {
      ok: true
      body: T
    }
  | {
      ok: false
      error: 'invalid_json'
    }

export async function readJsonBody<T>(req: Request): Promise<JsonBodyResult<T>> {
  try {
    return {
      ok: true,
      body: (await req.json()) as T,
    }
  } catch {
    return {
      ok: false,
      error: 'invalid_json',
    }
  }
}
