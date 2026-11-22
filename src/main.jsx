import React, { Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Product, Shop } from "./pages/Shop.jsx";
import { Cart, Detail, Orders } from "./pages/Orders.jsx";
import { Account, Contact } from "./pages/Account.jsx";
import { demo } from "@store";
import { go } from "./ui.jsx";
import "./style.css";
const Admin = lazy(() => import("./pages/Admin.jsx"));
const information = {
  about: [
    "About Folio Supply",
    "A small, independently designed stationery collection for exploring a complete shop workflow. All products and profiles are fictional.",
  ],
  faq: [
    "Common questions",
    "Where is my order stored? This browser keeps the catalog, basket and orders on your device. Use the same browser to return to an order.",
  ],
  blog: [
    "Studio journal",
    "An undated planner can start on any week. Pair a weekly spread with a small stack of index cards for daily notes.",
  ],
  terms: [
    "Demo terms and privacy",
    "No goods are sold or shipped. Use fictional details only. Clear this site’s browser storage to erase all local demo records.",
  ],
};
function App() {
  const [path, route] = useState(location.pathname),
    [version, update] = useState(0);
  const refresh = () => update((n) => n + 1);
  useEffect(() => {
    function nav() {
      route(location.pathname);
      refresh();
      window.scrollTo(0, 0);
      requestAnimationFrame(() => document.querySelector("main")?.focus());
    }
    function click(e) {
      const a = e.target.closest?.("a[href]");
      if (
        !a ||
        a.origin !== location.origin ||
        a.hash ||
        a.target ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        e.shiftKey
      )
        return;
      e.preventDefault();
      go(a.pathname + a.search);
    }
    window.addEventListener("popstate", nav);
    window.addEventListener("storage", refresh);
    window.addEventListener("folio-session", refresh);
    document.addEventListener("click", click);
    return () => {
      window.removeEventListener("popstate", nav);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("folio-session", refresh);
      document.removeEventListener("click", click);
    };
  }, []);
  const [page = "", id, extra] = path.replace(/^\//, "").split("/");
  const common = { version, refresh };
  let view;
  if (!extra && page === "products" && id)
    view = <Product key={id} id={id} {...common} />;
  else if (!extra && page === "orders" && id)
    view = <Detail id={id} {...common} />;
  else if (!id && ["", "products"].includes(page))
    view = <Shop home={!page} {...common} />;
  else if (!id && ["cart", "checkout"].includes(page))
    view = <Cart checkout={page === "checkout"} {...common} />;
  else if (!id && page === "orders") view = <Orders {...common} />;
  else if (!id && ["auth", "login", "profile"].includes(page))
    view = <Account {...common} />;
  else if (!id && page === "admin") view = <Admin {...common} />;
  else if (!id && page === "contact") view = <Contact {...common} />;
  else if (!id && Object.hasOwn(information, page))
    view = (
      <>
        <h1>{information[page][0]}</h1>
        <p>{information[page][1]}</p>
      </>
    );
  else
    view = (
      <>
        <h1>Page not found</h1>
        <a href="/products">Return to the collection</a>
      </>
    );
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <header className="mast">
        <a className="brand" href="/">
          Folio Supply
        </a>
        <nav aria-label="Shop">
          <a href="/products">Collection</a>
          <a href="/orders">Orders</a>
          <a href="/auth">Account</a>
          <a className="bag" href="/cart">
            Basket
          </a>
        </nav>
      </header>
      <div className="mode">
        {demo ? "Isolated demo · No money charged" : "Authorized sandbox"}
      </div>
      <main id="main" tabIndex="-1">
        <Suspense fallback={<p>Loading studio…</p>}>{view}</Suspense>
      </main>
      <footer>
        <strong>Folio Supply</strong>
        <nav aria-label="Information">
          {Object.keys(information)
            .concat("contact", "admin")
            .map((k) => (
              <a key={k} href={"/" + k}>
                {k === "blog" ? "Journal" : k}
              </a>
            ))}
        </nav>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
