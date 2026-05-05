import { timingSafeEqual } from 'node:crypto'

export function hasCloudSyncToken() {
  return Boolean(process.env.YURI_NEST_SYNC_TOKEN)
}

export function requireCloudAuth(request, response, next) {
  if (!shouldRequireCloudAuth()) {
    next()
    return
  }

  const failure = getCloudAuthFailure(request)
  if (failure) {
    response.status(failure.status).json({ error: failure.message })
    return
  }

  next()
}

export function shouldRequireCloudAuth() {
  return process.env.YURI_NEST_REQUIRE_CLOUD_AUTH === 'true'
}

export function shouldRequireModelAuth() {
  return process.env.YURI_NEST_REQUIRE_CHAT_AUTH === 'true'
}

export function getCloudAuthFailure(request) {
  const expectedToken = process.env.YURI_NEST_SYNC_TOKEN
  if (!expectedToken) {
    return { status: 503, message: 'Cloud sync is not configured on this server' }
  }

  if (!isSameToken(getProvidedCloudToken(request), expectedToken)) {
    return { status: 401, message: 'Cloud sync token is invalid' }
  }

  return null
}

function getProvidedCloudToken(request) {
  return request.get('x-yuri-nest-token') || request.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
}

function isSameToken(providedToken, expectedToken) {
  const provided = Buffer.from(String(providedToken))
  const expected = Buffer.from(String(expectedToken))
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}
