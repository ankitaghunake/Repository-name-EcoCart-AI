chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "ECOCART_CART_CHANGED" || !Number.isInteger(sender.tab?.id)) return;
  chrome.storage.local.set({ [`ecocart-cart-${sender.tab.id}`]: message.data });
});