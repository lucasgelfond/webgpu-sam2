import { writable } from 'svelte/store';

const modelSize = writable<string>('base_plus');
export default modelSize;
