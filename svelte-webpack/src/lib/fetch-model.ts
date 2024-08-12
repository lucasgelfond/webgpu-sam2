import { currentStatus } from './current-status';

async function fetchModel(modelURL: string, modelName: string) {
  currentStatus.set(`Getting ${modelName} model...`);
  let cachedModel;

  try {
    const root = await navigator.storage.getDirectory();
    const modelFile = await root.getFileHandle(modelName, { create: false });
    cachedModel = await modelFile.getFile();
    console.log(`Found cached ${modelName} model`);
  } catch (error) {
    console.log(`No cached ${modelName} model. Error: ${error.message}`);
  }

  if (cachedModel) {
    console.log(`Using cached model for ${modelName}`);
    return cachedModel.arrayBuffer();
  } else {
    console.log(`Fetching model for ${modelName} from URL: ${modelURL}`);
    const fetchedModel = await innerFetchModel(modelURL, modelName);

    try {
      const root = await navigator.storage.getDirectory();
      const modelFile = await root.getFileHandle(modelName, { create: true });
      const writable = await modelFile.createWritable();
      await writable.write(fetchedModel);
      await writable.close();
      console.log(`Cached model for URL: ${modelURL}`);
    } catch (error) {
      console.error(`Failed to cache model for URL: ${modelURL}. Error: ${error.message}`);
    }

    return fetchedModel;
  }
}

async function innerFetchModel(modelURL: string, modelName: string) {
  currentStatus.set(`Fetching ${modelName} model..."`);
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
    const percentComplete = (receivedLength / totalSize) * 100;
    currentStatus.set(`Fetching ${modelName} model, ${percentComplete.toFixed(2)}%`);
  }

  const blob = new Blob([buffer], { type: 'application/octet-stream' });

  const arrayBuffer = await blob.arrayBuffer();
  return arrayBuffer;
}

export default fetchModel;
