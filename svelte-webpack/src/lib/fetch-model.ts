import { currentStatus } from './current-status';

async function fetchModel(modelURL: string, modelName: string) {
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
