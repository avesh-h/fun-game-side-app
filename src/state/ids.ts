/**
 * Stable ids for players.
 *
 * Names are not usable as identity — two friends called Raj would collide, and
 * people rename themselves mid-session.
 */
export function makeId(): string {
  const webCrypto = globalThis.crypto
  // randomUUID needs a secure context, which a phone opening the app over plain
  // http on the house wifi will not have.
  if (webCrypto && typeof webCrypto.randomUUID === 'function') {
    return webCrypto.randomUUID()
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
