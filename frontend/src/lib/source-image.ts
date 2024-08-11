import { writable } from 'svelte/store';

export const sourceImage = writable<File | null>(null);
