# Playwright WebMCP Runtime

Use Playwright to control a real browser and call the browser's WebMCP testing surface.

## Browser API Boundary

- `navigator.modelContext` is the page-facing API used by websites to register and unregister tools.
- `navigator.modelContextTesting` is the testing/automation API used by external tooling to list and execute registered tools.
- `listTools()` returns live page tools.
- `executeTool(name, jsonString)` invokes a tool. Pass arguments as a JSON string, not as an object.

## Requirements

Install dependencies in the repo or a temporary workspace:

```bash
npm install
npx playwright install chromium
```

For native WebMCP execution, use a Chrome/Chromium build that exposes WebMCP testing. Chrome Canary/Beta is usually the best target while the API is experimental.

Manual setup:

1. Open `chrome://flags/#enable-webmcp-testing`.
2. Enable the WebMCP testing flag.
3. Relaunch Chrome.
4. Set `WEBMCP_CHROME` to that browser executable.

Automation setup:

The helper launches Chromium with:

```text
--enable-experimental-web-platform-features
--enable-features=WebModelContext,WebMCPTesting
```

If those flags are insufficient for the installed browser, enable the Chrome flag manually and run headed with `WEBMCP_CHROME`.

## Commands

Probe browser support:

```bash
node scripts/webmcp-playwright.mjs probe https://store.nekuda.ai
```

List live tools:

```bash
node scripts/webmcp-playwright.mjs list https://store.nekuda.ai
```

Call a safe read tool:

```bash
node scripts/webmcp-playwright.mjs call https://store.nekuda.ai search_products '{"query":"hats","max_results":3}'
```

Call a side-effectful tool only after explicit user intent:

```bash
node scripts/webmcp-playwright.mjs call https://store.nekuda.ai add_to_cart '{"product_id":"..."}' --allow-side-effects
```

The helper also treats sensitive names/descriptions such as checkout, pay, purchase, book, authenticate, submit, delete, cancel, return, review, or order-changing flows as side-effectful, even when a directory entry labels the tool as `read`.

Call a tool not known to the directory only when accepted:

```bash
node scripts/webmcp-playwright.mjs call https://example.com custom_tool '{}' --allow-unknown
```

Useful options:

- `--headed`: show the browser window.
- `--wait-ms <number>`: wait after navigation for tools to register.
- `--timeout-ms <number>`: browser/page timeout.
- `--chrome <path>`: Chrome executable path. Same effect as `WEBMCP_CHROME`.
- `--json`: print machine-readable JSON.

## Recommended Agent Behavior

Use this sequence:

1. Call `probe` and confirm `hasModelContextTesting: true`.
2. Call `list` and compare live tools with directory tools.
3. Pick the lowest-risk tool that answers the user.
4. Validate args against `inputSchema`.
5. Call `call`.
6. Summarize the returned payload and any visible page state changes.

## Troubleshooting

`navigator.modelContextTesting` is missing:

- Use Chrome Canary/Beta or a sufficiently recent Chromium.
- Enable `chrome://flags/#enable-webmcp-testing`.
- Run headed with `WEBMCP_CHROME`.
- Confirm the page is HTTPS or localhost.

The directory lists the site but the live page has no tools:

- Wait longer with `--wait-ms 5000`.
- Confirm the page URL matches the directory entry or path-scoped demo.
- Check whether the site's WebMCP registration depends on user login or a specific route.

`executeTool` rejects:

- Confirm the tool name exactly matches `listTools()`.
- Pass arguments as valid JSON.
- Check the `inputSchema` required fields.
- Avoid write/action tools until the user explicitly asks for that operation.
