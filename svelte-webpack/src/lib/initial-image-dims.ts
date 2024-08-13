import { writable } from 'svelte/store';

export const initialImageDims = writable<[number, number]>([0, 0]);
