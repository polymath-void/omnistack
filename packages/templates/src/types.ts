/**
 * @omnistack/templates - Core Types
 */

export interface TemplateDesignTokens {
  bg: string;
  cardBg: string;
  primary: string;
  secondary: string;
  text: string;
  textMuted: string;
  border: string;
  fontHeading: string;
  fontBody: string;
  borderRadius: string; // '0px' | '8px' | '16px' | '24px' | '999px'
  containerPadding: string;
}

export interface StoreTemplateItem {
  id: string;
  name: string;
  niche: string;
  nicheTitle: string;
  categoryIcon: string;
  tagline: string;
  description: string;
  archetype: 'bento' | 'editorial' | 'minimalist' | 'streetwear' | 'luxury' | 'saas';
  tokens: TemplateDesignTokens;
  hero: {
    headline: string;
    subheadline: string;
    badge: string;
    primaryCta: string;
    secondaryCta: string;
    priceSample: string;
  };
  features: string[];
  sampleProducts: Array<{ name: string; price: number; tag: string }>;
  hasBlog: boolean;
  hasReviews: boolean;
  hasStripeBadge: boolean;
  hasCartDrawer: boolean;
}
