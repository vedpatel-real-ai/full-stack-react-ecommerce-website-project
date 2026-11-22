import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
async function addNotebook(page) {
  await page.goto("/products/ledger");
  await page.getByLabel("Edition").selectOption("ledger-a6");
  await page.getByRole("button", { name: "Add to basket" }).click();
  await expect(
    page.getByText("Added to basket.", { exact: true }),
  ).toBeVisible();
}
test("edition survives guest checkout, refresh, delayed confirmation and statement", async ({
  page,
}) => {
  const outside = [];
  page.on("request", (r) => {
    if (
      /^https?:/.test(r.url()) &&
      !r.url().startsWith("http://127.0.0.1:4187/")
    )
      outside.push(new URL(r.url()).origin);
  });
  await addNotebook(page);
  await page.getByRole("link", { name: "View basket" }).click();
  await expect(page.getByText("A6 / Ochre · ledger-a6")).toBeVisible();
  await page.getByRole("link", { name: "Review checkout" }).click();
  await page.getByRole("button", { name: "Create demo order" }).click();
  await expect(page.getByRole("heading", { name: /Order F/ })).toBeVisible();
  await page.goto(page.url() + "?status=paid");
  await expect(
    page.getByText("pending", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "declined", exact: true }).click();
  await expect(page.getByText("reconciling", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "captured", exact: true }).click();
  await expect(page.getByText("resolved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("A6 / Ochre · ledger-a6")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Print order statement" }),
  ).toBeVisible();
  if (process.env.CAPTURE_SCREENS) {
    await mkdir("docs/images", { recursive: true });
    await page.screenshot({ path: "docs/images/order.png", fullPage: true });
  }
  await page.getByRole("link", { name: "All orders" }).click();
  await expect(page.getByText(/Demo captured/)).toBeVisible();
  expect(outside).toEqual([]);
});
test("staff actions require an explicit local staff profile and COD delivery", async ({
  page,
}) => {
  await page.goto("/admin");
  await expect(
    page.getByRole("link", { name: /synthetic staff/ }),
  ).toBeVisible();
  await addNotebook(page);
  await page.goto("/checkout");
  await page.getByLabel("Payment scenario").selectOption("cod");
  await page.getByRole("button", { name: "Create demo order" }).click();
  await expect(page.getByRole("heading", { name: /Order F/ })).toBeVisible();
  await page.goto("/auth");
  await page.getByRole("button", { name: "Open staff profile" }).click();
  for (const action of ["packing", "shipped", "delivered", "cod-collected"]) {
    await page.locator("summary").filter({ hasText: /F\d/ }).click();
    await page
      .getByRole("combobox", { name: "Action", exact: true })
      .selectOption(action);
    await page.getByLabel("Staff note").fill("Synthetic fulfilment check");
    await page.getByRole("button", { name: "Record action" }).click();
    await expect(page.locator("summary")).toContainText(
      action === "cod-collected" ? "captured" : action,
    );
  }
  await page.getByRole("button", { name: "events", exact: true }).click();
  await expect(page.getByText("cod-collected", { exact: true })).toBeVisible();
});
test("two guest tabs merge basket quantities once into a restored account", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all([addNotebook(page), addNotebook(other)]);
  await other.close();
  await page.goto("/auth");
  await page.getByRole("button", { name: "Open customer profile" }).click();
  await expect(page).toHaveURL(/profile$/);
  await page.goto("/cart");
  await expect(page.getByText("2 × ₹320.00")).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 × ₹320.00")).toBeVisible();
});
test("contact submissions are available to local staff", async ({ page }) => {
  await page.goto("/contact");
  const form = page.locator("form").first();
  await form.getByLabel("Sample email").fill("paper@example.invalid");
  await form
    .getByLabel("Message", { exact: true })
    .fill("Sample order question");
  await form.getByRole("checkbox").check();
  await form.getByRole("button").click();
  await expect(page.getByRole("status")).toContainText("Saved");
  await page.goto("/auth");
  await page.getByRole("button", { name: "Open staff profile" }).click();
  await page.getByRole("button", { name: "contact", exact: true }).click();
  await expect(
    page.getByText("Sample order question", { exact: true }),
  ).toBeVisible();
});
for (const [width, height] of [
  [390, 844],
  [768, 1024],
  [1280, 900],
  [1600, 1000],
])
  test("collection is accessible at " + width, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: "Ledger notebook" }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
    if (process.env.CAPTURE_SCREENS && [390, 1280].includes(width)) {
      await mkdir("docs/images", { recursive: true });
      await page.screenshot({
        path: "docs/images/collection-" + width + ".png",
        fullPage: true,
      });
    }
    await page.goto("/missing");
    await expect(
      page.getByRole("heading", { name: "Page not found" }),
    ).toBeVisible();
  });
test("public API fails closed and empty baskets cannot begin a payment", async ({
  page,
  request,
}) => {
  const res = await request.post("/api/create-order", { data: {} });
  expect(res.status()).toBe(503);
  expect(res.headers()["content-type"]).toContain("application/json");
  await page.goto("/checkout");
  await expect(page.getByText(/Your basket is empty/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create demo order" }),
  ).toHaveCount(0);
  await page.goto("/orders/11111111-1111-4111-8111-111111111111?paid=true");
  await expect(
    page.getByRole("heading", { name: "Order unavailable" }),
  ).toBeVisible();
});
test("moderation publishes a customer review and staff updates edition availability", async ({
  page,
}) => {
  await page.goto("/auth");
  await page.getByRole("button", { name: "Open customer profile" }).click();
  await expect(page).toHaveURL(/profile$/);
  await page.goto("/products/ledger");
  await page
    .getByLabel("Review", { exact: true })
    .fill("A synthetic reader note");
  await page.getByRole("button", { name: "Submit review" }).click();
  await expect(page.getByText("Submitted for moderation.")).toBeVisible();
  await page.goto("/auth");
  await page.getByRole("button", { name: "Open staff profile" }).click();
  await page.getByRole("button", { name: "reviews", exact: true }).click();
  await page.getByRole("button", { name: "Publish review" }).click();
  await expect(page.getByText("Review published.")).toBeVisible();
  await page.getByRole("button", { name: "catalog", exact: true }).click();
  const edition = page.locator("form.panel").filter({ hasText: "ledger-a5" });
  await edition.getByRole("checkbox").uncheck();
  await edition.getByRole("button", { name: "Save edition" }).click();
  await expect(page.getByText("Catalog updated.")).toBeVisible();
  await page.goto("/products/ledger");
  await expect(
    page.getByRole("button", { name: "Add to basket" }),
  ).toBeDisabled();
  await expect(page.getByText("5/5 · A synthetic reader note")).toBeVisible();
});
