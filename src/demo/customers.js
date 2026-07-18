export const demoCustomer = {
  id: "demo-customer",
  name: "Demo Customer",
  email: "customer@demo.com",
  role: "customer",
};

export const demoAdmin = {
  id: "demo-admin",
  name: "Demo Administrator",
  email: "admin@demo.com",
  role: "administrator",
};

export const customers = [
  demoCustomer,
  demoAdmin,
  { id: "customer-002", name: "Jordan Lee", email: "jordan.lee@example.test", role: "customer" },
  { id: "customer-003", name: "Maya Chen", email: "maya.chen@example.test", role: "customer" },
];

export default customers;
