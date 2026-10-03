(() => {
  const text = (element) => element?.innerText?.replace(/\s+/g, " ").trim() || "";
  const firstText = (root, selectors) => {
    for (const selector of selectors) {
      const value = text(root.querySelector(selector));
      if (value) return value;
    }
    return "";
  };
  const isCartPage = () => /\/(?:cart|basket|bag|checkout)(?:\/|$)/i.test(location.pathname)
    || Boolean(document.querySelector('[aria-label*="shopping cart" i], [data-testid*="cart-page" i]'));
  const itemRoots = () => {
    const selectors = [
      '[data-testid*="cart-item" i]',
      '[data-test*="cart-item" i]',
      '[class*="cart-item" i]',
      '[class*="cartItem"]',
      '[class*="CartItem"]',
      "[data-product-id]",
      "[data-item-id]",
      "[data-sku]",
    ];
    const unique = new Set();
    for (const selector of selectors) {
      document.querySelectorAll(selector).forEach((element) => {
        if (element.querySelector("a[href]") && element.querySelector("img")) unique.add(element);
      });
    }
    return [...unique].filter((element) => ![...unique].some((other) => other !== element && other.contains(element)));
  };
  const getCartItems = () => {
    const seen = new Set();
    return itemRoots().map((root) => {
      const link = root.querySelector('a[href*="/products/"], a[href*="/product/"], a[href*="/dp/"], a[href]');
      let url = "";
      try {
        const candidate = new URL(link?.href || "", location.href);
        if (["http:", "https:"].includes(candidate.protocol)) url = candidate.href;
      } catch { /* Leave product URLs blank when the page does not expose one. */ }
      const name = firstText(root, [
        '[data-testid*="product-title" i]',
        '[class*="product-title" i]',
        '[class*="productName" i]',
        "h2", "h3", "a[title]", "a",
      ]) || "Unnamed cart product";
      const key = url || root.getAttribute("data-product-id") || root.getAttribute("data-sku") || name;
      if (seen.has(key)) return null;
      seen.add(key);
      const quantityControl = root.querySelector('input[type="number"], select[name*="quantity" i], [aria-label*="quantity" i]');
      const parsedQuantity = Number.parseInt(quantityControl?.value || quantityControl?.textContent || "1", 10);
      const image = root.querySelector("img");
      return {
        name,
        url,
        price: firstText(root, ['[class*="price" i]', '[data-testid*="price" i]', '[itemprop="price"]']),
        quantity: Number.isFinite(parsedQuantity) && parsedQuantity > 0 ? Math.min(parsedQuantity, 999) : 1,
        image: image?.currentSrc || image?.src || "",
        productId: root.getAttribute("data-product-id") || root.getAttribute("data-item-id") || root.getAttribute("data-sku") || "",
        category: firstText(root, ['[data-category]', '[itemprop="category"]']),
        brand: firstText(root, ['[itemprop="brand"]', '[class*="brand" i]']),
        material: "",
        source: location.hostname.replace(/^www\./, "") || "shopping site",
      };
    }).filter(Boolean);
  };
  const searchUrl = (name) => `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(name)}`;
  window.EcoCartAdapters = window.EcoCartAdapters || {};
  window.EcoCartAdapters.generic = { getCartItems, isCartPage, searchUrl };
})();