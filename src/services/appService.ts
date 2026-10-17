import { httpsCallable } from 'firebase/functions'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { onValue, push, ref, remove, set, update } from 'firebase/database'
import { db } from '../firebase/firestore'
import { functions } from '../firebase/functions'
import { rtdb } from '../firebase/database'
import type { ChatMessage, Room, RoomInvite, RoomQueueEntry, UserProfile, VideoItem, Watchlist } from '../types'

export interface FriendRequest {
  id: string
  fromUid: string
  toUid: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
  sender?: UserProfile
}

export function subscribeFriends(uid: string, callback: (profiles: UserProfile[]) => void) {
  return onSnapshot(query(collection(db, 'friendships'), where('memberUids', 'array-contains', uid)), async (snapshot) => {
    const profiles = await Promise.all(snapshot.docs.map(async (item) => {
      const friendUid = (item.data().memberUids as string[]).find((member) => member !== uid)
      if (!friendUid) return null
      const profile = await getDoc(doc(db, 'users', friendUid))
      return profile.exists() ? profile.data() as UserProfile : null
    }))
    callback(profiles.filter((profile): profile is UserProfile => profile !== null))
  })
}

export function subscribeRequests(uid: string, callback: (requests: FriendRequest[]) => void) {
  return onSnapshot(query(collection(db, 'friendRequests'), where('toUid', '==', uid), where('status', '==', 'pending')), async (snapshot) => {
    const requests = await Promise.all(snapshot.docs.map(async (item) => {
      const data = item.data()
      const sender = await getDoc(doc(db, 'users', data.fromUid))
      return { id: item.id, ...data, sender: sender.exists() ? sender.data() as UserProfile : undefined } as FriendRequest
    }))
    callback(requests)
  })
}

export async function searchUsers(term: string, currentUid: string) {
  const normalized = term.trim().toLowerCase().replace(/^@/, '')
  if (normalized.length < 2) return []
  const snapshot = await getDocs(query(collection(db, 'users'), where('usernameLower', '>=', normalized), where('usernameLower', '<=', `${normalized}\uf8ff`), limit(12)))
  return snapshot.docs.map((item) => item.data() as UserProfile).filter((profile) => profile.uid !== currentUid)
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  if (fromUid === toUid) throw new Error('No puedes enviarte una solicitud a ti mismo.')
  const friendshipId = [fromUid, toUid].sort().join('_')
  if ((await getDoc(doc(db, 'friendships', friendshipId))).exists()) throw new Error('Ya son amigos.')
  const requestId = `${fromUid}_${toUid}`
  await setDoc(doc(db, 'friendRequests', requestId), { fromUid, toUid, status: 'pending', createdAt: Date.now() })
}

export async function respondFriendRequest(request: FriendRequest, accept: boolean) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'friendRequests', request.id), { status: accept ? 'accepted' : 'declined', respondedAt: Date.now() })
  if (accept) {
    const friendshipId = [request.fromUid, request.toUid].sort().join('_')
    batch.set(doc(db, 'friendships', friendshipId), {
      memberUids: [request.fromUid, request.toUid].sort(),
      createdAt: Date.now(),
      requestId: request.id,
    })
  }
  await batch.commit()
}

export async function removeFriend(friendUid: string) {
  const callable = httpsCallable<{ friendUid: string }, void>(functions, 'removeFriend')
  await callable({ friendUid })
}

export function subscribeWatchlists(uid: string, callback: (lists: Watchlist[]) => void) {
  return onSnapshot(query(collection(db, 'watchlists'), where('memberUids', 'array-contains', uid)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Watchlist))
  })
}

export async function createWatchlist(ownerUid: string, name: string, friendUid?: string) {
  const memberUids = friendUid ? [ownerUid, friendUid].sort() : [ownerUid]
  const result = await addDoc(collection(db, 'watchlists'), { name: name.trim() || 'Nuestra lista', ownerUid, memberUids, shared: Boolean(friendUid), createdAt: Date.now() })
  return result.id
}

export function subscribeVideos(listId: string, callback: (videos: VideoItem[]) => void) {
  return onSnapshot(query(collection(db, 'watchlists', listId, 'videos'), orderBy('position', 'asc')), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as VideoItem))
  })
}

export async function addVideo(listId: string, video: Omit<VideoItem, 'id'>) {
  return addDoc(collection(db, 'watchlists', listId, 'videos'), video)
}

export async function updateVideo(listId: string, videoId: string, changes: Partial<VideoItem>) {
  return updateDoc(doc(db, 'watchlists', listId, 'videos', videoId), changes)
}

export async function deleteVideo(listId: string, videoId: string) {
  return deleteDoc(doc(db, 'watchlists', listId, 'videos', videoId))
}

export async function reorderVideos(listId: string, videos: VideoItem[]) {
  const batch = writeBatch(db)
  videos.forEach((video, position) => batch.update(doc(db, 'watchlists', listId, 'videos', video.id), { position }))
  await batch.commit()
}

export async function createRoom(video: Pick<VideoItem, 'videoId' | 'mediaUrl' | 'provider' | 'title' | 'thumbnail'>, inviteUid?: string, queue: RoomQueueEntry[] = [], watchlistId?: string, currentItemId?: string) {
  const callable = httpsCallable<{ video: typeof video; inviteUid?: string; queue: RoomQueueEntry[]; watchlistId?: string; currentItemId?: string }, { roomId: string }>(functions, 'createRoom')
  const result = await callable({ video, inviteUid, queue, watchlistId, currentItemId })
  return result.data.roomId
}

export async function advanceRoom(roomId: string, currentItemId?: string) {
  const callable = httpsCallable<{ roomId: string; currentItemId?: string }, { ended: boolean }>(functions, 'advanceRoom')
  return (await callable({ roomId, currentItemId })).data
}

export async function inviteToRoom(roomId: string, toUid: string) {
  const callable = httpsCallable<{ roomId: string; toUid: string }, void>(functions, 'inviteToRoom')
  await callable({ roomId, toUid })
}

export async function joinRoom(roomId: string) {
  const callable = httpsCallable<{ roomId: string }, void>(functions, 'joinRoom')
  await callable({ roomId })
}

export async function leaveRoom(roomId: string) {
  const callable = httpsCallable<{ roomId: string }, void>(functions, 'leaveRoom')
  await callable({ roomId })
}

export function subscribeRoom(roomId: string, callback: (room: Room | null) => void) {
  return onSnapshot(doc(db, 'rooms', roomId), (snapshot) => callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as Room : null))
}

export function subscribeMyRooms(uid: string, callback: (rooms: Room[]) => void) {
  return onSnapshot(query(collection(db, 'rooms'), where('memberUids', 'array-contains', uid), where('status', '==', 'active'), orderBy('createdAt', 'desc')), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Room))
  })
}

export function subscribeInvites(uid: string, callback: (invites: RoomInvite[]) => void) {
  return onSnapshot(query(collection(db, 'roomInvites'), where('toUid', '==', uid), where('status', '==', 'pending')), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as RoomInvite))
  })
}

export async function respondRoomInvite(inviteId: string, accept: boolean) {
  const callable = httpsCallable<{ inviteId: string; accept: boolean }, void>(functions, 'respondRoomInvite')
  await callable({ inviteId, accept })
}

export function subscribeRoomState(roomId: string, callback: (state: Record<string, unknown> | null) => void) {
  return onValue(ref(rtdb, `rooms/${roomId}/state`), (snapshot) => callback(snapshot.val()))
}

export async function writeRoomState(roomId: string, uid: string, state: Record<string, unknown>) {
  await set(ref(rtdb, `rooms/${roomId}/state`), { ...state, updatedAt: Date.now(), updatedBy: uid })
}

export function subscribeChat(roomId: string, callback: (messages: ChatMessage[]) => void) {
  return onValue(ref(rtdb, `rooms/${roomId}/chat`), (snapshot) => {
    const values = snapshot.val() as Record<string, Omit<ChatMessage, 'id'>> | null
    callback(values ? Object.entries(values).map(([id, value]) => ({ id, ...value })).sort((a, b) => a.createdAt - b.createdAt).slice(-100) : [])
  })
}

export async function sendChatMessage(roomId: string, message: Omit<ChatMessage, 'id'>) {
  const messageRef = push(ref(rtdb, `rooms/${roomId}/chat`))
  await set(messageRef, message)
}

export async function deleteRoom(roomId: string) {
  await remove(ref(rtdb, `rooms/${roomId}`))
}

export async function updateRoomQueue(roomId: string, uid: string, queue: VideoItem[]) {
  await update(ref(rtdb, `rooms/${roomId}`), { queue: queue.map(({ videoId, mediaUrl, provider, title, thumbnail }) => ({ videoId, mediaUrl, provider, title, thumbnail })), queueUpdatedBy: uid })
}

export async function updateRoomVideo(roomId: string, uid: string, video: Pick<VideoItem, 'videoId' | 'mediaUrl' | 'provider' | 'title' | 'thumbnail'>) {
  await writeRoomState(roomId, uid, {
    videoId: video.videoId,
    mediaUrl: video.mediaUrl,
    provider: video.provider,
    playing: true,
    currentTime: 0,
  })
}

export async function markRoomEnded(roomId: string) {
  await updateDoc(doc(db, 'rooms', roomId), { status: 'ended', endedAt: serverTimestamp() })
}
