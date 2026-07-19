const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff]
const RIFF_SIGNATURE = [0x52, 0x49, 0x46, 0x46]
const WEBP_SIGNATURE = [0x57, 0x45, 0x42, 0x50]

function startsWithBytes(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value)
}

export function isSupportedScalpImageBytes(bytes: Uint8Array, contentType: string) {
  if (contentType === 'image/png') return bytes.length >= PNG_SIGNATURE.length && startsWithBytes(bytes, PNG_SIGNATURE)
  if (contentType === 'image/jpeg') return bytes.length > JPEG_SIGNATURE.length && startsWithBytes(bytes, JPEG_SIGNATURE)
  if (contentType === 'image/webp') {
    return bytes.length >= 12 && startsWithBytes(bytes, RIFF_SIGNATURE) && startsWithBytes(bytes, WEBP_SIGNATURE, 8)
  }
  return false
}
