import { z } from "zod";

const UNIT_ALIASES = {
  "usd/1m": "usd_per_1m_tokens",
  "usd_per_1m": "usd_per_1m_tokens",
  "usd_per_1m_tokens": "usd_per_1m_tokens",
  "usd/1k": "usd_per_1k_tokens",
  "usd_per_1k": "usd_per_1k_tokens",
  "usd_per_1k_tokens": "usd_per_1k_tokens",
  "usd/token": "usd_per_token",
  "usd_per_token": "usd_per_token",
  "cents/1m": "cents_per_1m_tokens",
  "cents_per_1m": "cents_per_1m_tokens",
  "cents_per_1m_tokens": "cents_per_1m_tokens",
  "cents/1k": "cents_per_1k_tokens",
  "cents_per_1k": "cents_per_1k_tokens",
  "cents_per_1k_tokens": "cents_per_1k_tokens",
  "cents/token": "cents_per_token",
  "cents_per_token": "cents_per_token",
} as const;

type UnitAlias = (typeof UNIT_ALIASES)[keyof typeof UNIT_ALIASES];

const CURRENCY_TO_USD = {
  USD: 1,
} as const;

const UnitSchema = z.enum([
  "usd_per_1m_tokens",
  "usd_per_1k_tokens",
  "usd_per_token",
  "cents_per_1m_tokens",
  "cents_per_1k_tokens",
  "cents_per_token",
]);

const ProviderPriceInputSchema = z.object({
  value: z.number().finite().nonnegative(),
  unit: z.string().min(1),
  currency: z.string().default("USD"),
});

export const PriceNormalizedSchema = z.object({
  model: z.string().min(1),
  provider: z.string().min(1),
  normalizedAtIso: z.string().datetime(),
  pricing: z.object({
    input: z.number().finite().nonnegative(), // USD per 1M input tokens
    output: z.number().finite().nonnegative(), // USD per 1M output tokens
    cached_input: z.number().finite().nonnegative().optional(), // USD per 1M cached input tokens
    cached_output: z.number().finite().nonnegative().optional(), // USD per 1M cached output tokens
  }),
  contextWindow: z.number().int().positive().optional(),
  metadata: z.object({
    sourceUrl: z.string().url().optional(),
    sourceType: z.string().optional(),
    observedAtIso: z.string().datetime().optional(),
    rawUnitInput: z.string().optional(),
    rawUnitOutput: z.string().optional(),
    notes: z.string().optional(),
  }).default({}),
});

export type PriceNormalized = z.infer<typeof PriceNormalizedSchema>;

export type ProviderPriceInput = z.infer<typeof ProviderPriceInputSchema>;

function canonicalUnit(unitRaw: string): UnitAlias {
  const unit = unitRaw.trim().toLowerCase();
  const mapped = UNIT_ALIASES[unit as keyof typeof UNIT_ALIASES];
  if (!mapped) {
    throw new Error(`Unsupported price unit: ${unitRaw}`);
  }
  return mapped;
}

function toUsdValue(value: number, currencyRaw: string): number {
  const currency = currencyRaw.trim().toUpperCase();
  const rate = CURRENCY_TO_USD[currency as keyof typeof CURRENCY_TO_USD];
  if (!rate) {
    throw new Error(`Unsupported currency: ${currencyRaw}`);
  }
  return value * rate;
}

function convertToUsdPer1M(value: number, unitRaw: string, currencyRaw: string): number {
  const unit = UnitSchema.parse(canonicalUnit(unitRaw));
  const usdValue = toUsdValue(value, currencyRaw);

  switch (unit) {
    case "usd_per_1m_tokens":
      return usdValue;
    case "usd_per_1k_tokens":
      return usdValue * 1000;
    case "usd_per_token":
      return usdValue * 1_000_000;
    case "cents_per_1m_tokens":
      return usdValue / 100;
    case "cents_per_1k_tokens":
      return (usdValue / 100) * 1000;
    case "cents_per_token":
      return (usdValue / 100) * 1_000_000;
    default:
      throw new Error(`Unhandled price unit: ${unit}`);
  }
}

function detectOutlier(value: number, baselineMedian: number, maxMultiple = 20): boolean {
  if (baselineMedian <= 0) return false;
  return value > baselineMedian * maxMultiple;
}

export function normalizeModelPricing(input: {
  model: string;
  provider: string;
  input: ProviderPriceInput;
  output: ProviderPriceInput;
  cached_input?: ProviderPriceInput;
  cached_output?: ProviderPriceInput;
  contextWindow?: number;
  metadata?: Record<string, unknown>;
  baselineMedianUsdPer1M?: number;
  normalizedAtIso?: string;
}): PriceNormalized {
  const parsedInput = ProviderPriceInputSchema.parse(input.input);
  const parsedOutput = ProviderPriceInputSchema.parse(input.output);
  const parsedCachedInput = input.cached_input ? ProviderPriceInputSchema.parse(input.cached_input) : undefined;
  const parsedCachedOutput = input.cached_output ? ProviderPriceInputSchema.parse(input.cached_output) : undefined;

  const pricing = {
    input: convertToUsdPer1M(parsedInput.value, parsedInput.unit, parsedInput.currency),
    output: convertToUsdPer1M(parsedOutput.value, parsedOutput.unit, parsedOutput.currency),
    cached_input: parsedCachedInput
      ? convertToUsdPer1M(parsedCachedInput.value, parsedCachedInput.unit, parsedCachedInput.currency)
      : undefined,
    cached_output: parsedCachedOutput
      ? convertToUsdPer1M(parsedCachedOutput.value, parsedCachedOutput.unit, parsedCachedOutput.currency)
      : undefined,
  };

  const baseline = input.baselineMedianUsdPer1M ?? 0;
  const candidateValues = [pricing.input, pricing.output, pricing.cached_input, pricing.cached_output].filter(
    (v): v is number => typeof v === "number"
  );

  if (baseline > 0 && candidateValues.some((v) => detectOutlier(v, baseline))) {
    throw new Error(`Pricing outlier detected against baseline median ${baseline} USD/1M`);
  }

  return PriceNormalizedSchema.parse({
    model: input.model,
    provider: input.provider,
    normalizedAtIso: input.normalizedAtIso ?? new Date().toISOString(),
    pricing,
    contextWindow: input.contextWindow,
    metadata: input.metadata ?? {},
  });
}

// Ensure every record is schema-validated before persistence/upsert.
export function assertNormalizedBeforeUpsert(record: unknown): PriceNormalized {
  return PriceNormalizedSchema.parse(record);
}
