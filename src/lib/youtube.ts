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

export interface YouTubeVideo {
  videoId: string
  title: string
  thumbnail: string
  channelTitle: string
  viewCount: string
  publishedAt: string
  duration: string
}

type RawSnippet = {
  title?: string
  thumbnails?: { maxres?: { url?: string }; high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } }
  channelTitle?: string
  publishedAt?: string
}
type RawStatistics = { viewCount?: string }
type RawContentDetails = { duration?: string }

function parseDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!match) return ''
  const h = Number(match[1] || 0)
  const m = Number(match[2] || 0)
  const s = Number(match[3] || 0)
  if (h) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatViews(n: string): string {
  const num = parseInt(n, 10)
  if (isNaN(num)) return ''
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B vistas`
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M vistas`
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)}K vistas`
  return `${num} vistas`
}

function pickThumb(thumbnails: RawSnippet['thumbnails']): string {
  return thumbnails?.maxres?.url || thumbnails?.high?.url || thumbnails?.medium?.url || thumbnails?.default?.url || ''
}

function mapItem(item: { id?: string | { videoId?: string }; snippet?: RawSnippet; statistics?: RawStatistics; contentDetails?: RawContentDetails }): YouTubeVideo | null {
  const videoId = typeof item.id === 'string' ? item.id : item.id?.videoId
  if (!videoId) return null
  const s = item.snippet || {}
  return {
    videoId,
    title: s.title || `Video (${videoId})`,
    thumbnail: pickThumb(s.thumbnails) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    channelTitle: s.channelTitle || '',
    viewCount: formatViews(item.statistics?.viewCount || ''),
    publishedAt: s.publishedAt ? new Date(s.publishedAt).toLocaleDateString('es', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
    duration: parseDuration(item.contentDetails?.duration || ''),
  }
}

type ListResponse = {
  error?: { message?: string }
  items?: Array<{ id?: string | { videoId?: string }; snippet?: RawSnippet; statistics?: RawStatistics; contentDetails?: RawContentDetails }>
}

/** Fetch enriched details for a list of video IDs */
async function enrichVideos(ids: string[], apiKey: string): Promise<YouTubeVideo[]> {
  if (!ids.length) return []
  const params = new URLSearchParams({ part: 'snippet,statistics,contentDetails', id: ids.join(','), key: apiKey })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  const data = await res.json() as ListResponse
  if (!res.ok) throw new Error(data.error?.message || 'Error al cargar detalles.')
  return (data.items || []).flatMap((item) => { const v = mapItem(item); return v ? [v] : [] })
}

/** Search YouTube videos */
export async function searchYouTubeVideos(query: string, apiKey: string): Promise<YouTubeVideo[]> {
  const params = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '18', q: query, key: apiKey })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  const data = await res.json() as ListResponse
  if (!res.ok) throw new Error(data.error?.message || 'No se pudo buscar en YouTube.')
  const ids = (data.items || []).flatMap((item) => {
    const id = typeof item.id === 'string' ? item.id : item.id?.videoId
    return id ? [id] : []
  })
  return enrichVideos(ids, apiKey)
}

/** Fetch trending/popular videos */
export async function getTrendingVideos(apiKey: string, regionCode = 'MX'): Promise<YouTubeVideo[]> {
  const params = new URLSearchParams({ part: 'snippet,statistics,contentDetails', chart: 'mostPopular', maxResults: '18', regionCode, videoCategoryId: '1', key: apiKey })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  const data = await res.json() as ListResponse
  if (!res.ok) throw new Error(data.error?.message || 'No se pudo cargar tendencias.')
  return (data.items || []).flatMap((item) => { const v = mapItem(item); return v ? [v] : [] })
}

// Legacy compat export (used in older search)
export type YouTubeSearchResult = YouTubeVideo
