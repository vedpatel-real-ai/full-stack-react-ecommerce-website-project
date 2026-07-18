export const orders = [
  {
    id: 123456,
    user_id: "demo-customer",
    user_name: "Demo Customer",
    user_email: "customer@demo.com",
    user_phone: "5551234567",
    address_line: "100 Demo Street",
    city: "Sample City",
    state: "CA",
    postal_code: "94016",
    product_list: [{ product_id: 1, name: "Aurora Desk Lamp", quantity: 1, unit_price: 2499, total_price: 2499 }],
    total_amount: 2499,
    payment_status: "COMPLETED",
    order_status: "PROCESSING",
    payment_id: "DEMO-PAY-123456",
    created_at: new Date().toISOString(),
    estimated_delivery: "3-5 business days",
  },
];

export default orders;
