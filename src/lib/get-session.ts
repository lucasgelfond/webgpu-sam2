// @ts-ignore
import * as ONNX_WEBGPU from 'onnxruntime-web/webgpu';
import fetchModel from './fetch-model';

const sessions = new Map<string, Promise<any>>();

type Options = { isEncoder: boolean; modelSize: string; onProgress?: (loaded: number) => void };

// Creating an InferenceSession is expensive, so each model is loaded once and reused.
function getSession({ isEncoder, modelSize, onProgress }: Options) {
  const key = `${isEncoder ? 'encoder' : 'decoder'}-${modelSize}`;
  if (!sessions.has(key)) {
    const session = fetchModel({ isEncoder, modelSize, onProgress }).then((model) =>
      ONNX_WEBGPU.InferenceSession.create(model, {
        executionProviders: ['webgpu'],
        ...(isEncoder && { graphOptimizationLevel: 'disabled' }),
      }),
    );
    session.catch(() => sessions.delete(key));
    sessions.set(key, session);
  }
  return sessions.get(key);
}

export default getSession;
