/** Canonical mobile specialist ownership; presentation never grants backend access. */
export type SwishNicheId = 'coins' | 'motocross' | 'bicycles' | 'clothing' | 'trading_cards' | 'antiques' | 'fossils' | 'beauty' | 'tech' | 'surplus_flip' | 'tunes_flip' | 'collectibles' | 'stamps';
export const NICHE_SPECIALISTS: Record<SwishNicheId, string[]> = {
  coins: ['coins', 'coins_uk', 'coins_world', 'coins_currency', 'numismatic', 'islamic_silver', 'banknotes', 'gold', 'silver', 'jewellery_precious_metals', 'ancient_artefacts'],
  motocross: ['motocross', 'mx'], bicycles: ['bicycles', 'bikes', 'cycling'], clothing: ['clothing', 'trainers_sneakers'],
  trading_cards: ['pokemon_cards', 'trading_cards', 'cards'], antiques: ['antiques', 'books'], fossils: ['fossils'], beauty: ['beauty'],
  tech: ['tech', 'retro_games', 'retro_consoles'], surplus_flip: ['surplus_trader', 'surplus_flip'],
  tunes_flip: ['vinyl_records'], collectibles: ['collectibles'], stamps: ['stamps'],
};
export const NICHE_DEFAULT_SPECIALIST: Record<SwishNicheId, string> = {
  coins: 'coins', motocross: 'motocross', bicycles: 'bicycles', clothing: 'clothing', trading_cards: 'pokemon_cards', antiques: 'antiques',
  fossils: 'fossils', beauty: 'beauty', tech: 'tech', surplus_flip: 'surplus_trader', tunes_flip: 'vinyl_records', collectibles: 'collectibles', stamps: 'stamps',
};
const NICHE_ALIASES: Record<string, SwishNicheId> = {
  coins: 'coins', mx: 'motocross', motocross: 'motocross', bikes: 'bicycles', bicycle: 'bicycles', bicycles: 'bicycles',
  threads: 'clothing', threads_flip: 'clothing', clothes: 'clothing', clothing: 'clothing', cards: 'trading_cards', card_flipper: 'trading_cards', trading_cards: 'trading_cards',
  antiques: 'antiques', antique_flipper: 'antiques', fossils: 'fossils', fossil_flipper: 'fossils', beauty: 'beauty', beauty_flipper: 'beauty',
  tech: 'tech', technology: 'tech', tech_flipper: 'tech', surplus: 'surplus_flip', surplus_flip: 'surplus_flip', surplus_trader: 'surplus_flip',
  tunes_flip: 'tunes_flip', tunes: 'tunes_flip', music: 'tunes_flip', vinyl_records: 'tunes_flip', collectibles: 'collectibles', collectibles_flipper: 'collectibles',
  stamps: 'stamps', stamp: 'stamps', stamp_flip: 'stamps', stampflip: 'stamps', stamp_flipper: 'stamps', philately: 'stamps',
};
export function normaliseNicheId(value: unknown): SwishNicheId | null {
  const key = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  return NICHE_ALIASES[key] ?? null;
}
export function getActiveNicheId(): SwishNicheId {
  const buildNiche = normaliseNicheId(import.meta.env.VITE_SWISH_NICHE);
  if (buildNiche) return buildNiche;
  // Branded deployments outrank browser preferences. No unregistered stamp domain is invented.
  const host = window.location.hostname.toLowerCase().replace(/^www\./, '').split(':')[0];
  const products: Record<string, SwishNicheId> = {
    'coinflipper.com': 'coins', 'coins.swishflip.co.uk': 'coins', 'mxflipper.com': 'motocross', 'mx.swishflip.co.uk': 'motocross',
    'bikeflipper.com': 'bicycles', 'bikesflipper.com': 'bicycles', 'bikes.swishflip.co.uk': 'bicycles',
    'clothesflipper.com': 'clothing', 'clothes.swishflip.co.uk': 'clothing', 'threads.swishflip.co.uk': 'clothing',
    'cards.swishflip.co.uk': 'trading_cards', 'antiques.swishflip.co.uk': 'antiques', 'fossils.swishflip.co.uk': 'fossils',
    'beauty.swishflip.co.uk': 'beauty', 'tech.swishflip.co.uk': 'tech', 'surplusflip.com': 'surplus_flip', 'surplus.swishflip.co.uk': 'surplus_flip',
  };
  if (products[host]) return products[host];
  // Resolve direct scanner URLs before a previous niche's local preference.
  const route = normaliseNicheId(window.location.pathname.match(/^\/(?:workspace|scan)\/([^/]+)/)?.[1]);
  if (route) return route;
  return normaliseNicheId(localStorage.getItem('swish_active_niche')) || 'coins';
}
export function getSpecialistIdsForNiche(niche: SwishNicheId = getActiveNicheId()): string[] { return NICHE_SPECIALISTS[niche]; }
export function getDefaultSpecialistForNiche(niche: SwishNicheId = getActiveNicheId()): string { return NICHE_DEFAULT_SPECIALIST[niche]; }
