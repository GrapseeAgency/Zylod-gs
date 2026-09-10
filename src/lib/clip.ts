/**
 * Server-side CLIP image embeddings for true visual product search.
 *
 * Uses @huggingface/transformers with quantized CLIP ViT-B/32 — runs locally
 * via onnxruntime-node, no external API, no API key. The model downloads
 * (~50MB quantized) on first use and is cached by the library.
 *
 * We load AutoModel + AutoProcessor directly (not the pipeline): CLIPModel's
 * `image_embeds` output is the projected CLS embedding — the true CLIP
 * vector — and works with q8 weights where the pipeline pooler path fails.
 *
 * Embeddings are stored on products.embedding (JSON float array) with the
 * model tag in products.embeddingModel so a model swap invalidates the cache.
 */
import { CLIPVisionModelWithProjection, AutoProcessor, RawImage, env } from '@huggingface/transformers'

const CLIP_MODEL = 'Xenova/clip-vit-base-patch32'
const EMBEDDING_MODEL_TAG = 'clip-vit-base-patch32:q8:imgemb'

env.allowRemoteModels = true
env.allowLocalModels = false

interface LoadedClip {
  model: Awaited<ReturnType<typeof CLIPVisionModelWithProjection.from_pretrained>>
  processor: Awaited<ReturnType<typeof AutoProcessor.from_pretrained>>
}

let clipPromise: Promise<LoadedClip> | null = null

function getClip(): Promise<LoadedClip> {
  if (!clipPromise) {
    clipPromise = (async () => {
      const processor = await AutoProcessor.from_pretrained(CLIP_MODEL)
      const model = await CLIPVisionModelWithProjection.from_pretrained(CLIP_MODEL, { dtype: 'q8' })
      return { model, processor }
    })().catch(err => {
      clipPromise = null // allow retry on next request
      throw err
    })
  }
  return clipPromise
}

/**
 * Embed an image URL into a normalized 512-d CLIP vector.
 * Returns null when the model or image is unavailable (caller falls back).
 */
export async function embedImageUrl(url: string): Promise<number[] | null> {
  try {
    const { model, processor } = await getClip()

    const image = await RawImage.read(url)
    const inputs = await processor(image)
    const output = await model(inputs)
    const embeds = (output as unknown as { image_embeds: { data: Float32Array } }).image_embeds
    if (!embeds || !embeds.data || embeds.data.length === 0) return null

    // L2-normalize so cosine similarity == dot product
    const data = embeds.data
    let norm = 0
    for (let i = 0; i < data.length; i++) norm += data[i] * data[i]
    norm = Math.sqrt(norm)
    if (norm === 0) return null
    const vector = new Array<number>(data.length)
    for (let i = 0; i < data.length; i++) vector[i] = data[i] / norm
    return vector
  } catch (err) {
    console.error('CLIP embed failed:', err instanceof Error ? err.message : err)
    return null
  }
}

/** True when the CLIP model is usable in this process. */
export async function clipAvailable(): Promise<boolean> {
  try {
    await getClip()
    return true
  } catch (err) {
    console.error('CLIP unavailable:', err instanceof Error ? err.message : err)
    return false
  }
}

export { EMBEDDING_MODEL_TAG }

/** Cosine similarity for normalized vectors == dot product. */
export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < len; i++) dot += a[i] * b[i]
  return dot
}
