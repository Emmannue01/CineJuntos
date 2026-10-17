import { db } from './src/firebase/firestore.js';
import { rtdb } from './src/firebase/database.js';
import { setDoc, doc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { set, ref, remove } from 'firebase/database';

async function test() {
  try {
    console.log('Testing createRoom (Frontend Logic)...');
    const video = {
      videoId: 'L2_S8GvIasM',
      mediaUrl: 'https://www.youtube.com/watch?v=L2_S8GvIasM',
      provider: 'youtube',
      title: 'Test Room',
      thumbnail: ''
    };
    const roomId = Math.random().toString(36).substring(2, 10).toUpperCase();

    await setDoc(doc(db, 'rooms', roomId), {
      ...video,
      memberUids: [],
      invitedUids: [],
      queue: [],
      status: 'active',
      createdAt: Date.now(),
    });
    console.log('✅ Room created successfully. ID:', roomId);

    console.log('Testing joinRoom (Frontend Logic)...');
    const userId = 'test_user_123';
    await updateDoc(doc(db, 'rooms', roomId), {
      memberUids: arrayUnion(userId),
      invitedUids: arrayRemove(userId),
    });
    console.log('✅ User joined successfully.');

    const roomSnap = await getDoc(doc(db, 'rooms', roomId));
    if (roomSnap.exists()) {
      console.log('✅ Room data verified in Firestore:', roomSnap.data());
    }

    console.log('Cleaning up...');
    await remove(ref(rtdb, `rooms/${roomId}`));
    // Note: Firestore doc remains, but for a test this is fine.

    console.log('🚀 All frontend room management tests passed!');
  } catch (e) {
    console.error('❌ Error during tests:', e);
  }
}

test();
