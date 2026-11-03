import { get, writable } from 'svelte/store';

export type Source =
  | { kind: 'image'; name: string; image: ImageBitmap }
  | { kind: 'video'; name: string; url: string }
  | { kind: 'camera'; stream: MediaStream };

export const source = writable<Source | null>(null);

// Releases the previous source (camera tracks, object URL, bitmap) before switching.
export function setSource(next: Source | null) {
  const previous = get(source);
  if (previous?.kind === 'camera') previous.stream.getTracks().forEach((track) => track.stop());
  if (previous?.kind === 'video') URL.revokeObjectURL(previous.url);
  if (previous?.kind === 'image') previous.image.close();
  source.set(next);
}
