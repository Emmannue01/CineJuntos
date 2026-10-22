import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where, writeBatch, arrayUnion, arrayRemove,
} from 'firebase/firestore'
import { onValue, push, ref, remove, set, update } from 'firebase/database'
import { db } from '../firebase/firestore'
import { rtdb } from '../firebase/database'
import type { ChatMessage, Room, RoomInvite, RoomQueueEntry, UserProfile, VideoItem, Watchlist } from '../types'

export interface FriendRequest {
  id: string
  fromUid: string
  toUid: string
  status: 'pending' | 'accepted' | 'declined'
  createdAt: number
  sender?: UserProfile
  toUser?: UserProfile
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
  
  // Buscar por usernameLower (para coincidencia exacta de nombre de usuario)
  const usernameSnapshot = await getDocs(
    query(
      collection(db, 'users'),
      where('usernameLower', '>=', normalized),
      where('usernameLower', '<=', `${normalized}\uf8ff`),
      limit(12)
    )
  )
  
  const results = usernameSnapshot.docs.map((item) => item.data() as UserProfile).filter((profile) => profile.uid !== currentUid)
  
  // Si no hay resultados por username, buscar también por displayName
  if (results.length === 0) {
    const displayNameSnapshot = await getDocs(
      query(
        collection(db, 'users'),
        where('usernameLower', '>=', normalized.charAt(0)),
        where('usernameLower', '<=', `${normalized.charAt(0)}\uf8ff`),
        limit(24)
      )
    )
    const displayNameResults = displayNameSnapshot.docs
      .map((item) => item.data() as UserProfile)
      .filter((profile) => profile.uid !== currentUid)
      .filter((profile) => profile.displayName?.toLowerCase().includes(normalized))
    
    return displayNameResults.slice(0, 12)
  }
  
  return results
}

export function subscribeSentRequests(uid: string, callback: (requests: FriendRequest[]) => void) {
  return onSnapshot(query(collection(db, 'friendRequests'), where('fromUid', '==', uid), where('status', '==', 'pending')), async (snapshot) => {
    const requests = await Promise.all(snapshot.docs.map(async (item) => {
      const data = item.data() as { fromUid: string; toUid: string; status: string; createdAt: number }
      const recipient = await getDoc(doc(db, 'users', data.toUid))
      return { id: item.id, ...data, toUser: recipient.exists() ? recipient.data() as UserProfile : undefined } as FriendRequest
    }))
    callback(requests)
  })
}

export async function sendFriendRequest(fromUid: string, toUid: string) {
  if (fromUid === toUid) throw new Error('No puedes enviarte una solicitud a ti mismo.')
  const friendshipId = [fromUid, toUid].sort().join('_')
  if ((await getDoc(doc(db, 'friendships', friendshipId))).exists()) throw new Error('Ya son amigos.')
  const requestId = `${fromUid}_${toUid}`
  await setDoc(doc(db, 'friendRequests', requestId), { fromUid, toUid, status: 'pending', createdAt: Date.now() })
}

export async function cancelFriendRequest(requestId: string) {
  await deleteDoc(doc(db, 'friendRequests', requestId))
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
  const uid = (await import('../firebase/auth')).auth.currentUser?.uid
  if (!friendUid || friendUid === uid) throw new Error('Amistad no válida.')
  const friendshipRef = doc(db, `friendships/${[uid, friendUid].sort().join('_')}`)
  const friendshipSnap = await getDoc(friendshipRef)
  const friendshipData = friendshipSnap.data()
  if (!friendshipSnap.exists() || !friendshipData?.memberUids?.includes(uid) || !friendshipData.memberUids.includes(friendUid)) throw new Error('Esta amistad ya no existe.')

  const [myLists, friendLists] = await Promise.all([
    getDocs(query(collection(db, 'watchlists'), where('ownerUid', '==', uid))),
    getDocs(query(collection(db, 'watchlists'), where('ownerUid', '==', friendUid))),
  ])
  const updates = [...myLists.docs, ...friendLists.docs].filter((list) => list.data().memberUids?.includes(uid) && list.data().memberUids.includes(friendUid))
  for (let offset = 0; offset < updates.length; offset += 450) {
    const batch = writeBatch(db)
    updates.slice(offset, offset + 450).forEach((list) => {
      const data = list.data()
      batch.update(list.ref, { memberUids: data.memberUids.filter((memberUid: string) => memberUid === data.ownerUid), shared: false })
    })
    await batch.commit()
  }
  const batch = writeBatch(db)
  batch.delete(friendshipRef)
  if (friendshipData?.requestId) batch.delete(doc(db, `friendRequests/${friendshipData.requestId}`))
  await batch.commit()
}

export function subscribeWatchlists(uid: string, callback: (lists: Watchlist[]) => void) {
  return onSnapshot(query(collection(db, 'watchlists'), where('memberUids', 'array-contains', uid)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Watchlist))
  })
}

export async function createWatchlist(ownerUid: string, name: string, friendUid?: string, isPublic = false) {
  const memberUids = friendUid ? [ownerUid, friendUid].sort() : [ownerUid]
  const result = await addDoc(collection(db, 'watchlists'), { name: name.trim() || 'Nuestra lista', ownerUid, memberUids, shared: Boolean(friendUid), isPublic, createdAt: Date.now() })
  return result.id
}

export function subscribePublicWatchlists(uid: string, callback: (lists: Watchlist[]) => void) {
  return onSnapshot(query(collection(db, 'watchlists'), where('ownerUid', '==', uid), where('isPublic', '==', true)), (snapshot) => {
    callback(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as Watchlist))
  })
}

export async function toggleWatchlistPublic(listId: string, isPublic: boolean) {
  return updateDoc(doc(db, 'watchlists', listId), { isPublic })
}

export async function updateWatchlistName(listId: string, name: string) {
  return updateDoc(doc(db, 'watchlists', listId), { name: name.trim() || 'Mi lista' })
}

export async function deleteWatchlist(listId: string) {
  // Primero eliminar todos los videos de la lista
  const videosRef = collection(db, 'watchlists', listId, 'videos')
  const videosSnapshot = await getDocs(videosRef)
  const batch = writeBatch(db)
  videosSnapshot.docs.forEach(doc => batch.delete(doc.ref))
  // Luego eliminar la lista
  batch.delete(doc(db, 'watchlists', listId))
  return batch.commit()
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

type RoomVideo = Pick<VideoItem, 'videoId' | 'mediaUrl' | 'provider' | 'title' | 'thumbnail'>

export async function createRoom(video: RoomVideo, inviteUid?: string, queue: RoomQueueEntry[] = [], watchlistId?: string, currentItemId?: string) {
  const roomId = Math.random().toString(36).substring(2, 10).toUpperCase()
  const uid = (await import('../firebase/auth')).auth.currentUser?.uid
  if (!uid) throw new Error('No hay sesión activa.')

  const room = {
    ownerUid: uid,
    memberUids: [uid],
    invitedUids: inviteUid && inviteUid !== uid ? [inviteUid] : [],
    videoId: video.provider === 'youtube' ? String(video.videoId ?? '').slice(0, 32) : '',
    mediaUrl: video.provider === 'youtube' ? null : String(video.mediaUrl ?? '').slice(0, 1000),
    provider: video.provider || 'embed',
    title: String(video.title ?? '').slice(0, 300),
    thumbnail: String(video.thumbnail ?? '').slice(0, 1000),
    queue: queue.map((item) => ({ videoId: item.provider === 'youtube' ? String(item.videoId ?? '').slice(0, 32) : '', mediaUrl: item.provider === 'youtube' ? null : String(item.mediaUrl ?? '').slice(0, 1000), provider: item.provider || 'embed', title: String(item.title ?? '').slice(0, 300), thumbnail: String(item.thumbnail || '').slice(0, 1000), itemId: String(item.itemId ?? '').slice(0, 128), listId: String(item.listId ?? '').slice(0, 128) })),
    watchlistId: watchlistId ? String(watchlistId).slice(0, 128) : null,
    currentItemId: currentItemId ? String(currentItemId).slice(0, 128) : null,
    createdAt: Date.now(),
    status: 'active',
  }

  await setDoc(doc(db, 'rooms', roomId), room)
  await set(ref(rtdb, `rooms/${roomId}/members/${uid}`), true)
  await set(ref(rtdb, `rooms/${roomId}/state`), { videoId: room.videoId, mediaUrl: room.mediaUrl, provider: room.provider, playing: false, currentTime: 0, playbackRate: 1, updatedAt: Date.now(), updatedBy: uid })
  return roomId
}

export async function advanceRoom(roomId: string, currentItemId?: string) {
  const roomRef = doc(db, 'rooms', roomId)
  const uid = (await import('../firebase/auth')).auth.currentUser?.uid
  if (!uid) throw new Error('No hay sesión activa.')

  const result = await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists()) throw new Error('La sala ya no existe.')
    const room = snapshot.data() as Room
    if (!(room.memberUids ?? []).includes(uid)) throw new Error('No perteneces a esta sala.')
    if (currentItemId && room.currentItemId !== currentItemId) return { changed: false, room }
    const next = (room.queue ?? [])[0]
    if (!next) {
      transaction.update(roomRef, { status: 'ended', queue: [], endedAt: Date.now() })
      await set(ref(rtdb, `rooms/${roomId}/state`), { videoId: room.videoId, mediaUrl: room.mediaUrl, provider: room.provider, playing: false, currentTime: 0, playbackRate: 1, updatedAt: Date.now(), updatedBy: uid })
      await set(ref(rtdb, `rooms/${roomId}/queue`), room.queue || [])
      return { changed: true, room: { ...room, status: 'ended' } }
    }
    const nextRef = doc(db, `watchlists/${next.listId}/videos/${next.itemId}`)
    const [currentVideo, nextVideo] = await Promise.all([
      room.watchlistId && room.currentItemId ? transaction.get(doc(db, `watchlists/${room.watchlistId}/videos/${room.currentItemId}`)) : Promise.resolve(null),
      transaction.get(nextRef),
    ])
    if (room.watchlistId && room.currentItemId && currentVideo?.exists()) transaction.update(currentVideo.ref, { status: 'watched' })
    if (next && nextRef && nextVideo?.exists()) {
      transaction.update(roomRef, {
        videoId: next.videoId,
        mediaUrl: next.mediaUrl || null,
        provider: mediaProvider(next),
        title: next.title,
        thumbnail: next.thumbnail,
        currentItemId: next.itemId,
        watchlistId: next.listId,
        queue: (room.queue ?? []).slice(1),
      })
      await set(ref(rtdb, `rooms/${roomId}/state`), { videoId: next.videoId, mediaUrl: next.mediaUrl || null, provider: mediaProvider(next), playing: false, currentTime: 0, playbackRate: 1, updatedAt: Date.now(), updatedBy: uid })
      await set(ref(rtdb, `rooms/${roomId}/queue`), (room.queue ?? []).slice(1))
      return { changed: true, room: { ...room, ...next, provider: mediaProvider(next), currentItemId: next.itemId, watchlistId: next.listId, queue: (room.queue ?? []).slice(1) } }
    }
    transaction.update(roomRef, { status: 'ended', queue: [], endedAt: Date.now() })
    await set(ref(rtdb, `rooms/${roomId}/state`), { videoId: room.videoId, mediaUrl: room.mediaUrl, provider: room.provider, playing: false, currentTime: 0, playbackRate: 1, updatedAt: Date.now(), updatedBy: uid })
    await set(ref(rtdb, `rooms/${roomId}/queue`), room.queue || [])
    return { changed: true, room: { ...room, status: 'ended' } }
  })
  return { ended: result.room.status === 'ended' }
}

export async function inviteToRoom(roomId: string, toUid: string) {
  const uid = (await import('../firebase/auth')).auth.currentUser?.uid
  if (!uid || !roomId || !toUid || uid === toUid) throw new Error('Invitación no válida.')

  const roomRef = doc(db, 'rooms', roomId)
  const inviteRef = doc(db, `roomInvites/${roomId}_${toUid}`)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) throw new Error('La sala no existe.')
  const room = roomSnap.data() as Room
  if (room.status !== 'active') throw new Error('La sala ya no está activa.')
  if (!room.memberUids.includes(uid)) throw new Error('No perteneces a esta sala.')
  if ((room.memberUids ?? []).length + (room.invitedUids ?? []).filter((id) => id !== toUid).length >= 2) throw new Error('La sala ya tiene dos participantes o una invitación pendiente.')

  const profileSnap = await getDoc(doc(db, 'users', uid))
  const profile = profileSnap.exists() ? profileSnap.data() as UserProfile : null

  await updateDoc(roomRef, { invitedUids: arrayUnion(toUid) })
  await setDoc(inviteRef, {
    roomId,
    fromUid: uid,
    toUid,
    fromName: profile?.displayName || profile?.username || 'Tu amigo',
    roomTitle: room.title,
    createdAt: Date.now(),
    status: 'pending',
  })
}

export async function joinRoom(roomId: string, uid: string) {
  const roomRef = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists() || roomSnap.data().status !== 'active') throw new Error('La sala no existe o ya no está activa.')
  const room = roomSnap.data() as Room
  if (!room.memberUids.includes(uid) && !room.invitedUids.includes(uid)) throw new Error('No tienes acceso a esta sala.')

  await updateDoc(roomRef, {
    memberUids: arrayUnion(uid),
    invitedUids: arrayRemove(uid),
  })
  await set(ref(rtdb, `rooms/${roomId}/members/${uid}`), true)
}

export async function leaveRoom(roomId: string, uid: string) {
  const roomRef = doc(db, 'rooms', roomId)
  const roomSnap = await getDoc(roomRef)
  if (!roomSnap.exists()) return
  const room = roomSnap.data() as Room
  if (!room.memberUids.includes(uid)) return

  const memberUids = room.memberUids.filter((id) => id !== uid)
  const ended = memberUids.length === 0

  await updateDoc(roomRef, {
    memberUids,
    status: ended ? 'ended' : room.status,
    endedAt: ended ? Date.now() : null,
  })
  await remove(ref(rtdb, `rooms/${roomId}/members/${uid}`))
  if (ended) await remove(ref(rtdb, `rooms/${roomId}`))
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
  const uid = (await import('../firebase/auth')).auth.currentUser?.uid
  if (!uid || !inviteId || typeof accept !== 'boolean') throw new Error('Respuesta no válida.')

  const inviteRef = doc(db, `roomInvites/${inviteId}`)
  const roomRef = doc(db, 'rooms', inviteId.split('_')[0])

  await runTransaction(db, async (transaction) => {
    const [inviteSnap, roomSnap] = await Promise.all([transaction.get(inviteRef), transaction.get(roomRef)])
    if (!inviteSnap.exists() || inviteSnap.data().status !== 'pending' || inviteSnap.data().toUid !== uid) throw new Error('La invitación ya no está disponible.')
    const roomDoc = roomSnap
    if (!roomDoc.exists() || roomDoc.data().status !== 'active') throw new Error('La sala ya terminó.')
    const roomData = roomDoc.data() as Room
    if (accept) {
      if (!roomData.invitedUids.includes(uid) || roomData.memberUids.length >= 2) throw new Error('La sala ya está completa.')
      transaction.update(roomRef, { memberUids: [...roomData.memberUids, uid], invitedUids: roomData.invitedUids.filter((id) => id !== uid) })
    } else {
      transaction.update(roomRef, { invitedUids: roomData.invitedUids.filter((id) => id !== uid) })
    }
    transaction.update(inviteRef, { status: accept ? 'accepted' : 'declined', respondedAt: Date.now() })
  })

  if (accept) await set(ref(rtdb, `rooms/${inviteId.split('_')[0]}/members/${uid}`), true)
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
    videoId: video.videoId ?? '',
    mediaUrl: video.mediaUrl ?? null,
    provider: video.provider || 'embed',
    playing: true,
    currentTime: 0,
  })
}

export async function markRoomEnded(roomId: string) {
  await updateDoc(doc(db, 'rooms', roomId), { status: 'ended', endedAt: serverTimestamp() })
}

function mediaProvider(item: { provider?: string }): string {
  return item.provider || 'youtube'
}
