/**
 * E-commerce item truth. The same disclosure as `tickets-fixture.ts` applies in
 * full: this is a controlled reference service seeded with known data, standing
 * in for a merchant's own inventory system. It is a fixture, it is labelled as
 * one, and nothing downstream of it is.
 *
 * Kept in its own file beside the ticket fixture so "which data in this project
 * is controlled" has a two-file answer and not a hunt.
 */

export interface ProductTruth {
  sku: string;
  displayName: string;
  /** 6-decimal fixed point. Never a float. */
  listedPriceUSD: string;
  inStock: boolean;
  authorizedSellers: string[];
}

const TRUTH: Record<string, ProductTruth> = {
  // The bait-and-switch target: one price on the product page, another at
  // checkout. The merchant's own record says $120.00.
  'sku-headphones-x': {
    sku: 'sku-headphones-x',
    displayName: 'Studio Headphones X',
    listedPriceUSD: '120000000',
    inStock: true,
    authorizedSellers: ['merchant-primary', 'marketplace-verified'],
  },

  // Out of stock: purchasable-looking, not actually available.
  'sku-console-y': {
    sku: 'sku-console-y',
    displayName: 'Handheld Console Y',
    listedPriceUSD: '349000000',
    inStock: false,
    authorizedSellers: ['merchant-primary'],
  },

  // Correct price, in stock, unauthorised reseller.
  'sku-lens-z': {
    sku: 'sku-lens-z',
    displayName: 'Prime Lens Z 35mm',
    listedPriceUSD: '78500000',
    inStock: true,
    authorizedSellers: ['merchant-primary'],
  },
};

export async function fetchProductTruth(sku: string): Promise<ProductTruth | null> {
  return TRUTH[sku] ?? null;
}

export async function listProductTruth(): Promise<ProductTruth[]> {
  return Object.values(TRUTH);
}
