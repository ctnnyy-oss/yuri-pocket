import type { AppView } from '../components/CharacterRail'

export const appViews: AppView[] = ['chat', 'role', 'group', 'moments', 'tasks', 'memory', 'world', 'model', 'settings', 'trash']

export function readViewFromLocation(): AppView {
  if (typeof window === 'undefined') return 'chat'

  const hashView = window.location.hash.replace(/^#\/?/, '')
  if (appViews.includes(hashView as AppView)) return hashView as AppView

  const queryView = new URLSearchParams(window.location.search).get('view')
  if (queryView && appViews.includes(queryView as AppView)) return queryView as AppView

  return 'chat'
}

export function buildViewUrl(view: AppView): string {
  const url = new URL(window.location.href)
  url.searchParams.delete('view')
  url.hash = view === 'chat' ? '' : view
  return `${url.pathname}${url.search}${url.hash}`
}
