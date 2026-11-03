const BASE_URL = 'https://sam2-model-download.b-cdn.net';
const FILE_SUFFIX = { encoder: 'encoder.with_runtime_opt.ort', decoder: 'decoder.onnx' };

type Options = { isEncoder: boolean; modelSize: string; onProgress?: (loaded: number) => void };

// Returns the model from the origin private file system, or downloads and caches it there.
async function fetchModel({ isEncoder, modelSize, onProgress }: Options) {
  const part = isEncoder ? 'encoder' : 'decoder';
  const name = `${part}-${modelSize}`;
  const root = await navigator.storage.getDirectory();

  try {
    const cached = await (await root.getFileHandle(name)).getFile();
    return cached.arrayBuffer();
  } catch {
    // Not cached yet.
  }

  const model = await download(`${BASE_URL}/sam2_hiera_${modelSize}.${FILE_SUFFIX[part]}`, onProgress);
  try {
    const writable = await (await root.getFileHandle(name, { create: true })).createWritable();
    await writable.write(model);
    await writable.close();
  } catch (error) {
    console.error(`Failed to cache ${name}: ${error}`);
  }
  return model;
}

async function download(url: string, onProgress?: (loaded: number) => void) {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error(`Downloading ${url} failed with HTTP ${response.status}`);

  const buffer = new Uint8Array(Number(response.headers.get('Content-Length')));
  const reader = response.body.getReader();
  let loaded = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer.set(value, loaded);
    loaded += value.length;
    onProgress?.(loaded);
  }
  return buffer.buffer;
}

export default fetchModel;
