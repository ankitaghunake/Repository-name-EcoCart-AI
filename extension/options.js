const form = document.getElementById("settings-form");
const input = document.getElementById("api-url");
const dashboardInput = document.getElementById("dashboard-url");
const status = document.getElementById("status");
const DEFAULT_API = "http://localhost:8000";
const DEFAULT_DASHBOARD = "http://localhost:5173";

chrome.storage.sync.get({ apiBaseUrl: DEFAULT_API, dashboardBaseUrl: DEFAULT_DASHBOARD }, ({ apiBaseUrl, dashboardBaseUrl }) => {
  input.value = apiBaseUrl;
  dashboardInput.value = dashboardBaseUrl;
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const apiBaseUrl = input.value.trim().replace(/\/$/, "");
  const dashboardBaseUrl = dashboardInput.value.trim().replace(/\/$/, "");
  let origin;
  try {
    const parsedApi = new URL(apiBaseUrl);
    const parsedDashboard = new URL(dashboardBaseUrl);
    if (!["http:", "https:"].includes(parsedApi.protocol) || !["http:", "https:"].includes(parsedDashboard.protocol)) throw new Error("Unsupported protocol");
    origin = parsedApi.origin;
  } catch {
    status.textContent = "Enter valid HTTP or HTTPS addresses for the API and dashboard.";
    return;
  }
  const hasPermission = await chrome.permissions.contains({ origins: [`${origin}/*`] });
  if (!hasPermission) {
    const granted = await chrome.permissions.request({ origins: [`${origin}/*`] });
    if (!granted) {
      status.textContent = "API access permission was not granted.";
      return;
    }
  }
  await chrome.storage.sync.set({ apiBaseUrl, dashboardBaseUrl });
  status.textContent = "EcoCart connections saved.";
});