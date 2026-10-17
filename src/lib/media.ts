import { extractYouTubeId, getYouTubeMetadata } from './youtube'
import type { VideoItem } from '../types'

export type MediaProvider = NonNullable<VideoItem['provider']>

export interface ParsedMediaLink {
  videoId: string
  mediaUrl: string
  provider: MediaProvider
  title: string
  thumbnail: string
}

const directMediaExtension = /\.(?:mp4|webm|ogv|ogg|mp3|m4a|wav|aac|mov)(?:$|\?)/i

export async function parseMediaLink(input: string): Promise<ParsedMediaLink | null> {
  let url: URL
  try { url = new URL(input.trim()) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  if (url.username || url.password) return null
  url.protocol = 'https:'
  const mediaUrl = url.toString()
  const youtubeId = extractYouTubeId(mediaUrl)
  if (youtubeId) {
    const metadata = await getYouTubeMetadata(youtubeId)
    return { videoId: youtubeId, mediaUrl, provider: 'youtube', ...metadata }
  }
  const isDirect = directMediaExtension.test(`${url.pathname}${url.search}`)
  const provider: MediaProvider = isDirect ? 'direct' : 'embed'
  const finalSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || url.hostname)
  const title = finalSegment.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[-_]+/g, ' ').trim() || url.hostname
  return { videoId: '', mediaUrl, provider, title, thumbnail: '' }
}

export function mediaEmbedUrl(mediaUrl: string, provider: MediaProvider) {
  if (provider !== 'embed') return mediaUrl
  try {
    const url = new URL(mediaUrl)
    const host = url.hostname.replace(/^www\./, '')
    const vimeoMatch = url.pathname.match(/(?:^|\/)video\/(\d+)|(?:^|\/)(\d{6,})(?:$|\/)/)
    if ((host === 'vimeo.com' || host === 'player.vimeo.com') && vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1] || vimeoMatch[2]}`
    }
  } catch { return mediaUrl }
  return mediaUrl
}