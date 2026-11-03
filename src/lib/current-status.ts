import { writable } from 'svelte/store';

const currentStatus = writable<string>('Open an image, a video, or your webcam to get started.');
export default currentStatus;
