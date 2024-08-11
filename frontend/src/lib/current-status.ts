import { writable } from 'svelte/store';

export const currentStatus = writable<string>('Upload an image to get started.');
