/**
 * N8N Domain Detection Utility
 * Detects n8n instances across self-hosted and cloud environments
 */

/**
 * Known n8n cloud patterns
 */
const N8N_CLOUD_PATTERNS = [
  /^app\.n8n\.cloud$/i,
  /^[a-zA-Z0-9-]+\.app\.n8n\.cloud$/i,
] as const;

/**
 * Common n8n API endpoint patterns that indicate an n8n instance
 */
const N8N_API_PATTERNS = [
  "/rest/workflows",
  "/api/v1/workflows",
  "/api/workflows",
  "/workflow/", // Single workflow pages
  "/workflows/", // Workflow listing pages
  "/rest/users/me",
  "/rest/login",
  "/rest/credentials",
  "/rest/executions",
  "/rest/nodes",
  "/webhook/",
  "/form/",
] as const;

/**
 * n8n-specific DOM selectors that indicate an n8n instance
 */
const N8N_DOM_SELECTORS = [
  ".vue-flow__pane.vue-flow__container.selection",
  ".vue-flow__renderer",
  '[data-test-id="canvas"]',
  '[data-test-id="workflow-canvas"]',
  ".n8n-canvas",
  'div[id="app"]', // Common n8n app container
] as const;

/**
 * n8n-specific meta tags and page indicators
 */
const N8N_PAGE_INDICATORS = [
  { selector: 'meta[name="application-name"]', content: "n8n" },
  { selector: "title", content: /n8n/i },
  { selector: "script", content: /n8n/i },
] as const;

/**
 * Check if a hostname matches n8n cloud patterns
 */
export function isN8nCloudDomain(hostname: string): boolean {
  return N8N_CLOUD_PATTERNS.some((pattern) => pattern.test(hostname));
}

/**
 * Check if a URL contains n8n API endpoints
 */
export function hasN8nApiEndpoints(url: string): boolean {
  return N8N_API_PATTERNS.some((pattern) => url.includes(pattern));
}

/**
 * Check if a URL is an n8n workflow endpoint specifically
 */
export function isN8nWorkflowUrl(url: string): boolean {
  const workflowEndpoints = [
    "/rest/workflows/",
    "/api/v1/workflows/",
    "/api/workflows/",
    "/workflows/",
    "/workflow/", // Added single workflow path
    "workflow",
  ];

  return workflowEndpoints.some((endpoint) => url.includes(endpoint));
}

/**
 * Extract workflow ID from URL
 */
export function extractWorkflowId(url: string): string | null {
  const matches = url.match(/(?:workflows?|workflow)\/([a-zA-Z0-9\-_]+)/);
  return matches ? matches[1] : null;
}

/**
 * Check if the current page is an n8n instance by examining the DOM
 * This is useful for content scripts
 */
export function isN8nPageByDOM(): boolean {
  // Check for n8n-specific DOM elements
  const hasN8nElements = N8N_DOM_SELECTORS.some((selector) => {
    return document.querySelector(selector) !== null;
  });

  if (hasN8nElements) return true;

  // Check for n8n-specific meta tags and page indicators
  const hasN8nIndicators = N8N_PAGE_INDICATORS.some(({ selector, content }) => {
    const elements = document.querySelectorAll(selector);
    return Array.from(elements).some((el) => {
      const text = el.textContent || el.getAttribute("content") || "";
      if (typeof content === "string") {
        return text.includes(content);
      } else {
        return content.test(text);
      }
    });
  });

  return hasN8nIndicators;
}

/**
 * Check if a hostname appears to be a self-hosted n8n instance
 * This uses heuristics and may need to be refined based on actual usage
 */
export function isPotentialSelfHostedN8n(hostname: string): boolean {
  // Skip if it's already known to be n8n cloud
  if (isN8nCloudDomain(hostname)) return false;

  // Common self-hosted n8n subdomain patterns
  const selfHostedPatterns = [
    /^n8n\./i,
    /^automation\./i,
    /^workflow\./i,
    /^flows?\./i,
    /\.n8n\./i,
  ];

  return selfHostedPatterns.some((pattern) => pattern.test(hostname));
}

/**
 * Comprehensive check to determine if a URL/hostname is an n8n instance
 */
export function isN8nInstance(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;

    // Check if it's n8n cloud
    if (isN8nCloudDomain(hostname)) return true;

    // Check if it has n8n API endpoints or workflow paths
    if (hasN8nApiEndpoints(url)) return true;

    // Check specifically for workflow URLs (like /workflow/xyz)
    if (isN8nWorkflowUrl(url)) return true;

    // Check if it looks like a self-hosted n8n instance
    if (isPotentialSelfHostedN8n(hostname)) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Get n8n canvas selectors for pasting workflows
 */
export function getN8nCanvasSelectors(): string[] {
  return [...N8N_DOM_SELECTORS];
}

/**
 * Create dynamic host permissions for n8n instances
 * This can be used to request permissions for detected n8n instances
 */
export function createN8nHostPermissions(hostname: string): string[] {
  const protocol =
    hostname.includes("localhost") || hostname.includes("127.0.0.1")
      ? "http"
      : "https";
  return [
    `${protocol}://${hostname}/*`,
    `${protocol}://*.${hostname}/*`, // For subdomains
  ];
}
