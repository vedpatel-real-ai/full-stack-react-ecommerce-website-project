import productsSeed from "./demo/products";
import ordersSeed from "./demo/orders";
import reviewsSeed from "./demo/reviews";
import customers, { demoAdmin, demoCustomer } from "./demo/customers";

const STORAGE_KEY = "novacommerce_demo_db";

const initialDb = {
  products: productsSeed,
  orders: ordersSeed,
  product_reviews: reviewsSeed,
  users: customers,
  cart_items: [],
  contact_messages: [
    {
      id: 1,
      name: "Demo Visitor",
      email: "visitor@example.test",
      message: "I am interested in a demo partnership.",
      created_at: new Date().toISOString(),
    },
  ],
  newsletter_subscriptions: [
    { id: 1, email: "subscriber@example.test", created_at: new Date().toISOString() },
  ],
};

const clone = (value) => JSON.parse(JSON.stringify(value));

const readDb = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...clone(initialDb), ...JSON.parse(stored) } : clone(initialDb);
  } catch {
    return clone(initialDb);
  }
};

const writeDb = (db) => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

const demoSession = {
  user: {
    ...demoAdmin,
    user_metadata: { name: demoAdmin.name, role: demoAdmin.role },
  },
};

const withRelations = (table, row) => {
  if (table !== "cart_items") return row;
  const product = readDb().products.find((item) => String(item.id) === String(row.product_id));
  return {
    ...row,
    products: product
      ? {
          id: product.id,
          product_name: product.product_name,
          product_price: product.product_price,
          product_image: product.product_image,
        }
      : null,
  };
};

class DemoQuery {
  constructor(table) {
    this.table = table;
    this.filters = [];
    this.sort = null;
    this.limitCount = null;
    this.mode = "select";
    this.payload = null;
  }

  select() {
    return this;
  }

  eq(field, value) {
    this.filters.push({ field, value });
    return this;
  }

  order(field, options = {}) {
    this.sort = { field, ascending: options.ascending !== false };
    return this;
  }

  limit(count) {
    this.limitCount = count;
    return this;
  }

  insert(payload) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  update(payload) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  upsert(payload) {
    this.mode = "insert";
    this.payload = Array.isArray(payload) ? payload : [payload];
    return this;
  }

  single() {
    return this.then((result) => {
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      if (!row) return { data: null, error: { code: "PGRST116", message: "No rows found" } };
      return { data: row, error: null };
    });
  }

  maybeSingle() {
    return this.then((result) => {
      const row = Array.isArray(result.data) ? result.data[0] : result.data;
      return { data: row || null, error: null };
    });
  }

  then(resolve, reject) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }

  execute() {
    const db = readDb();
    db[this.table] = db[this.table] || [];

    if (this.mode === "insert") {
      const rows = this.payload.map((item) => ({
        id: item.id || Date.now() + Math.floor(Math.random() * 10000),
        created_at: item.created_at || new Date().toISOString(),
        ...item,
      }));
      db[this.table] = [...db[this.table], ...rows];
      writeDb(db);
      return { data: rows.map((row) => withRelations(this.table, row)), error: null };
    }

    const matches = (row) => this.filters.every(({ field, value }) => String(row[field]) === String(value));

    if (this.mode === "update") {
      let updated = [];
      db[this.table] = db[this.table].map((row) => {
        if (!matches(row)) return row;
        const next = { ...row, ...this.payload };
        updated.push(next);
        return next;
      });
      writeDb(db);
      return { data: updated.map((row) => withRelations(this.table, row)), error: null };
    }

    if (this.mode === "delete") {
      const removed = db[this.table].filter(matches);
      db[this.table] = db[this.table].filter((row) => !matches(row));
      writeDb(db);
      return { data: removed, error: null };
    }

    let data = db[this.table].filter(matches).map((row) => withRelations(this.table, row));
    if (this.sort) {
      const { field, ascending } = this.sort;
      data.sort((a, b) => {
        const left = a[field] || "";
        const right = b[field] || "";
        return ascending ? String(left).localeCompare(String(right)) : String(right).localeCompare(String(left));
      });
    }
    if (this.limitCount != null) data = data.slice(0, this.limitCount);
    return { data, error: null };
  }
}

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: demoSession }, error: null }),
    getUser: async () => ({ data: { user: demoSession.user }, error: null }),
    signUp: async ({ email }) => ({ data: { user: { ...demoCustomer, email } }, error: null }),
    signInWithPassword: async ({ email }) => ({
      data: { user: email === demoAdmin.email ? demoSession.user : { ...demoCustomer, email }, session: demoSession },
      error: null,
    }),
    signOut: async () => ({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
  },
  from: (table) => new DemoQuery(table),
  storage: {
    from: () => ({
      getPublicUrl: (path) => ({ data: { publicUrl: path || "/demo-product.svg" }, error: null }),
    }),
  },
};

export const isGuestUser = () => false;
