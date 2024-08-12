import { currentStatus } from './current-status';

const baseURL =
  'https://raw.githubusercontent.com/lucasgelfond/webgpu-sam2/raw/main/svelte-webpack/models';

const TINY = 'sam2_hiera_tiny';
const SMALL = 'sam2_hiera_small';
const BASE_PLUS = 'sam2_hiera_base_plus';
const ENCODER_PART = 'encoder.with_runtime_opt.part';

// break some models up into 50mb chunks to subvert GitHub's 100mb file limit
const modelDictionary = {
  encoder: {
    tiny: {
      links: [`${TINY}.${ENCODER_PART}1.ort`, `${TINY}.${ENCODER_PART}2.ort`],
      fileTotalBytes: 134451120,
    },
    small: {
      links: [`${SMALL}.${ENCODER_PART}1.ort`, `${SMALL}.${ENCODER_PART}2.ort`],
      fileTotalBytes: 162929584,
    },
    base_plus: {
      links: [
        `${BASE_PLUS}.${ENCODER_PART}1.ort`,
        `${BASE_PLUS}.${ENCODER_PART}2.ort`,
        `${BASE_PLUS}.${ENCODER_PART}3.ort`,
        `${BASE_PLUS}.${ENCODER_PART}4.ort`,
      ],
      fileTotalBytes: 306394720,
    },
  },
  decoder: {
    tiny: {
      links: [`${TINY}.decoder.onnx`],
    },
    small: {
      links: [`${SMALL}.decoder.onnx`],
    },
    base_plus: {
      links: [`${BASE_PLUS}.decoder.onnx`],
    },
  },
};

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
    let fetchedModel;
    const modelLinks = modelDictionary[modelName][modelSize].links;
    if (modelLinks.length == 1) {
      fetchedModel = await fetchModelFromInternet(
        // i.e. https://github.com/lucasgelfond/webgpu-sam2/raw/main/svelte-webpack/models/sam2_hiera_tiny.decoder.onnx
        `${baseURL}/${modelLinks[0]}`,
        // i.e. decoder-tiny
        `{modelName}-${modelSize}`,
      );
    } else {
      console.log(`Fetching multi-part model for ${modelName}-${modelSize} from internet`);
      const totalBytes = modelDictionary[modelName][modelSize].fileTotalBytes;
      fetchedModel = new ArrayBuffer(totalBytes);
      let offset = 0;

      for (const link of modelLinks) {
        const partUrl = `${baseURL}/${link}`;
        const partData = await fetchModelFromInternet(partUrl, `${modelName}-${modelSize}-part`);

        new Uint8Array(fetchedModel).set(new Uint8Array(partData), offset);
        offset += partData.byteLength;

        console.log(`Fetched and appended part ${link}`);
      }
      console.log(`Completed fetching all parts for ${modelName}-${modelSize}`);
    }
    // Save to origin private file system
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
