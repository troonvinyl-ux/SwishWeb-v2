import { COIN_ASSESSMENT_PROMPT, parseCoinAssessment } from './coinStudioAssessment.ts';
import type { CoinPairAssessment } from './coinStudioTypes.ts';
export const COIN_STUDIO_MODEL = 'google/gemini-3-flash-preview';
/** OnSpace AI supplies assessment, never pixel output. Existing BackgroundErase supplies segmentation alpha. */
export async function assessCoinPair(images: string[], signal: AbortSignal): Promise<CoinPairAssessment> {
  const apiKey = Deno.env.get('ONSPACE_AI_API_KEY'), baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');
  if (!apiKey || !baseUrl) throw new Error('Smart Studio quality assessment is not configured. Originals retained.');
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, { method: 'POST', signal, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: COIN_STUDIO_MODEL, temperature: 0, response_format: { type: 'json_object' }, max_tokens: 7000,
      messages: [{ role: 'system', content: COIN_ASSESSMENT_PROMPT }, { role: 'user', content: [{ type: 'text', text: 'Assess both original/cutout pairs conservatively.' }, ...images.map(url => ({ type: 'image_url', image_url: { url } }))] }] }) });
  if (!response.ok) { await response.body?.cancel(); throw new Error(`OnSpace AI quality assessment unavailable (HTTP ${response.status}).`); }
  const data = await response.json(), text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || text.length > 50_000) throw new Error('No bounded AI quality assessment returned.');
  const clean = text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  return parseCoinAssessment(JSON.parse(clean));
}
