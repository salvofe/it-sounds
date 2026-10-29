import type { PreviewAnchor } from '@/store/gameStore'

export function anchorOf(el: Element): PreviewAnchor {
  const r = el.getBoundingClientRect()
  return { left: r.left, top: r.top, width: r.width, height: r.height }
}
