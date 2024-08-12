import { writable } from 'svelte/store';

export const canvas = writable<HTMLCanvasElement | null>(null);
