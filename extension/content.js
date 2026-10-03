(() => {
  if (window.__ecoCartWatcher) {
    window.__ecoCartWatcher.refresh();
    return;
  }

  const host = location.hostname.toLowerCase();
  const adapter = /(^|\.)amazon\.[a-z.]+$/i.test(host)
    ? window.EcoCartAdapters?.amazon
    : window.EcoCartAdapters?.generic;
  let timer = 0;
  const snapshot = () => ({
    source: adapter === window.EcoCartAdapters?.amazon ? "amazon" : host.replace(/^www\./, "") || "shopping site",
    supported: Boolean(adapter?.isCartPage()),
    cartPage: Boolean(adapter?.isCartPage()),
    products: adapter?.isCartPage() ? adapter.getCartItems() : [],
    pageUrl: location.href,
    searchBase: adapter?.searchUrl("__PRODUCT__") || "",
  });
  const refresh = () => {
    const data = snapshot();
    chrome.runtime.sendMessage({ type: "ECOCART_CART_CHANGED", data }, () => void chrome.runtime.lastError);
    return data;
  };
  const scheduleRefresh = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(refresh, 450);
  };
  window.__ecoCartWatcher = { refresh };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "ECOCART_GET_CART") {
      sendResponse(refresh());
    }
  });

  document.addEventListener("change", (event) => {
    if (event.target.matches('input, select, [aria-label*="quantity" i]')) scheduleRefresh();
  }, true);
  document.addEventListener("input", (event) => {
    if (event.target.matches('input[type="number"], input[name*="quantity" i]')) scheduleRefresh();
  }, true);
  new MutationObserver(scheduleRefresh).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["value", "data-quantity", "aria-label"],
  });
  refresh();
})();