/**
 * @omnistack/server - Merchandising & Announcement Banner Customization Engine
 * Features:
 * - Heading announcement bar with custom promo text, marquee speeds, and colors
 * - Dynamic hero banner customizations (headline, subheadline, badge pill, CTAs, background artwork)
 */

export interface AnnouncementBarConfig {
  enabled: boolean;
  text: string;
  bgColor: string;
  textColor: string;
  linkText?: string | undefined;
  linkUrl?: string | undefined;
}

export interface HeroBannerConfig {
  headline: string;
  subheadline: string;
  badge: string;
  badgeBg: string;
  primaryCtaText: string;
  primaryCtaLink: string;
  secondaryCtaText: string;
  secondaryCtaLink: string;
  bgImageUrl?: string | undefined;
}

export interface MerchandisingConfig {
  announcement: AnnouncementBarConfig;
  heroBanner: HeroBannerConfig;
}

export class MerchandisingEngine {
  private config: MerchandisingConfig;

  constructor() {
    this.config = {
      announcement: {
        enabled: true,
        text: '🔥 FREE WORLDWIDE EXPRESS SHIPPING ON ORDERS OVER $150 • USE CODE "FORGE20" FOR 20% OFF',
        bgColor: '#0284c7',
        textColor: '#ffffff',
        linkText: 'Claim Discount',
        linkUrl: '#products',
      },
      heroBanner: {
        headline: 'Engineered for Pure Tactile Performance',
        subheadline: 'Featuring custom leaf-spring gasket isolation and CNC anodized aluminum chassis with hot-swap sockets.',
        badge: 'LIMITED PRODUCTION BATCH #01',
        badgeBg: '#f59e0b',
        primaryCtaText: 'Order Flagship Rig',
        primaryCtaLink: '#products',
        secondaryCtaText: 'Sound Test & Specs',
        secondaryCtaLink: '#features',
        bgImageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=1400&q=80',
      },
    };
  }

  public getConfig(): MerchandisingConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<MerchandisingConfig>): MerchandisingConfig {
    if (updates.announcement) {
      this.config.announcement = {
        ...this.config.announcement,
        ...updates.announcement,
      };
    }

    if (updates.heroBanner) {
      this.config.heroBanner = {
        ...this.config.heroBanner,
        ...updates.heroBanner,
      };
    }

    return this.getConfig();
  }
}

export const globalMerchandisingEngine = new MerchandisingEngine();
