# Eco-Cart AI

Eco-Cart AI is a sustainable clothing-shopping assistant. Its FastAPI service calculates comparative Eco Scores, filters a clothing catalog, ranks greener products in the same category, and records user feedback. A React dashboard and Chrome Manifest V3 extension use the same REST API.

The included catalog is **illustrative academic demo data**, not a live retailer feed or independently verified lifecycle assessment. Its product attributes and carbon values demonstrate the application workflow; replace them with sourced, documented product data before presenting results as verified claims.

## Project Structure

```text
backend/
  app/                 FastAPI routes, product models, scoring, recommendations, storage
  data/products.csv    35 illustrative clothing products across seven categories
  seed_database.py     Idempotent CSV-to-MongoDB import
  ml/                  Explainable decision-tree training and inference
  app/routes/          Product, recommendation, user, and feedback APIs
  app/services/        Eco Score, carbon, and similarity logic
  tests/               Scoring and recommendation tests
  requirements.txt
frontend/
  src/                 React dashboard and responsive styles
extension/             Chrome Manifest V3 popup and API settings
```

## Run Locally

### 1. Start the API

From the workspace root in PowerShell:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
Copy-Item .env.example .env
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

The API runs at `http://localhost:8000`; interactive Swagger documentation is at `http://localhost:8000/docs`.

Without a MongoDB URI, products load from `data/products.csv`; users, feedback, and added products use ignored local JSON files. To use MongoDB Atlas, set `MONGODB_URI` in `backend/.env`. The database name is fixed to `ecocart`, with `products`, `users`, and `feedback` collections. Keep credentials out of source control. An empty products collection is seeded from the CSV on first connection. If Atlas is unavailable, the API uses local catalog data.

### 2. Start the dashboard

In a second PowerShell terminal:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173`. The default API address is `http://localhost:8000`; set `VITE_API_BASE_URL` in `frontend/.env` when the API is hosted elsewhere.

### 3. Load the Chrome extension

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select the workspace `extension` directory.
3. Open extension settings and enter the API base URL. Chrome asks for permission when the API is not on localhost.
4. Open a shopping page and select the Eco-Cart icon. Exact catalog matches are distinguished from category examples; an unrelated page is never presented as a verified product assessment.

## REST API

All routes appear in Swagger at `/docs` and use JSON.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/` | API welcome response |
| `GET` | `/health` | Service and storage status |
| `GET` | `/products` | List and filter products |
| `GET` | `/products/{product_id}` | Product sustainability details |
| `GET` | `/products/search/{query}` | Search catalog |
| `GET` | `/products/category/{category}` | Filter by clothing category |
| `POST` | `/eco-score` | Calculate an explained Eco Score |
| `POST` | `/recommendations` | Find same-category greener alternatives |
| `POST` | `/carbon-savings` | Compare product carbon footprints |
| `POST` | `/users/register` | Create an account |
| `POST` | `/users/login` | Verify account credentials |
| `POST` | `/feedback` | Record product feedback |
| `GET` | `/api/health` | Service and storage status |
| `GET` | `/api/categories` | Supported clothing categories |
| `GET` | `/api/products?search=&category=&limit=` | Search, filter and list products |
| `GET` | `/api/products/{product_id}` | Product sustainability details |
| `GET` | `/api/products/{product_id}/recommendations` | Same-category greener matches and carbon savings |
| `GET` | `/api/dashboard/summary` | Catalog metrics |
| `POST` | `/api/products/score` | Validate product data and calculate its Eco Score |
| `POST` | `/api/products` | Add a product with its Eco Score calculated by the API |
| `POST` | `/api/feedback` | Record a 1–5 rating and comment |

The same endpoints are documented automatically in Swagger at `/docs`; the `/api/...` routes are compatibility aliases used by the React dashboard and extension.

## Eco Score and Recommendations

The score is clamped to 0–100 and uses weighted, understandable product attributes: material choice (18 points for a recognized lower-impact material, otherwise 7), organic content (12), recycled content (6), packaging (up to 8), recyclability (up to 12), biodegradability (up to 10), certification (12), carbon footprint (up to 10), shipping distance (up to 5), and durability (up to 7). The API recalculates the score when registering a product rather than trusting a submitted score.

Recommendations first require the same category and a strictly higher Eco Score. They are ranked using scikit-learn TF-IDF text similarity over product/material/certification attributes and normalized numeric similarity. Estimated carbon savings are the difference between the selected item and the alternative, in kg CO₂e per item.

## Verify

```powershell
cd backend
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
cd ..\frontend
npm run build
```

The seed data covers T-Shirts, Shirts, Jeans, Hoodies, Jackets, Dresses, and Trousers. Update `backend/data/products.json` with responsibly sourced product attributes as the catalog grows.

Train the explainable decision-tree model with `python -m ml.train_model` from `backend/`. Run the idempotent MongoDB import with `python seed_database.py` after configuring `MONGODB_URI`. The API's Eco Score endpoint remains rule-based and explainable; `/ml-predict` exposes the trained model prediction when the model file exists and otherwise falls back to the same rules.