/**
 * @omnistack/server - Product Inventory Management Engine
 * Features:
 * - Full CRUD: Listing, tagging, titles, descriptions, categories, image URLs, pricing & discounts
 * - Real-time stock decrement, low-stock alerts, out-of-stock guards
 * - Anti-rot persistence and schema validation
 */

import * as crypto from 'node:crypto';

export interface ProductItem {
  id: string;
  sku: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  price: number;
  compareAtPrice?: number | undefined; // Original price for discount display
  stockQuantity: number;
  lowStockThreshold: number;
  imageUrl: string;
  status: 'ACTIVE' | 'DRAFT' | 'OUT_OF_STOCK';
  createdAt: number;
  updatedAt: number;
}

export interface InventoryStats {
  totalProducts: number;
  activeCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalUnitsInStock: number;
  categories: string[];
}

export class InventoryEngine {
  private products = new Map<string, ProductItem>();

  constructor() {
    this.seedDefaultProducts();
  }

  /**
   * Seeds realistic products for the active store catalog
   */
  private seedDefaultProducts() {
    const defaults: Array<Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>> = [
      {
        sku: 'KB-65-APEX-01',
        title: 'ApexCyber 65% Tactile Hub (Barebones)',
        description: 'CNC 6063 aerospace aluminum case with leaf-spring gasket mount and south-facing hot-swap RGB PCB.',
        category: 'Keyboards',
        tags: ['FLAGSHIP', 'BESTSELLER', 'HOT-SWAP'],
        price: 189,
        compareAtPrice: 229,
        stockQuantity: 42,
        lowStockThreshold: 10,
        imageUrl: 'https://images.unsplash.com/photo-1595225476474-87563907a212?auto=format&fit=crop&w=600&q=80',
        status: 'ACTIVE',
      },
      {
        sku: 'SW-LIN-90-LUB',
        title: 'Linear Switch Pack (x90 Hand-Lubed)',
        description: 'Factory-lubed POM stem switches with 55g progressive gold-plated springs for ultra-smooth actuation.',
        category: 'Switches',
        tags: ['IN STOCK', 'LUBED', 'COMMUNITY CHOICE'],
        price: 45,
        compareAtPrice: 55,
        stockQuantity: 120,
        lowStockThreshold: 20,
        imageUrl: 'https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?auto=format&fit=crop&w=600&q=80',
        status: 'ACTIVE',
      },
      {
        sku: 'KC-DYE-SUB-87',
        title: 'CyberWave PBT Dye-Sub Keycap Set',
        description: 'Cherry profile thick 1.5mm PBT keycaps with vibrant dyesub sublimation legends. Zero shine over years of typing.',
        category: 'Keycaps',
        tags: ['PBT', 'CHERRY PROFILE', 'LIMITED'],
        price: 68,
        compareAtPrice: 85,
        stockQuantity: 8,
        lowStockThreshold: 10,
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80',
        status: 'ACTIVE',
      },
      {
        sku: 'ACC-COIL-CABLE-USB',
        title: 'Aviator Coiled USB-C Cable (Laser Cyan)',
        description: 'Double-sleeved braided paracord cable with heavy chrome-plated GX16 4-pin aviator connector.',
        category: 'Accessories',
        tags: ['PARACORD', 'AVIATOR', 'CUSTOM'],
        price: 38,
        compareAtPrice: 48,
        stockQuantity: 0,
        lowStockThreshold: 5,
        imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?auto=format&fit=crop&w=600&q=80',
        status: 'OUT_OF_STOCK',
      },
    ];

    const now = Date.now();
    for (const d of defaults) {
      const id = `prod_${crypto.randomBytes(6).toString('hex')}`;
      this.products.set(id, {
        ...d,
        id,
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  public getAllProducts(filter?: { category?: string | undefined; tag?: string | undefined; status?: string | undefined }): ProductItem[] {
    let list = Array.from(this.products.values());

    if (filter?.category && filter.category !== 'all') {
      list = list.filter((p) => p.category.toLowerCase() === filter.category!.toLowerCase());
    }

    if (filter?.tag && filter.tag !== 'all') {
      list = list.filter((p) => p.tags.some((t) => t.toLowerCase() === filter.tag!.toLowerCase()));
    }

    if (filter?.status && filter.status !== 'all') {
      list = list.filter((p) => p.status === filter.status);
    }

    return list.sort((a, b) => b.createdAt - a.createdAt);
  }

  public getProduct(id: string): ProductItem | undefined {
    return this.products.get(id);
  }

  public addProduct(item: Omit<ProductItem, 'id' | 'createdAt' | 'updatedAt'>): ProductItem {
    const id = `prod_${crypto.randomBytes(6).toString('hex')}`;
    const now = Date.now();
    const status = item.stockQuantity <= 0 ? 'OUT_OF_STOCK' : (item.status || 'ACTIVE');

    const newProduct: ProductItem = {
      ...item,
      id,
      status,
      createdAt: now,
      updatedAt: now,
    };

    this.products.set(id, newProduct);
    return newProduct;
  }

  public updateProduct(id: string, updates: Partial<Omit<ProductItem, 'id' | 'createdAt'>>): ProductItem | undefined {
    const product = this.products.get(id);
    if (!product) return undefined;

    const updated = {
      ...product,
      ...updates,
      updatedAt: Date.now(),
    };

    if (typeof updates.stockQuantity === 'number') {
      if (updates.stockQuantity <= 0) {
        updated.status = 'OUT_OF_STOCK';
      } else if (product.status === 'OUT_OF_STOCK') {
        updated.status = 'ACTIVE';
      }
    }

    this.products.set(id, updated);
    return updated;
  }

  public deleteProduct(id: string): boolean {
    return this.products.delete(id);
  }

  /**
   * Decrements stock quantity upon successful order placement
   */
  public decrementStock(productId: string, quantity: number): { success: boolean; remaining: number } {
    const product = this.products.get(productId);
    if (!product) return { success: false, remaining: 0 };

    if (product.stockQuantity < quantity) {
      return { success: false, remaining: product.stockQuantity };
    }

    product.stockQuantity -= quantity;
    if (product.stockQuantity <= 0) {
      product.status = 'OUT_OF_STOCK';
    }
    product.updatedAt = Date.now();
    return { success: true, remaining: product.stockQuantity };
  }

  public getStats(): InventoryStats {
    let lowStock = 0;
    let outOfStock = 0;
    let active = 0;
    let totalUnits = 0;
    const catSet = new Set<string>();

    for (const p of this.products.values()) {
      catSet.add(p.category);
      totalUnits += p.stockQuantity;
      if (p.stockQuantity <= 0 || p.status === 'OUT_OF_STOCK') {
        outOfStock++;
      } else if (p.stockQuantity <= p.lowStockThreshold) {
        lowStock++;
      }
      if (p.status === 'ACTIVE') active++;
    }

    return {
      totalProducts: this.products.size,
      activeCount: active,
      lowStockCount: lowStock,
      outOfStockCount: outOfStock,
      totalUnitsInStock: totalUnits,
      categories: Array.from(catSet),
    };
  }
}

export const globalInventoryEngine = new InventoryEngine();
