import type { MouseEvent } from 'react'

export function navigate(hash: string) {
  const target = hash.startsWith('#') ? hash : '#' + hash
  if (location.hash === target) return
  location.hash = target
  // Notify React in the initiating event, before the browser's deferred event.
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

export function navigateLink(event: MouseEvent<HTMLAnchorElement>) {
  if (
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  )
    return
  event.preventDefault()
  navigate(event.currentTarget.hash)
}
