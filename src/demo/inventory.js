import products from "./products";

export const inventory = products.map((product) => ({
  product_id: product.id,
  sku: product.specifications.sku,
  stock: product.stock,
  status: product.stock > 20 ? "In Stock" : "Low Stock",
}));

export default inventory;
