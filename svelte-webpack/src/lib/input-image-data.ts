import { writable } from 'svelte/store';

const inputImageData = writable<ImageData>(null);
export default inputImageData;
