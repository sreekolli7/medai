const VOYAGE_MODEL = 'voyage-3-lite' // 512 dimensions, matches content_chunks.embedding

export async function embed(texts: string[], inputType: 'query' | 'document'): Promise<number[][]> {
  const key = Deno.env.get('VOYAGE_API_KEY')
  if (!key) throw new Error('VOYAGE_API_KEY is not set')
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: texts, model: VOYAGE_MODEL, input_type: inputType }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Voyage error ${res.status}: ${await res.text()}`)
  const body = (await res.json()) as { data: { embedding: number[]; index: number }[] }
  return body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding)
}
