const { initializeApp } = require('firebase-admin/app')
const { getDatabase } = require('firebase-admin/database')
const { getFirestore } = require('firebase-admin/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')

initializeApp()
const db = getFirestore()
const realtime = getDatabase()

function requireUid(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.')
  return request.auth.uid
}

function inviteId(roomId, uid) { return `${roomId}_${uid}` }
function friendshipId(uidA, uidB) { return [uidA, uidB].sort().join('_') }
function mediaProvider(item) { return item.provider || 'youtube' }
function sameMedia(left, right) {
  const provider = mediaProvider(left)
  return provider === mediaProvider(right)
    && (provider === 'youtube' ? left.videoId === right.videoId : left.mediaUrl === right.mediaUrl)
}
function validateMedia(item) {
  const provider = mediaProvider(item)
  if (!['youtube', 'direct', 'embed'].includes(provider)) throw new HttpsError('invalid-argument', 'El tipo de contenido no es válido.')
  if (provider === 'youtube' && !item.videoId) throw new HttpsError('invalid-argument', 'Falta el video de YouTube.')
  if (provider !== 'youtube') {
    if (typeof item.mediaUrl !== 'string' || item.mediaUrl.length > 1000) throw new HttpsError('invalid-argument', 'El enlace multimedia no es válido.')
    try {
      const url = new URL(item.mediaUrl)
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('invalid URL')
    } catch { throw new HttpsError('invalid-argument', 'El enlace multimedia debe ser HTTPS.') }
  }
  return provider
}

async function requireFriend(uid, friendUid) {
  const friendship = await db.doc(`friendships/${friendshipId(uid, friendUid)}`).get()
  if (!friendship.exists || !friendship.data().memberUids?.includes(uid) || !friendship.data().memberUids?.includes(friendUid)) {
    throw new HttpsError('permission-denied', 'Solo puedes invitar a un amigo aceptado.')
  }
}

exports.createRoom = onCall(async (request) => {
  const uid = requireUid(request)
  const { video, inviteUid, queue = [], watchlistId, currentItemId } = request.data || {}
  if (!video?.title) throw new HttpsError('invalid-argument', 'Faltan los datos del video.')
  validateMedia(video)
  if (mediaProvider(video) === 'youtube' && !video.thumbnail) throw new HttpsError('invalid-argument', 'Falta la miniatura del video.')
  if (!Array.isArray(queue) || queue.length > 100) throw new HttpsError('invalid-argument', 'La cola no es válida.')
  if (inviteUid && inviteUid !== uid) await requireFriend(uid, inviteUid)
  let currentVideo = video
  let verifiedQueue = []
  if (watchlistId || currentItemId || queue.length) {
    if (!watchlistId || !currentItemId) throw new HttpsError('invalid-argument', 'La lista de origen no es válida.')
    const listSnapshot = await db.doc(`watchlists/${watchlistId}`).get()
    if (!listSnapshot.exists || !listSnapshot.data().memberUids?.includes(uid)) throw new HttpsError('permission-denied', 'No tienes acceso a esta lista.')
    for (const memberUid of listSnapshot.data().memberUids.filter((memberUid) => memberUid !== uid)) await requireFriend(uid, memberUid)
    const sourceSnapshot = await db.doc(`watchlists/${watchlistId}/videos/${currentItemId}`).get()
    if (!sourceSnapshot.exists || sourceSnapshot.data().status !== 'pending' || !sameMedia(sourceSnapshot.data(), video)) throw new HttpsError('failed-precondition', 'El video ya no está disponible en esa lista.')
    currentVideo = sourceSnapshot.data()
    const queueSnapshots = await Promise.all(queue.map(async (item) => {
      if (item.listId !== watchlistId || !item.itemId) throw new HttpsError('invalid-argument', 'La cola mezcla listas o videos inválidos.')
      const snapshot = await db.doc(`watchlists/${watchlistId}/videos/${item.itemId}`).get()
      if (!snapshot.exists || snapshot.data().status !== 'pending') throw new HttpsError('failed-precondition', 'Uno de los videos de la cola ya no está pendiente.')
      validateMedia(snapshot.data())
      return snapshot.data()
    }))
    verifiedQueue = queue.map((item, index) => ({ ...queueSnapshots[index], itemId: item.itemId, listId: watchlistId }))
  }
  const roomRef = db.collection('rooms').doc()
  const room = {
    ownerUid: uid,
    memberUids: [uid],
    invitedUids: inviteUid && inviteUid !== uid ? [inviteUid] : [],
    videoId: mediaProvider(currentVideo) === 'youtube' ? String(currentVideo.videoId).slice(0, 32) : '',
    mediaUrl: mediaProvider(currentVideo) === 'youtube' ? null : String(currentVideo.mediaUrl).slice(0, 1000),
    provider: mediaProvider(currentVideo),
    title: String(currentVideo.title).slice(0, 300),
    thumbnail: String(currentVideo.thumbnail).slice(0, 1000),
    queue: verifiedQueue.map((item) => ({ videoId: mediaProvider(item) === 'youtube' ? String(item.videoId).slice(0, 32) : '', mediaUrl: mediaProvider(item) === 'youtube' ? null : String(item.mediaUrl).slice(0, 1000), provider: mediaProvider(item), title: String(item.title).slice(0, 300), thumbnail: String(item.thumbnail || '').slice(0, 1000), itemId: String(item.itemId).slice(0, 128), listId: String(item.listId).slice(0, 128) })),
    watchlistId: watchlistId ? String(watchlistId).slice(0, 128) : null,
    currentItemId: currentItemId ? String(currentItemId).slice(0, 128) : null,
    createdAt: Date.now(),
    status: 'active',
  }
  const batch = db.batch()
  batch.set(roomRef, room)
  if (inviteUid && inviteUid !== uid) {
    const profile = await db.doc(`users/${uid}`).get()
    batch.set(db.doc(`roomInvites/${inviteId(roomRef.id, inviteUid)}`), {
      roomId: roomRef.id,
      fromUid: uid,
      toUid: inviteUid,
      fromName: profile.data()?.displayName || profile.data()?.username || 'Tu amigo',
      roomTitle: room.title,
      createdAt: Date.now(),
      status: 'pending',
    })
  }
  await batch.commit()
  await realtime.ref(`rooms/${roomRef.id}/members/${uid}`).set(true)
  await realtime.ref(`rooms/${roomRef.id}/state`).set({ videoId: room.videoId, mediaUrl: room.mediaUrl, provider: room.provider, playing: false, currentTime: 0, playbackRate: 1, updatedAt: Date.now(), updatedBy: uid })
  return { roomId: roomRef.id }
})

exports.advanceRoom = onCall(async (request) => {
  const uid = requireUid(request)
  const { roomId, currentItemId } = request.data || {}
  if (!roomId) throw new HttpsError('invalid-argument', 'Falta el identificador de la sala.')
  const roomRef = db.doc(`rooms/${roomId}`)
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists) throw new HttpsError('not-found', 'La sala ya no existe.')
    const room = snapshot.data()
    if (!room.memberUids.includes(uid)) throw new HttpsError('permission-denied', 'No perteneces a esta sala.')
    if (currentItemId && room.currentItemId !== currentItemId) return { changed: false, room }
    const next = room.queue?.[0]
    const currentRef = room.watchlistId && room.currentItemId ? db.doc(`watchlists/${room.watchlistId}/videos/${room.currentItemId}`) : null
    const nextRef = next ? db.doc(`watchlists/${next.listId}/videos/${next.itemId}`) : null
    const [currentVideo, nextVideo] = await Promise.all([
      currentRef ? transaction.get(currentRef) : Promise.resolve(null),
      nextRef ? transaction.get(nextRef) : Promise.resolve(null),
    ])
    if (currentRef && currentVideo?.exists) transaction.update(currentRef, { status: 'watched' })
    if (next && nextRef && nextVideo?.exists) {
      transaction.update(roomRef, {
        videoId: next.videoId,
        mediaUrl: next.mediaUrl || null,
        provider: mediaProvider(next),
        title: next.title,
        thumbnail: next.thumbnail,
        currentItemId: next.itemId,
        watchlistId: next.listId,
        queue: room.queue.slice(1),
      })
      return { changed: true, room: { ...room, ...next, provider: mediaProvider(next), currentItemId: next.itemId, watchlistId: next.listId, queue: room.queue.slice(1) } }
    }
    transaction.update(roomRef, { status: 'ended', queue: [], endedAt: Date.now() })
    return { changed: true, room: { ...room, status: 'ended' } }
  })
  if (result.changed) {
    const room = result.room
    await realtime.ref(`rooms/${roomId}/state`).set({ videoId: room.videoId, mediaUrl: room.mediaUrl, provider: room.provider, playing: false, currentTime: 0, playbackRate: 1, updatedAt: Date.now(), updatedBy: 'server' })
    await realtime.ref(`rooms/${roomId}/queue`).set(room.queue || [])
  }
  return { ended: result.room.status === 'ended' }
})

exports.inviteToRoom = onCall(async (request) => {
  const uid = requireUid(request)
  const { roomId, toUid } = request.data || {}
  if (!roomId || !toUid || uid === toUid) throw new HttpsError('invalid-argument', 'Invitación no válida.')
  await requireFriend(uid, toUid)
  const roomRef = db.doc(`rooms/${roomId}`)
  const inviteRef = db.doc(`roomInvites/${inviteId(roomId, toUid)}`)
  await db.runTransaction(async (transaction) => {
    const roomSnapshot = await transaction.get(roomRef)
    if (!roomSnapshot.exists) throw new HttpsError('not-found', 'La sala no existe.')
    const room = roomSnapshot.data()
    if (room.status !== 'active') throw new HttpsError('permission-denied', 'La sala ya no está activa.')
    if (!room.memberUids.includes(uid)) throw new HttpsError('permission-denied', 'No perteneces a esta sala.')
    if (room.memberUids.length + room.invitedUids.filter((id) => id !== toUid).length >= 2) throw new HttpsError('resource-exhausted', 'La sala ya tiene dos participantes o una invitación pendiente.')
    const profile = await transaction.get(db.doc(`users/${uid}`))
    transaction.update(roomRef, { invitedUids: [toUid] })
    transaction.set(inviteRef, { roomId, fromUid: uid, toUid, fromName: profile.data()?.displayName || profile.data()?.username || 'Tu amigo', roomTitle: room.title, createdAt: Date.now(), status: 'pending' })
  })
})

exports.removeFriend = onCall(async (request) => {
  const uid = requireUid(request)
  const { friendUid } = request.data || {}
  if (!friendUid || friendUid === uid) throw new HttpsError('invalid-argument', 'Amistad no válida.')
  const friendshipRef = db.doc(`friendships/${friendshipId(uid, friendUid)}`)
  const friendship = await friendshipRef.get()
  if (!friendship.exists || !friendship.data().memberUids?.includes(uid) || !friendship.data().memberUids?.includes(friendUid)) throw new HttpsError('not-found', 'Esta amistad ya no existe.')
  const [myLists, friendLists] = await Promise.all([
    db.collection('watchlists').where('ownerUid', '==', uid).get(),
    db.collection('watchlists').where('ownerUid', '==', friendUid).get(),
  ])
  const updates = [...myLists.docs, ...friendLists.docs].filter((list) => list.data().memberUids?.includes(uid) && list.data().memberUids?.includes(friendUid))
  for (let offset = 0; offset < updates.length; offset += 450) {
    const batch = db.batch()
    updates.slice(offset, offset + 450).forEach((list) => {
      const data = list.data()
      batch.update(list.ref, { memberUids: data.memberUids.filter((memberUid) => memberUid === data.ownerUid), shared: false })
    })
    await batch.commit()
  }
  const batch = db.batch()
  batch.delete(friendshipRef)
  if (friendship.data().requestId) batch.delete(db.doc(`friendRequests/${friendship.data().requestId}`))
  await batch.commit()
})

exports.respondRoomInvite = onCall(async (request) => {
  const uid = requireUid(request)
  const { inviteId: id, accept } = request.data || {}
  if (!id || typeof accept !== 'boolean') throw new HttpsError('invalid-argument', 'Respuesta no válida.')
  const inviteRef = db.doc(`roomInvites/${id}`)
  const inviteSnapshot = await inviteRef.get()
  if (!inviteSnapshot.exists || inviteSnapshot.data().toUid !== uid || inviteSnapshot.data().status !== 'pending') throw new HttpsError('permission-denied', 'La invitación ya no está disponible.')
  const roomRef = db.doc(`rooms/${inviteSnapshot.data().roomId}`)
  await db.runTransaction(async (transaction) => {
    const [currentInvite, roomSnapshot] = await Promise.all([transaction.get(inviteRef), transaction.get(roomRef)])
    if (!currentInvite.exists || currentInvite.data().status !== 'pending' || currentInvite.data().toUid !== uid) throw new HttpsError('failed-precondition', 'La invitación ya fue respondida.')
    if (!roomSnapshot.exists || roomSnapshot.data().status !== 'active') throw new HttpsError('failed-precondition', 'La sala ya terminó.')
    const room = roomSnapshot.data()
    if (accept) {
      if (!room.invitedUids.includes(uid) || room.memberUids.length >= 2) throw new HttpsError('resource-exhausted', 'La sala ya está completa.')
      transaction.update(roomRef, { memberUids: [...room.memberUids, uid], invitedUids: room.invitedUids.filter((id) => id !== uid) })
    } else {
      transaction.update(roomRef, { invitedUids: room.invitedUids.filter((id) => id !== uid) })
    }
    transaction.update(inviteRef, { status: accept ? 'accepted' : 'declined', respondedAt: Date.now() })
  })
  if (accept) await realtime.ref(`rooms/${inviteSnapshot.data().roomId}/members/${uid}`).set(true)
})

exports.joinRoom = onCall(async (request) => {
  const uid = requireUid(request)
  const { roomId } = request.data || {}
  if (!roomId) throw new HttpsError('invalid-argument', 'Falta el identificador de la sala.')
  const snapshot = await db.doc(`rooms/${roomId}`).get()
  if (!snapshot.exists || snapshot.data().status !== 'active' || !snapshot.data().memberUids.includes(uid)) throw new HttpsError('permission-denied', 'No tienes acceso a esta sala.')
  await realtime.ref(`rooms/${roomId}/members/${uid}`).set(true)
})

exports.leaveRoom = onCall(async (request) => {
  const uid = requireUid(request)
  const { roomId } = request.data || {}
  const roomRef = db.doc(`rooms/${roomId}`)
  let ended = false
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(roomRef)
    if (!snapshot.exists || !snapshot.data().memberUids.includes(uid)) return
    const room = snapshot.data()
    const memberUids = room.memberUids.filter((id) => id !== uid)
    ended = room.ownerUid === uid || memberUids.length === 0
    transaction.update(roomRef, { memberUids, status: ended ? 'ended' : room.status, endedAt: ended ? Date.now() : null })
  })
  await realtime.ref(`rooms/${roomId}/members/${uid}`).remove()
  if (ended) await realtime.ref(`rooms/${roomId}`).remove()
})

exports.measureLatency = onCall(async (request) => {
  requireUid(request)
  return { serverTime: Date.now() }
})
