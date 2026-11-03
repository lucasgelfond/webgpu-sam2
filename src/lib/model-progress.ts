import { writable } from 'svelte/store';
import getSession from './get-session';
import { MODELS } from './model-size';

type Progress = { modelSize: string; loaded: number; total: number; ready: boolean; error?: string };

export const modelProgress = writable<Progress | null>(null);

// Downloads (or loads from cache) both models for a size and reports combined progress.
export function prepareModels(modelSize: string) {
  const total = MODELS.find((model) => model.value === modelSize).bytes;
  const loaded = { encoder: 0, decoder: 0 };
  const update = (patch: Partial<Progress>) =>
    modelProgress.update((progress) =>
      progress?.modelSize === modelSize ? { ...progress, ...patch } : progress,
    );

  modelProgress.set({ modelSize, loaded: 0, total, ready: false });
  const load = (part: 'encoder' | 'decoder') =>
    getSession({
      isEncoder: part === 'encoder',
      modelSize,
      onProgress: (bytes) => {
        loaded[part] = bytes;
        update({ loaded: loaded.encoder + loaded.decoder });
      },
    });

  Promise.all([load('encoder'), load('decoder')])
    .then(() => update({ loaded: total, ready: true }))
    .catch((error) => update({ error: String(error) }));
}
