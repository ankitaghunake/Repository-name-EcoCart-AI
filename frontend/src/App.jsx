import { useEffect, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, BadgeCheck, ChevronDown, CircleHelp,
  ExternalLink, Leaf, LoaderCircle, PackageCheck, Recycle, Search, Send,
  ShieldCheck, Shirt, ShoppingCart, SlidersHorizontal, Sparkles, Star,
  Trash2, Truck, Wind,
} from "lucide-react";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const CATEGORIES = ["All pieces", "T-Shirts", "Shirts", "Jeans", "Hoodies", "Jackets", "Dresses", "Trousers"];
const CART_STORAGE_KEY = "ecocart-shopping-cart";

function getInitialCart() {
  try {
    const cart = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    return Array.isArray(cart) ? cart : [];
  } catch {
    return [];
  }
}

function safeWebUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

async function api(path, options) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => null);
    throw new Error(detail?.detail || `Request failed (${response.status})`);
  }
  return response.json();
}

function ScoreBadge({ score, large = false }) {
  const tone = score >= 75 ? "high" : score >= 55 ? "mid" : "low";
  return <span className={`score-badge ${tone} ${large ? "score-badge-large" : ""}`}>{score}<small>/100</small></span>;
}

function ScoreBar({ score }) {
  return <div className="score-bar" aria-label={`Eco Score ${score} out of 100`}><span style={{ width: `${score}%` }} /></div>;
}

function ProductCard({ product, active, onSelect }) {
  return (
    <button className={`product-card ${active ? "is-active" : ""}`} onClick={() => onSelect(product)}>
      <div className="product-image-wrap">
        <img className="product-image" src={product.image} alt={product.name} loading="lazy" />
        <ScoreBadge score={product.eco_score} />
      </div>
      <div className="product-copy">
        <span className="product-brand">{product.brand}</span>
        <span className="product-name">{product.name}</span>
        <span className="product-meta">{product.category}<i />${product.price.toFixed(2)}</span>
      </div>
    </button>
  );
}

function CartItemRow({ item, onRemove, onReplace }) {
  const [alternatives, setAlternatives] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setAlternatives(null);
    setError("");
    const request = item.source === "store"
      ? api("/extension/analyze", {
        method: "POST",
        body: JSON.stringify({
          name: item.name,
          url: item.product_url,
          price: item.price,
          quantity: item.quantity || 1,
          image: item.image,
          product_id: item.product_id || "",
          category: item.category,
          brand: item.brand,
          material: item.material,
          source: "store",
        }),
      }).then((result) => result.alternatives.map((match) => match.product))
      : api(`/api/products/${encodeURIComponent(item.id)}/recommendations?limit=3`)
        .then((result) => result.alternatives.map((match) => match.product));
    request
      .then((matches) => { if (!cancelled) setAlternatives(matches); })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); });
    return () => { cancelled = true; };
  }, [item]);

  const productUrl = safeWebUrl(item.product_url);
  const imageUrl = safeWebUrl(item.image);
  return (
    <article className="cart-item">
      <div className="cart-item-top">
        {imageUrl ? <img className="cart-item-image" src={imageUrl} alt="" /> : <span className="cart-item-image image-placeholder"><Shirt size={20} /></span>}
        <div className="cart-item-copy">
          <span className="eyebrow">{item.source === "store" ? "IMPORTED STORE LISTING" : "ECOCART CATALOG"}</span>
          <strong>{item.name}</strong>
          <span>{item.brand}{item.category ? ` · ${item.category}` : ""}{item.price ? ` · ${item.price}` : ""}</span>
          {item.material && <small>Material: {item.material}</small>}
        </div>
        <div className="cart-item-actions">
          {productUrl && <a href={productUrl} target="_blank" rel="noreferrer" aria-label="Open store product"><ExternalLink size={15} /></a>}
          <button type="button" onClick={() => onRemove(item)} aria-label={`Remove ${item.name} from cart`}><Trash2 size={15} /></button>
        </div>
      </div>
      {item.source === "store" && <p className="import-disclaimer">Store-page sustainability attributes may be incomplete. Eco Scores below belong to EcoCart dataset products.</p>}
      <div className="cart-alternatives">
        <div className="cart-match-heading"><span className="eyebrow">{item.source === "store" ? "SIMILAR, HIGHER-SCORING PICKS" : "GREENER ALTERNATIVES"}</span>{item.source === "store" && <small>Category + material + price, ranked by Eco Score</small>}</div>
        {error ? <p className="inline-error">{error}</p> : alternatives === null ? <p className="cart-loading"><LoaderCircle className="spin" size={14} /> Comparing attributes...</p> : alternatives.length ? alternatives.map((product) => (
          <div className="cart-match" key={product.id}>
            <img src={safeWebUrl(product.image)} alt="" loading="lazy" />
            <span><strong>{product.name}</strong><small>{product.material} · Eco Score {product.eco_score}</small></span>
            <button type="button" onClick={() => onReplace(item, product)}>Swap</button>
          </div>
        )) : <p className="cart-empty-match">No dataset alternatives found for this category.</p>}
      </div>
    </article>
  );
}

function CartView({ cart, onBrowse, onRemove, onReplace }) {
  return (
    <section className="cart-view">
      <div className="cart-view-heading"><div><span className="eyebrow">YOUR ECOCART</span><h1>Shopping cart</h1><p>Compare each item with closer, higher-scoring options from the EcoCart catalog.</p></div><span className="cart-total">{cart.length} {cart.length === 1 ? "item" : "items"}</span></div>
      {cart.length ? <div className="cart-items">{cart.map((item) => <CartItemRow key={item.id} item={item} onRemove={onRemove} onReplace={onReplace} />)}</div> : <div className="cart-empty"><ShoppingCart size={25} /><h2>Your cart is empty</h2><p>Add a catalog item or import a clothing listing with the EcoCart browser extension.</p><button type="button" onClick={onBrowse}>Browse catalog</button></div>}
    </section>
  );
}

function Metric({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className="metric">
      <span className={`metric-icon ${tone}`}><Icon size={17} strokeWidth={1.8} /></span>
      <div className="metric-copy"><span className="metric-label">{label}</span><strong>{value}</strong><span className="metric-detail">{detail}</span></div>
    </div>
  );
}

function RecommendationCard({ item, onSelect }) {
  const product = item.product;
  return (
    <button className="alternative" onClick={() => onSelect(product)}>
      <img src={product.image} alt="" loading="lazy" />
      <span className="alternative-copy"><strong>{product.name}</strong><small>{product.brand} · {product.material}</small><span className="alternative-proof"><span><Leaf size={12} /> +{product.eco_score} score</span><span><Wind size={12} /> −{item.carbon_savings} kg CO₂e</span></span></span>
      <ScoreBadge score={product.eco_score} />
    </button>
  );
}

function DetailPanel({ product, onChoose, onAddToCart, inCart }) {
  const [recommendations, setRecommendations] = useState(null);
  const [recommendationError, setRecommendationError] = useState("");
  const [feedback, setFeedback] = useState({ rating: 0, comment: "" });
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRecommendations(null);
    setRecommendationError("");
    setFeedbackStatus("");
    api(`/api/products/${encodeURIComponent(product.id)}/recommendations`)
      .then((data) => { if (!cancelled) setRecommendations(data); })
      .catch((error) => { if (!cancelled) setRecommendationError(error.message); });
    return () => { cancelled = true; };
  }, [product.id]);

  async function submitFeedback(event) {
    event.preventDefault();
    if (!feedback.rating || feedback.comment.trim().length < 3) {
      setFeedbackStatus("Choose a rating and add a short note.");
      return;
    }
    setSending(true);
    setFeedbackStatus("");
    try {
      await api("/api/feedback", { method: "POST", body: JSON.stringify({ product_id: product.id, ...feedback }) });
      setFeedback({ rating: 0, comment: "" });
      setFeedbackStatus("Thanks, your feedback has been recorded.");
    } catch (error) {
      setFeedbackStatus(error.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <aside className="detail-panel" aria-label="Selected product sustainability details">
      <div className="detail-heading"><div><span className="eyebrow">PIECE PROFILE</span><h2>Product insight</h2></div><span className="detail-category">{product.category}</span></div>
      <div className="selected-product">
        <img src={product.image} alt={product.name} />
        <div className="selected-copy"><span className="product-brand">{product.brand}</span><strong>{product.name}</strong><span>${product.price.toFixed(2)}</span></div>
        <button type="button" className="add-to-cart-button" onClick={() => onAddToCart(product)} disabled={inCart} aria-label={inCart ? "Already in EcoCart" : "Add product to EcoCart cart"}><ShoppingCart size={15} />{inCart ? "Added" : "Add"}</button>
      </div>
      <div className="score-summary">
        <div className="score-summary-top"><div><span className="eyebrow">ECO SCORE</span><strong className="score-caption">{product.eco_score >= 75 ? "A lighter footprint" : product.eco_score >= 55 ? "A thoughtful choice" : "Room to improve"}</strong></div><ScoreBadge score={product.eco_score} large /></div>
        <ScoreBar score={product.eco_score} />
        <p>Based on materials, packaging, shipping, durability and verified certifications.</p>
      </div>
      <div className="impact-list">
        <div><span><Shirt size={15} /> Material</span><strong>{product.material}</strong></div>
        <div><span><PackageCheck size={15} /> Packaging</span><strong>{product.packaging_type}</strong></div>
        <div><span><Recycle size={15} /> Recyclable</span><strong>{product.recyclability_rate}%</strong></div>
        <div><span><Leaf size={15} /> Biodegradable</span><strong>{product.biodegradable_grade} / 5</strong></div>
        <div><span><BadgeCheck size={15} /> Certification</span><strong>{product.certification}</strong></div>
        <div><span><Truck size={15} /> Shipping distance</span><strong>{product.shipping_distance.toLocaleString()} km</strong></div>
        <div><span><Wind size={15} /> Carbon footprint</span><strong>{product.carbon_footprint} kg CO₂e</strong></div>
        <div><span><ShieldCheck size={15} /> Durability</span><strong>{product.durability} / 10</strong></div>
      </div>
      <section className="alternatives-section">
        <div className="section-title"><div><span className="eyebrow">BETTER MATCHES</span><h3>Greener alternatives</h3></div><Sparkles size={17} /></div>
        {recommendationError ? <p className="inline-error">{recommendationError}</p> : !recommendations ? <div className="loading-line"><LoaderCircle className="spin" size={15} /> Finding similar pieces...</div> : recommendations.alternatives.length ? <>
          <p className="savings-note"><ArrowDownRight size={15} /> Up to <strong>{recommendations.estimated_carbon_savings} kg CO₂e</strong> less per item</p>
          <div className="alternatives-list">{recommendations.alternatives.map((item) => <RecommendationCard key={item.product.id} item={item} onSelect={onChoose} />)}</div>
        </> : <p className="empty-note">This is already one of the most sustainable matches in its category.</p>}
      </section>
      <form className="feedback-form" onSubmit={submitFeedback}>
        <div className="feedback-heading"><strong>Was this insight useful?</strong><span>Help us make the data better.</span></div>
        <div className="rating-control" role="group" aria-label="Rate this sustainability insight">
          {[1, 2, 3, 4, 5].map((rating) => <button key={rating} type="button" className={rating <= feedback.rating ? "rated" : ""} onClick={() => setFeedback((current) => ({ ...current, rating }))} aria-label={`${rating} star${rating > 1 ? "s" : ""}`}><Star size={16} fill={rating <= feedback.rating ? "currentColor" : "none"} /></button>)}
        </div>
        <div className="feedback-input-row"><input value={feedback.comment} onChange={(event) => setFeedback((current) => ({ ...current, comment: event.target.value }))} placeholder="Share a quick note" maxLength={500} /><button className="send-feedback" aria-label="Send feedback" disabled={sending}><Send size={15} /></button></div>
        {feedbackStatus && <p className={feedbackStatus.startsWith("Thanks") ? "feedback-success" : "inline-error"}>{feedbackStatus}</p>}
      </form>
    </aside>
  );
}

function App() {
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState(getInitialCart);
  const [view, setView] = useState("discover");
  const [category, setCategory] = useState("All pieces");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart]);

  useEffect(() => {
    const currentUrl = new URL(window.location.href);
    const payload = currentUrl.searchParams.get("ecocart_add");
    if (!payload) return;
    try {
      const imported = JSON.parse(payload);
      const productUrl = safeWebUrl(imported.product_url);
      if (imported.name && productUrl && CATEGORIES.slice(1).includes(imported.category)) {
        const item = { ...imported, product_url: productUrl, image: safeWebUrl(imported.image), source: "store" };
        setCart((current) => current.some((existing) => existing.product_url === productUrl) ? current : [...current, item]);
        setView("cart");
      }
    } catch {
      setError("Could not import that store listing. Open it again from the EcoCart extension.");
    } finally {
      currentUrl.searchParams.delete("ecocart_add");
      window.history.replaceState({}, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (category !== "All pieces") params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    Promise.all([api(`/api/products?${params}`), api("/api/dashboard/summary")])
      .then(([catalog, dashboard]) => {
        if (cancelled) return;
        setProducts(catalog.products);
        setSummary(dashboard);
        const requestedProductId = new URLSearchParams(window.location.search).get("product_id");
        setSelected((current) => catalog.products.find((item) => item.id === requestedProductId)
          || catalog.products.find((item) => item.id === current?.id)
          || catalog.products[0]
          || null);
      })
      .catch((requestError) => { if (!cancelled) setError(requestError.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [category, search, reload]);

  function addToCart(product) {
    setCart((current) => current.some((item) => item.id === product.id)
      ? current
      : [...current, { ...product, source: "catalog" }]);
    setView("cart");
  }

  function removeFromCart(item) {
    setCart((current) => current.filter((entry) => entry.id !== item.id));
  }

  function replaceCartItem(item, product) {
    setCart((current) => [
      ...current.filter((entry) => entry.id !== item.id && entry.id !== product.id),
      { ...product, source: "catalog" },
    ]);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand-lockup" href="#catalog" aria-label="Eco-Cart AI home"><span className="brand-mark"><Leaf size={20} /></span><span>eco-cart<span className="brand-ai">AI</span></span></a>
        <span className="sidebar-label">YOUR WORKSPACE</span>
        <nav className="side-nav">
          <button type="button" className={`nav-item ${view === "discover" ? "active" : ""}`} onClick={() => setView("discover")}><SlidersHorizontal size={17} /> Discover</button>
          <button type="button" className={`nav-item ${view === "cart" ? "active" : ""}`} onClick={() => setView("cart")}><ShoppingCart size={17} /> My cart <span className="nav-cart-count">{cart.length}</span></button>
          <a className="nav-item" href="#impact"><Wind size={17} /> Impact guide</a>
        </nav>
        <div className="sidebar-bottom"><div className="sidebar-note"><span className="note-icon"><CircleHelp size={16} /></span><div><strong>Small choices add up</strong><p>Compare the impact behind everyday pieces.</p></div></div><span className="sidebar-version">ACADEMIC DEMO <i /> CLOTHING CATALOG</span></div>
      </aside>

      <main className="main-area" id="catalog">
        <header className="topbar"><div className="breadcrumb">Eco-Cart <span>/</span> <strong>Discover</strong></div><div className="topbar-right"><span className="api-status"><i /> LIVE CATALOG</span><span className="avatar">EC</span></div></header>
        <div className="page-content">
          {view === "cart" ? <CartView cart={cart} onBrowse={() => setView("discover")} onRemove={removeFromCart} onReplace={replaceCartItem} /> : <>
          <section className="page-heading"><div><span className="eyebrow">THE CONSIDERED CLOSET <i /></span><h1>Shop with a lighter footprint.</h1><p>Thoughtful materials. Clear impact. Better everyday choices.</p></div><span className="season-tag">CLOTHING <ChevronDown size={14} /></span></section>

          {summary && <section className="metrics-strip" aria-label="Catalog summary">
            <Metric icon={Shirt} label="Catalog pieces" value={summary.product_count} detail="Across clothing essentials" tone="green" />
            <Metric icon={Leaf} label="Average Eco Score" value={`${summary.average_eco_score}`} detail="Out of 100 points" tone="lime" />
            <Metric icon={BadgeCheck} label="Higher-impact picks" value={summary.high_impact_count} detail="Score of 75 and above" tone="blue" />
            <Metric icon={Recycle} label="Categories covered" value={`${summary.category_count} / 7`} detail="Everyday wardrobe staples" tone="orange" />
          </section>}

          <div className="catalog-toolbar"><div><span className="eyebrow">EXPLORE THE EDIT</span><h2>Clothing catalog <span>{products.length}</span></h2></div><label className="search-box"><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search pieces, brands, materials" /><kbd>⌕</kbd></label></div>
          <div className="category-row" role="group" aria-label="Filter by product category">{CATEGORIES.map((item) => <button key={item} className={`category-pill ${category === item ? "selected" : ""}`} onClick={() => setCategory(item)}>{item}</button>)}</div>

          {error ? <section className="state-panel error-panel"><span className="state-icon"><Wind size={22} /></span><h2>Catalog connection lost</h2><p>{error}. Start the FastAPI service and check <code>VITE_API_BASE_URL</code>.</p><button onClick={() => setReload((count) => count + 1)} className="retry-button"><ArrowUpRight size={15} /> Retry connection</button></section> : loading ? <section className="state-panel"><LoaderCircle className="spin" size={22} /><p>Loading the clothing catalog...</p></section> : products.length === 0 ? <section className="state-panel"><Search size={22} /><h2>No pieces found</h2><p>Try another search or choose a different category.</p></section> : (
            <div className="catalog-layout">
              <section className="product-grid" aria-label="Clothing products">{products.map((product) => <ProductCard key={product.id} product={product} active={selected?.id === product.id} onSelect={setSelected} />)}</section>
              {selected && <DetailPanel key={selected.id} product={selected} onChoose={setSelected} onAddToCart={addToCart} inCart={cart.some((item) => item.id === selected.id)} />}
            </div>
          )}
          <footer className="page-footer" id="impact"><span>Eco-Cart AI <i /> Sustainability estimates are comparative, not lifecycle assessments.</span><span>Built for more considered buying.</span></footer>
          </>}
        </div>
      </main>
    </div>
  );
}

export default App;