import { httpsCallable } from 'firebase/functions';
import { functions } from './src/firebase/functions.js';

async function test() {
  try {
    const createRoom = httpsCallable(functions, 'createRoom');
    const result = await createRoom({
      video: {
        videoId: 'L2_S8GvIasM',
        mediaUrl: 'https://www.youtube.com/watch?v=L2_S8GvIasM',
        provider: 'youtube',
        title: 'Test Room',
        thumbnail: ''
      },
      queue: []
    });
    console.log('✅ Sala creada exitosamente. ID:', result.data.roomId);
  } catch (e) {
    console.error('❌ Error creando sala:', e.message);
  }
}

test();
