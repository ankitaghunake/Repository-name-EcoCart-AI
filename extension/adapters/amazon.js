(() => {
  const text = (element) => element?.innerText?.replace(/\s+/g, " ").trim() || "";
  const firstText = (root, selectors) => {
    for (const selector of selectors) {
      const value = text(root.querySelector(selector));
      if (value) return value;
    }
    return "";
  };
  const productUrl = (root) => {
    const link = root.querySelector('a[href*="/dp/"], a[href*="/gp/product/"]');
    if (!link) return "";
    try {
      const url = new URL(link.href, location.href);
      return url.origin === location.origin ? url.href : "";
    } catch {
      return "";
    }
  };
  const quantity = (root) => {
    const control = root.querySelector('select[name*="quantity"], input[name*="quantity"], [data-a-selector="quantity"]');
    const value = Number.parseInt(control?.value || control?.textContent || "1", 10);
    return Number.isFinite(value) && value > 0 ? Math.min(value, 999) : 1;
  };
  const getCartItems = () => {
    const activeCart = document.querySelector("#sc-active-cart");
    const scope = activeCart || document;
    const roots = [...new Set([
      ...scope.querySelectorAll(".sc-list-item[data-asin], [data-asin].sc-list-item, [data-itemid]"),
      ...scope.querySelectorAll(".sc-list-item, [data-asin], li[id*='sc-item'], div[id*='sc-item']"),
    ])];
    const seen = new Set();
    return roots.map((root) => {
      const url = productUrl(root);
      const name = firstText(root, [
        ".sc-product-title",
        '[data-cy="title-recipe"] h2 a',
        "h2 a span",
        'a[href*="/dp/"] span',
        'a[href*="/dp/"]',
        "h2",
      ]);
      if (!name || !url || seen.has(url)) return null;
      seen.add(url);
      const image = root.querySelector("img");
      const asin = root.getAttribute("data-asin")
        || root.getAttribute("data-itemid")
        || url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{8,14})/i)?.[1]
        || "";
      return {
        name,
        url,
        price: firstText(root, [".sc-product-price", '[data-a-color="price"] .a-offscreen', ".a-price .a-offscreen"]),
        quantity: quantity(root),
        image: image?.currentSrc || image?.src || "",
        productId: asin,
        category: firstText(root, ["[data-category]", '[data-cy="product-category"]']),
        brand: firstText(root, [".sc-product-brand", '[data-cy="product-brand"]']),
        material: "",
        source: "amazon",
      };
    }).filter(Boolean);
  };
  const isCartPage = () => Boolean(
    document.querySelector("#sc-active-cart") || /\/(?:cart|gp\/cart)(?:\/|$)/i.test(location.pathname)
  );
  const searchUrl = (name) => {
    const domain = location.hostname.match(/amazon\.[a-z.]+$/i)?.[0] || "amazon.com";
    return `https://www.${domain}/s?k=${encodeURIComponent(name)}`;
  };
  window.EcoCartAdapters = window.EcoCartAdapters || {};
  window.EcoCartAdapters.amazon = { getCartItems, isCartPage, searchUrl };
})();