/**
 * Server instrumentation — runs once per server process boot.
 *
 * EDGE-SAFE SHELL ONLY: this file is compiled for BOTH the nodejs and edge
 * runtimes, so it must contain ZERO node: imports. All node-dependent logic
 * lives in ./instrumentation-node.ts and is dynamically imported only when
 * the runtime is actually nodejs (see that file's header for the full
 * t191 root-cause story of why this split matters).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerNode } = await import('./instrumentation-node')
    await registerNode()
  }
}
