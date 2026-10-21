// Development evaluations only. Same SmolLM2-360M base model, different quantization/runtime.
export const CPU_PROFILE = Object.freeze({
  id: 'smollm2-360m-cpu-q4km', backend: 'cpu', runtime: 'llama.cpp-b11799',
  runtimeURL: 'https://github.com/ggml-org/llama.cpp/releases/download/b11799/llama-b11799-bin-ubuntu-x64.tar.gz',
  runtimeSHA256: '4920c65448350c28f8ce7b35eec91566807e0f111c25a0df2d5fc12a1ed1716a',
  modelURL: 'https://huggingface.co/bartowski/SmolLM2-360M-Instruct-GGUF/resolve/7be6f65f1db715fe5dc5a4634c0d459b4eed42ec/SmolLM2-360M-Instruct-Q4_K_M.gguf',
  modelSHA256: '2fa3f013dcdd7b99f9b237717fa0b12d75bbb89984cc1274be1471a465bac9c2',
  contextTokens: 1024, maxTokens: 128, gpuLayers: 0, maxP95Ms: 5000
});
