import { NutrientEstimate } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const MODEL = 'claude-sonnet-5';

const ESTIMATE_SYSTEM_PROMPT = `You are a nutrition estimation assistant inside a fitness app.
Given a photo of food or a spoken description of a meal, identify the food and estimate
a reasonable serving size and its nutrition. Always respond with ONLY a single JSON object
(no markdown fences, no extra text) matching exactly this shape:

{
  "foodName": string,       // short human-readable name, e.g. "Grilled chicken breast"
  "quantity": string,       // estimated serving, e.g. "1 cup (150g)"
  "calories": number,       // kcal, integer
  "proteinG": number,       // grams, integer
  "carbsG": number,         // grams, integer
  "fatG": number,           // grams, integer
  "confidence": "low" | "medium" | "high"
}

If multiple foods are present, combine them into one aggregate estimate for the whole
plate/meal. If you truly cannot identify any food, still return your best guess with
"confidence": "low".`;

const LABEL_SYSTEM_PROMPT = `You are reading a nutrition facts label from packaged food inside a
fitness app. Given a photo of a nutrition facts label, read the values PRINTED on it directly --
do not estimate or guess. Use the serving size shown on the label as "quantity". Always respond
with ONLY a single JSON object (no markdown fences, no extra text) matching exactly this shape:

{
  "foodName": string,       // product/food name if visible, else a short generic name
  "quantity": string,       // the serving size printed on the label, e.g. "1 cup (240ml)"
  "calories": number,       // kcal per serving, integer
  "proteinG": number,       // grams per serving, integer
  "carbsG": number,         // grams per serving, integer
  "fatG": number,           // grams per serving, integer
  "confidence": "low" | "medium" | "high"
}

If you can clearly read the label, use "confidence": "high". If part of it is blurry or cut off,
give your best reading and lower the confidence accordingly.`;

const DRINK_SYSTEM_PROMPT = `You are a nutrition estimation assistant inside a fitness app, looking
at a photo of a drink (a cup, bottle, can, or glass). Identify the drink and estimate its serving
size and nutrition, accounting for the typical size of that container. Always respond with ONLY a
single JSON object (no markdown fences, no extra text) matching exactly this shape:

{
  "foodName": string,
  "quantity": string,       // e.g. "1 can (355ml)", "1 cup (240ml)"
  "calories": number,
  "proteinG": number,
  "carbsG": number,
  "fatG": number,
  "confidence": "low" | "medium" | "high"
}`;

const SUGGEST_SYSTEM_PROMPT = `You are a friendly nutrition coach inside a fitness app. Given a
calorie/macro target -- and optionally a free-form question from the user, or a specific meal to
find alternatives to -- suggest realistic, everyday meals that fit. Always respond with ONLY a
JSON array (no markdown fences, no extra text) of exactly 3 suggestions, each matching this shape:

[
  {
    "icon": string,      // one emoji representing the meal, e.g. "🌯"
    "name": string,      // short name, e.g. "Chicken burrito bowl"
    "calories": number,  // kcal, integer
    "proteinG": number,  // grams, integer
    "carbsG": number,    // grams, integer
    "fatG": number        // grams, integer
  }
]

Suggestions must be common, realistic meals a person could actually go make or order (not
exotic or vague), varied from each other, and should land close to the given target. If told
to avoid repeating earlier suggestions, give genuinely different meals.`;

export class AiFoodError extends Error {}

function extractJson(text: string): NutrientEstimate {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new AiFoodError('AI response did not contain JSON: ' + text);
  }
  const parsed = JSON.parse(match[0]);
  const required = ['foodName', 'quantity', 'calories', 'proteinG', 'carbsG', 'fatG'];
  for (const key of required) {
    if (!(key in parsed)) {
      throw new AiFoodError(`AI response missing "${key}"`);
    }
  }
  return {
    foodName: String(parsed.foodName),
    quantity: String(parsed.quantity),
    calories: Math.round(Number(parsed.calories)),
    proteinG: Math.round(Number(parsed.proteinG)),
    carbsG: Math.round(Number(parsed.carbsG)),
    fatG: Math.round(Number(parsed.fatG)),
    confidence: parsed.confidence ?? 'medium',
  };
}

export interface MealSuggestion {
  icon: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

function extractJsonArray(text: string): MealSuggestion[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new AiFoodError('AI response did not contain a JSON array: ' + text);
  }
  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new AiFoodError('AI response array was empty');
  }
  return parsed.map((item) => ({
    icon: typeof item.icon === 'string' && item.icon ? item.icon : '🍽️',
    name: String(item.name),
    calories: Math.round(Number(item.calories)),
    proteinG: Math.round(Number(item.proteinG)),
    carbsG: Math.round(Number(item.carbsG)),
    fatG: Math.round(Number(item.fatG)),
  }));
}

async function callClaude(
  apiKey: string,
  systemPrompt: string,
  content: Array<Record<string, unknown>>
): Promise<string> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content }],
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new AiFoodError(
      `Claude API error ${response.status}: ${body || response.statusText}`
    );
  }

  const data = await response.json();
  const text = data?.content?.[0]?.text;
  if (typeof text !== 'string') {
    throw new AiFoodError('Unexpected Claude API response shape');
  }
  return text;
}

export type PhotoScanMode = 'auto' | 'meal' | 'label' | 'drink';

const PHOTO_SCAN_SYSTEM_PROMPTS: Record<PhotoScanMode, string> = {
  auto: ESTIMATE_SYSTEM_PROMPT,
  meal: ESTIMATE_SYSTEM_PROMPT,
  label: LABEL_SYSTEM_PROMPT,
  drink: DRINK_SYSTEM_PROMPT,
};

const PHOTO_SCAN_USER_PROMPTS: Record<PhotoScanMode, string> = {
  auto: 'Identify this food and estimate its nutrition. Respond with only the JSON object.',
  meal: 'Identify this meal and estimate its nutrition. Respond with only the JSON object.',
  label: 'Read this nutrition facts label and report its printed values. Respond with only the JSON object.',
  drink: 'Identify this drink and estimate its nutrition. Respond with only the JSON object.',
};

export async function estimateNutritionFromPhoto(
  apiKey: string,
  base64Image: string,
  mode: PhotoScanMode = 'auto',
  mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg'
): Promise<NutrientEstimate> {
  const text = await callClaude(apiKey, PHOTO_SCAN_SYSTEM_PROMPTS[mode], [
    {
      type: 'image',
      source: { type: 'base64', media_type: mediaType, data: base64Image },
    },
    {
      type: 'text',
      text: PHOTO_SCAN_USER_PROMPTS[mode],
    },
  ]);
  return extractJson(text);
}

export async function estimateNutritionFromText(
  apiKey: string,
  description: string
): Promise<NutrientEstimate> {
  const text = await callClaude(apiKey, ESTIMATE_SYSTEM_PROMPT, [
    {
      type: 'text',
      text: `The user said: "${description}". Identify the food they ate and estimate its nutrition. Respond with only the JSON object.`,
    },
  ]);
  return extractJson(text);
}

export interface SuggestMealsParams {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  question?: string;
  avoid?: string[];
}

export async function suggestMeals(
  apiKey: string,
  params: SuggestMealsParams
): Promise<MealSuggestion[]> {
  const lines: string[] = [
    `Target: about ${Math.max(0, Math.round(params.calories))} kcal, ` +
      `${Math.max(0, Math.round(params.proteinG))}g protein, ` +
      `${Math.max(0, Math.round(params.carbsG))}g carbs, ` +
      `${Math.max(0, Math.round(params.fatG))}g fat.`,
  ];
  if (params.question?.trim()) {
    lines.push(`User's question: "${params.question.trim()}"`);
  }
  if (params.avoid && params.avoid.length > 0) {
    lines.push(`Don't repeat these meals, suggest different ones: ${params.avoid.join(', ')}.`);
  }
  lines.push('Respond with only the JSON array.');

  const text = await callClaude(apiKey, SUGGEST_SYSTEM_PROMPT, [
    { type: 'text', text: lines.join('\n') },
  ]);
  return extractJsonArray(text);
}
