import currentStatus from './current-status';
import { setSource } from './source';

const DEMO_IMAGE_URL =
  'https://news.cgtn.com/news/78637a4e3251444d7759444f3567444d31557a4e31457a6333566d54/img/efd368233637445391bc04444d92249e/efd368233637445391bc04444d92249e.jpg';

export async function loadFile(file: File) {
  if (file.type.startsWith('video/')) {
    setSource({
      kind: 'video',
      name: file.name,
      url: URL.createObjectURL(file),
    });
  } else if (file.type.startsWith('image/')) {
    setSource({
      kind: 'image',
      name: file.name,
      image: await createImageBitmap(file),
    });
  } else {
    currentStatus.set(`${file.name} isn't an image or a video.`);
  }
}

export async function useWebcam() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 1024, height: 1024 },
    });
    setSource({ kind: 'camera', stream });
  } catch (error) {
    currentStatus.set(`Couldn't start the webcam: ${error}`);
  }
}

export async function useDemoImage() {
  const blob = await (await fetch(DEMO_IMAGE_URL)).blob();
  await loadFile(new File([blob], 'cheetah.jpg', { type: blob.type || 'image/jpeg' }));
}
