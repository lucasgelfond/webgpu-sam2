import { currentStatus } from './current-status';

const BASE_URL = 'https://sam2-model-download.b-cdn.net';

const TINY = 'sam2_hiera_tiny';
const SMALL = 'sam2_hiera_small';
const BASE_PLUS = 'sam2_hiera_base_plus';
const ENCODER_END = 'encoder.with_runtime_opt.ort';
const DECODER_END = 'decoder.onnx';

async function fetchModel({ isEncoder, modelSize }) {
  const modelName = `${isEncoder ? 'encoder' : 'decoder'}`;
  const model = await fetchCachedModel(modelName, modelSize);
  return model;
}

// Check origin private file system to see if we have model - if not, fetch from internet
async function fetchCachedModel(modelName: string, modelSize: string) {
  currentStatus.set(`Getting ${modelName}-${modelSize} model...`);
  let cachedModel;

  // Look in origin private file system.
  try {
    const root = await navigator.storage.getDirectory();
    const modelFile = await root.getFileHandle(modelName, { create: false });
    cachedModel = await modelFile.getFile();
    console.log(`Found cached ${modelName}-${modelSize} model`);
  } catch (error) {
    console.log(`No cached ${modelName}-${modelSize} model. Error: ${error.message}`);
  }

  if (cachedModel) {
    console.log(`Using cached model for ${modelName}-${modelSize}`);
    return cachedModel.arrayBuffer();
  } else {
    console.log(`Fetching model for ${modelName}-${modelSize} from internet`);

    const fileEnd = `${modelName === 'encoder' ? ENCODER_END : DECODER_END}`;
    const size = modelSize === 'tiny' ? TINY : modelSize === 'small' ? SMALL : BASE_PLUS;
    const modelURL = `${BASE_URL}/${size}.${fileEnd}`;

    const fetchedModel = await fetchModelFromInternet(
      modelURL,
      // i.e. decoder-tiny
      `${modelName}-${modelSize}`,
    );

    try {
      const root = await navigator.storage.getDirectory();
      const modelFile = await root.getFileHandle(modelName, { create: true });
      const writable = await modelFile.createWritable();
      await writable.write(fetchedModel);
      await writable.close();
      console.log(`Cached model ${modelName}-${modelSize}`);
    } catch (error) {
      console.error(`Failed to cache ${modelName}-${modelSize}. Error: ${error.message}`);
    }

    return fetchedModel;
  }
}

async function fetchModelFromInternet(modelURL: string, modelName: string) {
  console.log(`Fetching ${modelName} model..."`);
  const response = await fetch(modelURL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    mode: 'cors',
    credentials: 'omit',
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const totalSize = Number(response.headers.get('Content-Length'));
  const buffer = new Uint8Array(totalSize);
  let receivedLength = 0;

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Failed to get reader for model stream');
  }
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer.set(value, receivedLength);
    receivedLength += value.length;

    // Download progress indicator

    // TK - progress indicator for models > 100mb
    // const percentComplete = (receivedLength / totalSize) * 100;
    // currentStatus.set(`Fetching ${modelName} model, ${percentComplete.toFixed(2)}%`);
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' });

  const arrayBuffer = await blob.arrayBuffer();
  return arrayBuffer;
}

export default fetchModel;
