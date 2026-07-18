export const reviews = Array.from({ length: 24 }, (_, index) => ({
  id: index + 1,
  product_id: (index % 12) + 1,
  user_id: "demo-customer",
  user_name: ["Demo Customer", "Jordan Lee", "Maya Chen"][index % 3],
  rating: 4 + (index % 2),
  review_text: "Clean demo product with clear details and smooth ordering.",
  created_at: new Date(2026, 1, index + 1).toISOString(),
}));

export default reviews;
