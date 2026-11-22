import { test } from "node:test";
import assert from "node:assert/strict";
import { quote } from "../src/pricing.js";
test("reviewed charges round half up once and bound quantities and monetary inputs", () => {
  assert.deepEqual(
    quote([{ unit: 101, qty: 1 }], { shipping: 25, taxBps: 5000 }),
    { subtotal: 101, shipping: 25, tax: 51, total: 177 },
  );
  for (const unit of [-1, NaN, Infinity, "3.00", 10000001])
    assert.throws(() => quote([{ unit, qty: 1 }], { shipping: 0, taxBps: 0 }));
  assert.throws(() =>
    quote([{ unit: 1, qty: 21 }], { shipping: 0, taxBps: 0 }),
  );
  assert.deepEqual(quote([], { shipping: 25, taxBps: 100 }), {
    subtotal: 0,
    shipping: 0,
    tax: 0,
    total: 0,
  });
});
