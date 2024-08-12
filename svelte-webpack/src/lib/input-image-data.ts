import { writable } from 'svelte/store';

export const inputImageData = writable<ImageData | null>(null);
