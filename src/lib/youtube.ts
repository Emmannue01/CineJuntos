export function extractYouTubeId(input: string): string | null {
  try {
    const url = new URL(input.trim())
    const host = url.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') return url.pathname.slice(1).split('/')[0] || null
    if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(host)) {
      if (url.pathname === '/watch') return url.searchParams.get('v')
      const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)
      return match?.[1] || null
    }
  } catch {
    return null
  }
  return null
}

export async function getYouTubeMetadata(videoId: string) {
  const fallback = { title: `Video de YouTube (${videoId})`, thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` }
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&format=json`)
    if (!response.ok) return fallback
    const data = await response.json() as { title?: string; thumbnail_url?: string }
    return { title: data.title || fallback.title, thumbnail: data.thumbnail_url || fallback.thumbnail }
  } catch {
    return fallback
  }
}
