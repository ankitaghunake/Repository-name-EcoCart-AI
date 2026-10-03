const DEFAULT_API = "http://localhost:8000";
const DEFAULT_DASHBOARD = "http://localhost:5173";
const elements = {
  host: document.getElementById("page-host"),
  count: document.getElementById("product-count"),
  state: document.getElementById("cart-state"),
  products: document.getElementById("cart-products"),
  analyze: document.getElementById("analyze-button"),
  status: document.getElementById("action-status"),
  analysis: document.getElementById("analysis-section"),
};

let activeTab = null;
let cartSnapshot = null;
let cartProducts = [];
let selectedIds = new Set();
let analyses = [];
let apiBase = DEFAULT_API;
let dashboardBase = DEFAULT_DASHBOARD;
let busy = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function safeText(value, fallback = "Not provided") {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return fallback;
  return String(value);
}

function productKey(product) {
  return String(product.productId || product.url || `${product.name}-${product.source}`);
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function getGrade(score) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Very good";
  if (score >= 55) return "Good";
  return "Needs improvement";
}

function scorePercent(value) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : 0;
}

async function loadSettings() {
  const values = await chrome.storage.sync.get({ apiBaseUrl: DEFAULT_API, dashboardBaseUrl: DEFAULT_DASHBOARD });
  apiBase = (safeHttpUrl(values.apiBaseUrl) || DEFAULT_API).replace(/\/$/, "");
  dashboardBase = (safeHttpUrl(values.dashboardBaseUrl) || DEFAULT_DASHBOARD).replace(/\/$/, "");
}

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle("is-error", error);
}

function updateAnalyzeButton() {
  const selectedCount = selectedIds.size;
  elements.analyze.disabled = !selectedCount || busy;
  elements.analyze.querySelector("span:first-child").textContent = busy
    ? "Analyzing selected products..."
    : selectedCount > 1 ? `Analyze ${selectedCount} selected products` : "Analyze with EcoCart AI";
}

function renderState(message, kind = "info") {
  elements.state.hidden = false;
  elements.state.className = `state-panel ${kind}`;
  elements.state.innerHTML = message;
  elements.products.hidden = true;
  elements.analyze.disabled = true;
  elements.count.textContent = "0";
}

function renderCart() {
  elements.count.textContent = String(cartProducts.length);
  if (!cartSnapshot?.supported) {
    renderState("<strong>Open a shopping cart to get started</strong><span>Amazon cart pages are supported first. Other cart pages use the generic adapter.</span>", "info");
    return;
  }
  if (!cartProducts.length) {
    renderState("<strong>Your cart is empty</strong><span>Add a product on this store, then this list will refresh automatically.</span>", "info");
    return;
  }

  elements.state.hidden = true;
  elements.products.hidden = false;
  elements.products.innerHTML = cartProducts.map((product) => {
    const key = productKey(product);
    const image = safeHttpUrl(product.image);
    const selected = selectedIds.has(key);
    return `<label class="cart-product ${selected ? "selected" : ""}">
      <input class="product-checkbox" type="checkbox" data-product-key="${escapeHtml(key)}" ${selected ? "checked" : ""}>
      ${image ? `<img class="cart-image" src="${escapeHtml(image)}" alt="" loading="lazy">` : `<span class="cart-image image-placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 8h14l1 12H4L5 8Z" stroke="currentColor" stroke-width="1.6"/><path d="M9 9V6a3 3 0 0 1 6 0v3" stroke="currentColor" stroke-width="1.6"/></svg></span>`}
      <span class="cart-product-copy"><strong>${escapeHtml(safeText(product.name, "Unnamed product"))}</strong><span>${escapeHtml(safeText(product.price, "Price unavailable"))} <i></i> Qty ${escapeHtml(safeText(product.quantity, "1"))}</span></span>
      <span class="checkmark" aria-hidden="true">✓</span>
    </label>`;
  }).join("");
  updateAnalyzeButton();
}

function searchUrlFor(name) {
  const template = cartSnapshot?.searchBase;
  if (typeof template === "string" && template.includes("__PRODUCT__")) {
    const url = safeHttpUrl(template.replace("__PRODUCT__", encodeURIComponent(name)));
    if (url) return url;
  }
  return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(name)}`;
}

function renderAlternatives(alternatives, source) {
  if (!alternatives?.length) return `<div class="empty-alternatives">No suitable greener alternative was found in this category.</div>`;
  const sourceLabel = source === "amazon" ? "Search on Amazon" : "View shopping results";
  return alternatives.slice(0, 3).map((alternative) => {
    const product = alternative.product || {};
    const score = scorePercent(product.eco_score);
    const carbonSaving = Number(alternative.carbon_saving);
    const carbonText = Number.isFinite(carbonSaving) ? `${carbonSaving.toFixed(2)} kg CO₂e` : "Not available";
    const improvement = Number(alternative.improvement);
    const similarity = Number(alternative.similarity);
    const reduction = Number(alternative.carbon_reduction_percentage);
    return `<article class="alternative-card">
      <div class="alternative-top"><span class="alternative-kicker">BETTER ALTERNATIVE</span><span class="alternative-score">${score}<small>/100</small></span></div>
      <h3>${escapeHtml(safeText(product.name, "Catalog product"))}</h3>
      <p class="alternative-brand">${escapeHtml(safeText(product.brand, "EcoCart catalog"))} · ${escapeHtml(getGrade(score))}</p>
      <div class="alternative-details"><span><small>Material</small>${escapeHtml(safeText(product.material))}</span><span><small>Certification</small>${escapeHtml(safeText(product.certification, "No certification listed"))}</span></div>
      <div class="alternative-metrics"><span>Similarity <b>${Number.isFinite(similarity) ? `${Math.round(similarity)}%` : "—"}</b></span><span>Eco improvement <b>${Number.isFinite(improvement) ? `+${improvement}` : "—"}</b></span><span>Carbon saving <b>${escapeHtml(carbonText)}</b></span><span>Reduction <b>${Number.isFinite(reduction) ? `${reduction}%` : "—"}</b></span></div>
      <a class="search-alternative" href="${escapeHtml(searchUrlFor(product.name || "sustainable alternative"))}" target="_blank" rel="noreferrer">${escapeHtml(sourceLabel)} <span aria-hidden="true">↗</span></a>
    </article>`;
  }).join("");
}

function renderSingleAnalysis(result) {
  if (!result.success || !result.matched_product?.product) {
    return `<article class="analysis-card error-card"><strong>Product could not be matched</strong><p>${escapeHtml(safeText(result.message, "No matching dataset product was found."))}</p></article>`;
  }
  const matched = result.matched_product;
  const product = matched.product;
  const sustainability = result.sustainability || {};
  const score = scorePercent(result.eco_score?.score ?? product.eco_score);
  const isUncertain = matched.confidence !== "high";
  return `<article class="analysis-card">
    <div class="analysis-card-heading"><div><span class="eyebrow">${isUncertain ? "CLOSEST DATASET MATCH" : "DATASET MATCH"}</span><h2>${escapeHtml(safeText(product.name, "Matched product"))}</h2><p>${escapeHtml(safeText(product.brand, ""))} · ${escapeHtml(safeText(product.category, "Category unavailable"))}</p></div><div class="eco-score-ring" style="--score:${score}"><span>${score}<small>/100</small></span></div></div>
    ${isUncertain ? `<p class="match-warning">${escapeHtml(safeText(result.message, "Exact product not found. Showing the closest matching product from the EcoCart dataset."))} <b>${Math.round(scorePercent(matched.similarity * 100))}% similarity</b></p>` : `<p class="match-confirmed">Matched with ${Math.round(scorePercent(matched.similarity * 100))}% similarity</p>`}
    <div class="score-track"><span style="width:${score}%"></span></div>
    <div class="grade-line"><span>${escapeHtml(safeText(result.eco_score?.grade, getGrade(score)))}</span><span>Eco Score</span></div>
    <div class="sustainability-grid">
      <div><small>Material</small><strong>${escapeHtml(safeText(sustainability.material))}</strong></div>
      <div><small>Eco certification</small><strong>${escapeHtml(safeText(sustainability.certification))}</strong></div>
      <div><small>Manufacturing carbon</small><strong>${escapeHtml(safeText(sustainability.manufacturing_emission))} kg CO₂e</strong></div>
      <div><small>Recyclability</small><strong>${escapeHtml(safeText(sustainability.recyclability_rate))}%</strong></div>
      <div><small>Recycled material</small><strong>${sustainability.recycled_material === true ? "Recorded" : sustainability.recycled_material === false ? "Not recorded" : "Not in dataset"}</strong></div>
      <div><small>Water / carbon offset</small><strong>Not in dataset</strong></div>
    </div>
    <div class="section-heading result-heading"><div><span class="eyebrow">SAME CATEGORY · HIGHER ECO SCORE</span><h2>Better sustainable alternatives</h2></div><span class="leaf-mark" aria-hidden="true">✳</span></div>
    <div class="alternative-list">${renderAlternatives(result.alternatives, result.source)}</div>
    <button class="full-analysis-button" type="button" data-product-id="${escapeHtml(matched.product_id || product.id)}">Open full EcoCart analysis <span aria-hidden="true">↗</span></button>
  </article>`;
}

function renderAnalyses() {
  if (!analyses.length) {
    elements.analysis.innerHTML = "";
    return;
  }
  if (analyses.length === 1) {
    elements.analysis.innerHTML = renderSingleAnalysis(analyses[0]);
    return;
  }
  const valid = analyses.filter((result) => result.success && result.eco_score);
  const average = valid.length
    ? Math.round(valid.reduce((sum, result) => sum + scorePercent(result.eco_score.score), 0) / valid.length)
    : 0;
  const needImprovement = valid.filter((result) => scorePercent(result.eco_score.score) < 70).length;
  const alternativesCount = valid.reduce((sum, result) => sum + (result.alternatives?.length || 0), 0);
  elements.analysis.innerHTML = `<div class="multi-summary"><span class="eyebrow">CART IMPACT SNAPSHOT</span><h2>${analyses.length} products analyzed</h2><div class="summary-metrics"><div><strong>${average || "—"}</strong><span>Average Eco Score</span></div><div><strong>${needImprovement}</strong><span>Need improvement</span></div><div><strong>${alternativesCount}</strong><span>Better alternatives</span></div></div></div>${analyses.map(renderSingleAnalysis).join("")}`;
}

async function getCurrentCart() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab || null;
  if (!activeTab?.id) {
    cartSnapshot = null;
    cartProducts = [];
    renderCart();
    return;
  }
  try {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["adapters/amazon.js", "adapters/generic.js", "content.js"],
    });
    cartSnapshot = await new Promise((resolve) => {
      chrome.tabs.sendMessage(activeTab.id, { type: "ECOCART_GET_CART" }, (response) => {
        if (chrome.runtime.lastError) resolve(null);
        else resolve(response || null);
      });
    });
  } catch {
    cartSnapshot = null;
  }
  if (cartSnapshot) {
    cartProducts = Array.isArray(cartSnapshot.products) ? cartSnapshot.products : [];
    const nextIds = new Set(cartProducts.map(productKey));
    selectedIds = new Set([...selectedIds].filter((key) => nextIds.has(key)));
    if (!selectedIds.size && cartProducts.length) selectedIds = new Set(cartProducts.map(productKey));
    elements.host.textContent = safeText(cartSnapshot.source, "Shopping site");
  } else {
    cartSnapshot = { supported: false, source: "unknown", products: [] };
    cartProducts = [];
    elements.host.textContent = "Current page unavailable";
  }
  renderCart();
}

async function analyzeSelected() {
  const selected = cartProducts.filter((product) => selectedIds.has(productKey(product)));
  if (!selected.length) return;
  busy = true;
  analyses = [];
  renderAnalyses();
  updateAnalyzeButton();
  setStatus("Analyzing product... Finding dataset matches and greener alternatives...");
  try {
    analyses = await Promise.all(selected.map(async (product, index) => {
      if (index > 0) setStatus(`Analyzing product ${index + 1} of ${selected.length}...`);
      const response = await fetch(`${apiBase}/extension/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail || `EcoCart API returned ${response.status}`);
      return data;
    }));
    const matches = analyses.filter((result) => result.success).length;
    setStatus(matches
      ? `${matches} of ${analyses.length} products matched the EcoCart dataset.`
      : "No selected product matched the current EcoCart dataset.", !matches);
    renderAnalyses();
  } catch (error) {
    analyses = [];
    renderAnalyses();
    const message = /fetch|network|failed to fetch/i.test(error.message)
      ? "EcoCart backend is not running or cannot be reached. Start the FastAPI service and check Extension settings."
      : error.message || "Could not analyze the selected products.";
    setStatus(message, true);
  } finally {
    busy = false;
    updateAnalyzeButton();
  }
}

function openFullAnalysis(productId) {
  const url = new URL(dashboardBase);
  if (productId) url.searchParams.set("product_id", productId);
  chrome.tabs.create({ url: url.toString() });
}

document.getElementById("settings").addEventListener("click", () => chrome.runtime.openOptionsPage());
elements.analyze.addEventListener("click", analyzeSelected);
elements.products.addEventListener("change", (event) => {
  const checkbox = event.target.closest("input[data-product-key]");
  if (!checkbox) return;
  const key = checkbox.dataset.productKey;
  if (checkbox.checked) selectedIds.add(key);
  else selectedIds.delete(key);
  renderCart();
});
elements.analysis.addEventListener("click", (event) => {
  const button = event.target.closest(".full-analysis-button");
  if (button) openFullAnalysis(button.dataset.productId);
});
document.getElementById("dashboard-link").addEventListener("click", () => openFullAnalysis());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !activeTab?.id || !changes[`ecocart-cart-${activeTab.id}`]) return;
  const next = changes[`ecocart-cart-${activeTab.id}`].newValue;
  if (!next) return;
  cartSnapshot = next;
  cartProducts = Array.isArray(next.products) ? next.products : [];
  const available = new Set(cartProducts.map(productKey));
  selectedIds = new Set([...selectedIds].filter((key) => available.has(key)));
  renderCart();
});

async function start() {
  try {
    await loadSettings();
    await getCurrentCart();
  } catch {
    renderState("<strong>EcoCart could not read this tab</strong><span>Open a supported shopping cart and try again.</span>", "error");
  }
}

start();