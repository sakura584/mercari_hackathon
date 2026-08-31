type PriceRange = { min: number; max: number };

export const PRICE_RANGES: Record<string, PriceRange> = {
  clothing_tshirt: { min: 800, max: 2500 },
  clothing_outerwear: { min: 1500, max: 6000 },
  shoes: { min: 1000, max: 5000 },
  book: { min: 200, max: 1200 },
  figure: { min: 1000, max: 8000 },
  electronics_audio: { min: 1500, max: 12000 },
  bag: { min: 1000, max: 8000 },
  accessory: { min: 500, max: 4000 },
  toy: { min: 500, max: 3000 },
  stationery: { min: 100, max: 1000 },
  default: { min: 300, max: 3000 },
};

export function estimatePrice(category: string): number {
  const range = PRICE_RANGES[category] ?? PRICE_RANGES.default;
  const value = range.min + Math.random() * (range.max - range.min);
  return Math.round(value / 50) * 50;
}
