declare const process: {
  env: Record<string, string | undefined>;
};

interface Window {
  crossOriginIsolated?: boolean;
}
