const productImage = "/demo-product.svg";

const names = [
  ["Aurora Desk Lamp", "Workspace", 2499],
  ["Summit Trail Bottle", "Outdoor", 899],
  ["Luma Cotton Throw", "Home", 1899],
  ["Pulse Wireless Earbuds", "Electronics", 3499],
  ["Harbor Ceramic Mug Set", "Kitchen", 1299],
  ["Metro Canvas Backpack", "Travel", 2799],
  ["Orbit Charging Stand", "Electronics", 1999],
  ["Bloom Planter Trio", "Home", 1199],
  ["Cedar Journal Kit", "Stationery", 749],
  ["Nova Fitness Band", "Wellness", 2299],
  ["Slate Laptop Sleeve", "Workspace", 1599],
  ["Aero Travel Organizer", "Travel", 999],
  ["Ember Scented Candle", "Home", 699],
  ["Core Resistance Set", "Wellness", 1499],
  ["Ripple Glass Carafe", "Kitchen", 1699],
  ["Prism Desk Mat", "Workspace", 1099],
  ["Terra Storage Basket", "Home", 1399],
  ["Vivid Sketch Markers", "Stationery", 849],
  ["Glide Mouse Pad", "Electronics", 599],
  ["Nomad Packing Cubes", "Travel", 1799],
  ["Fresh Bento Box", "Kitchen", 1299],
  ["Mosaic Coaster Set", "Home", 649],
  ["Focus Timer Cube", "Workspace", 899],
  ["Balance Yoga Strap", "Wellness", 549],
];

export const products = names.map(([name, category, price], index) => {
  const id = index + 1;
  const rating = Number((4.1 + (index % 8) * 0.1).toFixed(1));
  return {
    id,
    product_name: name,
    product_sub_description: `A polished demo ${category.toLowerCase()} item for everyday shopping flows.`,
    product_description: `${name} is a fictional portfolio product with realistic merchandising content, clean specifications, and dependable demo inventory.`,
    category,
    product_price: price,
    product_discount: index % 4 === 0 ? 10 : index % 5 === 0 ? 15 : 0,
    product_image: productImage,
    rating,
    stock: 18 + index,
    in_stock: true,
    size: "Standard, Large",
    key_benefits: "{Durable design, Easy to use, Demo-ready details}",
    ingredients_name: "Premium materials, Thoughtful finish, Recyclable packaging",
    percentage: "60%, 30%, 10%",
    ingredients_heading: "Materials",
    ingredients_description: "Built from safe fictional materials for portfolio demonstration.",
    ingredients_subheading: "Product Composition",
    how_to_use_heading: "How to Use",
    how_to_use_description: "Use as a normal demo product while browsing, carting, and checking out.",
    pro_tips: "Pair with other NovaCommerce demo accessories.",
    specifications: {
      brand: "NovaCommerce",
      sku: `NOVA-${String(id).padStart(3, "0")}`,
      warranty: "Demo warranty",
    },
    created_at: new Date(2026, 0, id).toISOString(),
  };
});

export default products;
