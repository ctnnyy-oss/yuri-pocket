export function registerPwa() {
  if (import.meta.env.DEV) return
  if (!('serviceWorker' in navigator)) return

  const baseUrl = normalizeBaseUrl(import.meta.env.BASE_URL)
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register(`${baseUrl}service-worker.js`, { scope: baseUrl }).catch(() => undefined)
  })
}

function normalizeBaseUrl(value: string) {
  if (!value) return '/'
  return value.endsWith('/') ? value : `${value}/`
}
