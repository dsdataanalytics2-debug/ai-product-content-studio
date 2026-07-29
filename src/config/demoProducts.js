/**
 * NOT in Appendix A's tree — added deliberately, and here's why:
 *
 * Without a store connected, every screen downstream of product selection is
 * unreachable, so the app can't be exercised, demoed, or handed to someone else
 * without WooCommerce credentials first. These six products are in the
 * NormalisedProduct shape that productService emits, so nothing downstream can
 * tell the difference — and the UI always says when it is using them.
 */

export const DEMO_PRODUCTS = [
  {
    id: 'demo-1',
    name: 'Glow Serum — Vitamin C Brightening',
    sku: 'GLW-SER-30',
    price: '১,২০০',
    salePrice: '৮৫০',
    currency: 'BDT',
    emoji: '✨',
    image: null,
    categories: ['Skincare', 'Serum'],
    attributes: ['30 ml', 'Vitamin C 10%', 'For all skin types'],
    shortDescription:
      'A lightweight vitamin C serum for daily use. Absorbs quickly and layers under moisturiser.',
    description:
      'Glow Serum contains 10% stabilised vitamin C in a lightweight base. Use two to three drops in the morning after cleansing, before moisturiser. 30 ml bottle with a glass dropper.',
    stockStatus: 'instock',
  },
  {
    id: 'demo-2',
    name: 'Rechargeable Table Fan — 8 Hour Backup',
    sku: 'FAN-RCH-12',
    price: '৩,৪৫০',
    salePrice: null,
    currency: 'BDT',
    emoji: '🌀',
    image: null,
    categories: ['Electronics', 'Home Appliances'],
    attributes: ['12 inch', '8 hour battery', 'USB-C charging', '3 speed settings'],
    shortDescription:
      'A 12-inch rechargeable fan that runs up to 8 hours on a full charge. Charges over USB-C.',
    description:
      'Rechargeable table fan with a 12-inch blade and three speed settings. Runs up to 8 hours on the lowest speed from a full charge. Charges via USB-C in about 5 hours.',
    stockStatus: 'instock',
  },
  {
    id: 'demo-3',
    name: 'Cotton Kurti — Block Print',
    sku: 'KRT-BLK-M',
    price: '১,৮৯০',
    salePrice: '১,৪৯০',
    currency: 'BDT',
    emoji: '👗',
    image: null,
    categories: ['Fashion', 'Women'],
    attributes: ['100% cotton', 'Sizes S–XXL', 'Hand block printed'],
    shortDescription: 'Hand block printed cotton kurti, cut for everyday wear in warm weather.',
    description:
      'Hand block printed kurti in 100% cotton. Straight cut with side slits and three-quarter sleeves. Available S through XXL. Wash cold, dry in shade.',
    stockStatus: 'instock',
  },
  {
    id: 'demo-4',
    name: 'Wireless Earbuds — ENC Calling',
    sku: 'EAR-ENC-04',
    price: '২,২৫০',
    salePrice: null,
    currency: 'BDT',
    emoji: '🎧',
    image: null,
    categories: ['Electronics', 'Audio'],
    attributes: ['Bluetooth 5.3', '24h with case', 'ENC microphone', 'IPX4'],
    shortDescription:
      'Bluetooth 5.3 earbuds with environmental noise cancellation on calls and 24 hours total playback.',
    description:
      'Wireless earbuds with Bluetooth 5.3 and ENC on the call microphone. Six hours per charge, 24 hours total with the charging case. IPX4 splash resistant.',
    stockStatus: 'instock',
  },
  {
    id: 'demo-5',
    name: 'Stainless Steel Water Bottle — 1L',
    sku: 'BTL-SS-1L',
    price: '৯৫০',
    salePrice: '৭৫০',
    currency: 'BDT',
    emoji: '🍶',
    image: null,
    categories: ['Home & Living', 'Kitchen'],
    attributes: ['1 litre', 'Double wall', 'Keeps cold 18h'],
    shortDescription:
      'Double-walled 1 litre steel bottle. Keeps cold drinks cold for about 18 hours.',
    description:
      'Double-wall vacuum insulated stainless steel bottle, 1 litre. Keeps cold drinks cold for roughly 18 hours and hot drinks hot for roughly 8. Wide mouth, leak-resistant cap.',
    stockStatus: 'instock',
  },
  {
    id: 'demo-6',
    name: 'Hair Oil — Onion & Black Seed',
    sku: 'OIL-ONB-100',
    price: '৬৫০',
    salePrice: null,
    currency: 'BDT',
    emoji: '🧴',
    image: null,
    categories: ['Skincare', 'Hair Care'],
    attributes: ['100 ml', 'Onion extract', 'Black seed oil', 'No added colour'],
    shortDescription:
      'A 100 ml hair oil with onion and black seed extract. Massage in and leave for an hour before washing.',
    description:
      'Hair oil blending onion extract and black seed oil in a coconut oil base. Massage into the scalp and leave at least an hour before washing. 100 ml bottle.',
    stockStatus: 'instock',
  },
]
