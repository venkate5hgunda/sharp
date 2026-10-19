// Deployment defaults. No query string, local storage, or vendor flag can enable these.
export const FEATURE_CONFIG_VERSION = 1;
export const FEATURES = Object.freeze({
  browserInference: false,
  remoteDeveloperTelemetry: false,
  remotePromptPayloads: false,
  remoteAppDiagnostics: false,
  experimentalGeneratedScoredItems: false
});
