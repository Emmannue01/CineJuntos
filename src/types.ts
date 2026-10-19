export interface UserProfile {
  uid: string
  username: string
  usernameLower: string
  displayName: string
  photoURL: string
  avatar: string
  bio: string
  createdAt?: unknown
}

export interface VideoItem {
  id: string
  videoId: string
  mediaUrl?: string
  provider?: 'youtube' | 'direct' | 'embed'
  title: string
  thumbnail: string
  addedBy: string
  addedAt: number
  status: 'pending' | 'watched'
  position: number
}

export interface Watchlist {
  id: string
  name: string
  ownerUid: string
  memberUids: string[]
  shared: boolean
  isPublic?: boolean
}

export interface Room {
  id: string
  ownerUid: string
  memberUids: string[]
  invitedUids: string[]
  videoId: string
  mediaUrl?: string
  provider?: 'youtube' | 'direct' | 'embed'
  title: string
  thumbnail: string
  queue?: RoomQueueEntry[]
  watchlistId?: string
  currentItemId?: string
  createdAt: number
  status: 'active' | 'ended'
}

export interface RoomQueueEntry {
  videoId: string
  mediaUrl?: string
  provider?: 'youtube' | 'direct' | 'embed'
  title: string
  thumbnail: string
  itemId: string
  listId: string
}

export interface RoomState {
  videoId: string
  mediaUrl?: string
  provider?: 'youtube' | 'direct' | 'embed'
  playing: boolean
  currentTime: number
  playbackRate: number
  updatedAt: number
  updatedBy: string
}

export interface ChatMessage {
  id: string
  uid: string
  username: string
  avatar: string
  text: string
  createdAt: number
  kind: 'message' | 'reaction'
}

export interface RoomInvite {
  id: string
  roomId: string
  fromUid: string
  toUid: string
  fromName: string
  fromAvatar: string
  roomTitle: string
  createdAt: number
  status: 'pending' | 'accepted' | 'declined'
}
