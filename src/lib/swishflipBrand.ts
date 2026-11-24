/** Shared commercial identity contract. Keep this in step with SWISH/constants/brand.ts. */
export const SWISHFLIP = {
  name: 'SWISHFlip',
  descriptor: 'The intelligent reseller platform.',
  slogan: "Turn what you have into what it's worth.",
  secondarySlogan: 'One platform. Every kind of reseller.',
  intelligence: 'Powered by SWISH AI.',
  journey: ['Scan', 'Identify', 'Value', 'Sell', 'Manage'],
  colors: {
    midnight: '#071C26',
    deepOcean: '#102D39',
    gold: '#F4C65D',
    teal: '#19B5AC',
    arctic: '#F5F8FA',
    steel: '#91A6B2',
    success: '#36B37E',
    warning: '#E6A700',
    danger: '#D94B4B',
  },
} as const;

export type WorkspaceAccent = { accent: string; icon: string };

/**
 * Presentation metadata only. Product IDs, authorisation and subscription
 * decisions continue to come from the existing shared backend contracts.
 */
export const WORKSPACE_ACCENTS: Record<string, WorkspaceAccent> = {
  coins: { accent: '#D7A940', icon: 'Coins' },
  tunes_flip: { accent: '#A76EE8', icon: 'Disc3' },
  antiques: { accent: '#D78B42', icon: 'Landmark' },
  clothing: { accent: '#D6649D', icon: 'Shirt' },
  tech: { accent: '#3C9FD6', icon: 'MonitorSmartphone' },
  trading_cards: { accent: '#8D72D8', icon: 'PanelsTopLeft' },
  bicycles: { accent: '#4DBD84', icon: 'Bike' },
  motocross: { accent: '#DF7654', icon: 'Wrench' },
  fossils: { accent: '#48B8B0', icon: 'Gem' },
  beauty: { accent: '#D76A82', icon: 'Sparkles' },
  stamps: { accent: '#5DB7A0', icon: 'Stamp' },
  collectibles: { accent: '#D68A4F', icon: 'Trophy' },
  surplus_flip: { accent: '#19B5AC', icon: 'Boxes' },
};
