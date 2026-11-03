import { writable } from 'svelte/store';

// Download sizes are encoder + decoder, from the CDN's Content-Length.
export const MODELS = [
  { value: 'tiny', label: 'Tiny', note: 'fastest, best for video', bytes: 134_451_120 + 20_639_800 },
  { value: 'small', label: 'Small', note: '', bytes: 162_929_584 + 20_639_800 },
  { value: 'base_plus', label: 'Base Plus', note: 'most accurate', bytes: 306_394_720 + 20_639_800 },
];

export const formatMB = (bytes: number) => `${Math.round(bytes / 1e6)} MB`;

const modelSize = writable<string>('tiny');
export default modelSize;
