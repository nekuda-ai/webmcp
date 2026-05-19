---
name: webmcp
description: Discover and interact with WebMCP-enabled websites. Use when Codex needs to find websites exposing browser-native WebMCP tools, query the webmcp.cool directory API, inspect tool schemas, probe arbitrary URLs for WebMCP support, or use a Playwright-controlled browser runtime to list and execute navigator.modelContextTesting tools on a page.
---

# WebMCP

Use this skill to discover WebMCP-enabled websites and, when a compatible browser runtime is available, interact with their page-exposed tools.

## Workflow

1. Discover candidate websites through the webmcp.cool directory.
2. Inspect the target site's tool names, descriptions, `kind`, and `inputSchema`.
3. Open the target website in a WebMCP-capable browser runtime.
4. List tools from the live page before executing anything.
5. Execute read-only tools first. Ask before write/action tools or any sensitive flow.
6. Report clearly whether a failure happened in directory discovery, browser capability detection, tool listing, or tool execution.

## Directory Discovery

Use the WebMCP Directory API before browser interaction:

```bash
node scripts/webmcp-directory.mjs search checkout
node scripts/webmcp-directory.mjs lookup https://store.nekuda.ai
node scripts/webmcp-directory.mjs site store.nekuda.ai
node scripts/webmcp-directory.mjs tool store.nekuda.ai search_products
```

Load `references/webmcp-api.md` for endpoint details and response shapes.

## Playwright Runtime

Use `scripts/webmcp-playwright.mjs` when the task requires live website interaction:

```bash
node scripts/webmcp-playwright.mjs probe https://store.nekuda.ai
node scripts/webmcp-playwright.mjs list https://store.nekuda.ai
node scripts/webmcp-playwright.mjs call https://store.nekuda.ai search_products '{"query":"hats","max_results":3}'
```

The runtime requires Playwright and a Chrome/Chromium build with WebMCP testing enabled. Prefer setting `WEBMCP_CHROME` to Chrome Canary/Beta when bundled Playwright Chromium does not expose WebMCP:

```bash
export WEBMCP_CHROME="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
node scripts/webmcp-playwright.mjs list https://store.nekuda.ai --headed
```

Load `references/playwright-runtime.md` for runtime setup, command options, and troubleshooting.

## Safety Rules

Treat directory tool kinds as the first safety signal when available:

- `read`: Can be used for discovery and data retrieval.
- `write`: May mutate page state, carts, filters, user input, or local state. Ask before calling unless the user explicitly requested that action.
- `action`: May navigate, authenticate, submit, purchase, open checkout, or start a side-effectful flow. Ask before calling unless explicitly requested.

Before invoking a tool:

- Confirm the live page lists the tool through `navigator.modelContextTesting.listTools()`.
- Validate arguments against the tool's `inputSchema`.
- Ask first when the name or description implies payment, checkout, purchase, booking, authentication, form submission, deletion, cancellation, returns, reviews, or order changes, even if the directory marks it as `read`.
- Use `--allow-side-effects` only after user intent is explicit.
- Use `--allow-unknown` only when the site is not in the directory and the user accepts the risk.

## Fallbacks

If the directory knows the site but Playwright cannot see `navigator.modelContextTesting`, say the site appears WebMCP-enabled in the directory but the local browser runtime cannot execute WebMCP tools.

If a browser runtime is unavailable, still provide directory-backed recommendations and exact tool schemas. Do not pretend tool execution happened.

If the user asks for best-effort website automation without WebMCP, use normal Playwright locators as a separate fallback and label it as DOM automation, not WebMCP.
