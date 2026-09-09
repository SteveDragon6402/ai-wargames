export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function withTimeoutFallback<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
  fallback: T
): Promise<T> {
  try {
    return await withTimeout(promise, ms, label);
  } catch (err) {
    console.error(`[secret-test] ${label}`, err);
    return fallback;
  }
}
