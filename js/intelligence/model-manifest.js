// One model for every browser/PWA surface. Eligibility depends on capabilities, never user agent.
// Artifact pins are an evaluation candidate, not device qualification.
export const MODEL_PROFILE = Object.freeze({
  id: 'smollm2-360m-eval', runtime: '@mlc-ai/web-llm@0.2.86', qualified: false,
  modelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
  weightsRevision: '3a622fd89e0216e8bb10c410c007c786baa8a033',
  libraryRevision: '00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0',
  model: 'https://huggingface.co/mlc-ai/SmolLM2-360M-Instruct-q4f16_1-MLC/resolve/3a622fd89e0216e8bb10c410c007c786baa8a033/',
  modelLib: 'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/00fe7a40e57e5e8eb9fef87526a4bf28ad5846c0/web-llm-models/v0_2_86/base/SmolLM2-360M-Instruct-q4f16_1_cs1k-webgpu.wasm',
  requiredFeatures: ['shader-f16'], registryVRAM_MB: 376.06, contextTokens: 1024, outputTokens: 128,
  artifactBytes: 213648914, // Weights, library, both cache manifests and published tokenizer files; excludes HTTP overhead/runtime JS.
  libraryBytes: 6408980, qualification: 'No physical device has been certified.',
  license: 'Apache-2.0 (SmolLM2); verify upstream artifact notices before redistribution.'
});
export function modelAppConfig(profile = MODEL_PROFILE) {
  if (profile !== MODEL_PROFILE) throw new Error('Only the shared model profile is supported.');
  return { model_list: [{ model_id: profile.modelId, model: profile.model, model_lib: profile.modelLib,
    required_features: [...profile.requiredFeatures], overrides: { context_window_size: profile.contextTokens } }] };
}
