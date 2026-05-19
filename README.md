# webmcp

Install:

```bash
npx skills add nekuda-ai/webmcp
```

This repo contains the `webmcp` skill. It teaches agents to discover WebMCP-enabled websites through `webmcp.cool`, inspect tool schemas, and use a Playwright-controlled browser runtime to interact with live `navigator.modelContextTesting` tools when the browser supports WebMCP.

## Runtime Testing

```bash
npm install
npx -y skills-ref validate .
npx playwright install chromium
npm run smoke
node scripts/webmcp-playwright.mjs probe https://store.nekuda.ai
node scripts/webmcp-playwright.mjs list https://store.nekuda.ai
```

For native WebMCP interaction, use Chrome Canary/Beta with `chrome://flags/#enable-webmcp-testing` enabled:

```bash
export WEBMCP_CHROME="/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary"
node scripts/webmcp-playwright.mjs list https://store.nekuda.ai --headed
```
