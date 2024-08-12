import { writable } from 'svelte/store';

const currentStatus = writable<string>('Upload an image to get started.');
export default currentStatus;
