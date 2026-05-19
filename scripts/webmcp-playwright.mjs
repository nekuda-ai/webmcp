#!/usr/bin/env node

const DIRECTORY_BASE_URL = "https://webmcp.cool";

function usage() {
  console.error(`Usage:
  node scripts/webmcp-playwright.mjs probe <url> [--headed] [--chrome <path>]
  node scripts/webmcp-playwright.mjs list <url> [--headed] [--wait-ms 3000]
  node scripts/webmcp-playwright.mjs call <url> <tool> '<json-args>' [--allow-side-effects] [--allow-unknown]

Options:
  --headed                Show the browser window.
  --chrome <path>         Chrome/Chromium executable. Also supports WEBMCP_CHROME.
  --wait-ms <number>      Extra wait after navigation for tool registration. Default: 3000.
  --timeout-ms <number>   Page/browser timeout. Default: 15000.
  --allow-side-effects    Allow directory tools whose kind is write/action.
  --allow-unknown         Allow calling tools not found in the directory.
  --json                  Print machine-readable JSON only.
`);
}

function parseArgs(argv) {
  const flags = new Map();
  const positional = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      positional.push(arg);
      continue;
    }

    if (["--headed", "--allow-side-effects", "--allow-unknown", "--json"].includes(arg)) {
      flags.set(arg, true);
    } else {
      flags.set(arg, argv[i + 1]);
      i += 1;
    }
  }

  return { positional, flags };
}

function parseNumberFlag(flags, name, fallback) {
  const value = flags.get(name);
  if (value == null) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative number`);
  }
  return parsed;
}

function parseJsonArgs(raw) {
  if (raw == null) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Invalid JSON arguments: ${error.message}`);
  }
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

async function importPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(
      `Playwright is not installed. Run "npm install" from the skill repo, or install playwright in the active workspace. Original error: ${error.message}`,
    );
  }
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) return null;
  return response.json();
}

async function lookupDirectory(targetUrl) {
  return fetchJson(`${DIRECTORY_BASE_URL}/api/v1/lookup?url=${encodeURIComponent(targetUrl)}`);
}

async function findDirectoryTool(targetUrl, toolName) {
  const lookup = await lookupDirectory(targetUrl);
  const tools = lookup?.site?.tools ?? [];
  return {
    lookup,
    tool: tools.find((tool) => tool.name === toolName) ?? null,
  };
}

async function openPage(targetUrl, flags) {
  const { chromium } = await importPlaywright();
  const timeoutMs = parseNumberFlag(flags, "--timeout-ms", 15000);
  const waitMs = parseNumberFlag(flags, "--wait-ms", 3000);
  const executablePath = flags.get("--chrome") || process.env.WEBMCP_CHROME || undefined;

  const browser = await chromium.launch({
    headless: !flags.get("--headed"),
    executablePath,
    args: [
      "--enable-experimental-web-platform-features",
      "--enable-features=WebModelContext,WebMCPTesting",
    ],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(timeoutMs);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("networkidle", { timeout: Math.min(timeoutMs, 8000) }).catch(() => {});
  if (waitMs > 0) await page.waitForTimeout(waitMs);

  return { browser, page };
}

async function getRuntimeState(page) {
  return page.evaluate(() => {
    const testing = navigator.modelContextTesting;
    return {
      href: location.href,
      hasModelContext: Boolean(navigator.modelContext),
      hasModelContextTesting: Boolean(testing),
      hasListTools: Boolean(testing?.listTools),
      hasExecuteTool: Boolean(testing?.executeTool),
      testingConstructor: testing?.constructor?.name ?? null,
      secureContext: window.isSecureContext,
    };
  });
}

async function listLiveTools(page) {
  return page.evaluate(async () => {
    if (!navigator.modelContextTesting?.listTools) {
      throw new Error("navigator.modelContextTesting.listTools is unavailable");
    }

    const tools = await navigator.modelContextTesting.listTools();
    return tools.map((tool) => ({
      ...tool,
      inputSchema: typeof tool.inputSchema === "string" ? JSON.parse(tool.inputSchema) : tool.inputSchema,
    }));
  });
}

async function executeLiveTool(page, name, args) {
  return page.evaluate(
    async ({ name: toolName, args: toolArgs }) => {
      if (!navigator.modelContextTesting?.executeTool) {
        throw new Error("navigator.modelContextTesting.executeTool is unavailable");
      }

      const raw = await navigator.modelContextTesting.executeTool(toolName, JSON.stringify(toolArgs));
      let parsed = raw;
      if (typeof raw === "string") {
        try {
          parsed = JSON.parse(raw);
        } catch {
          parsed = raw;
        }
      }

      return {
        raw,
        parsed,
      };
    },
    { name, args },
  );
}

function assertCallAllowed(directoryResult, flags) {
  const { lookup, tool } = directoryResult;

  if (!lookup?.supported) {
    if (!flags.get("--allow-unknown")) {
      throw new Error("The directory does not mark this URL as WebMCP-supported. Re-run with --allow-unknown only if the user accepts the risk.");
    }
    return;
  }

  if (!tool) {
    if (!flags.get("--allow-unknown")) {
      throw new Error("The requested tool is not present in the directory entry. Re-run with --allow-unknown only if the live page listing is trusted.");
    }
    return;
  }

  const sensitiveReason = sensitiveToolReason(tool);
  if ((tool.kind !== "read" || sensitiveReason) && !flags.get("--allow-side-effects")) {
    const reason = sensitiveReason ? `${tool.kind} tool with ${sensitiveReason}` : `${tool.kind} tool`;
    throw new Error(`Refusing to call ${reason} "${tool.name}" without --allow-side-effects.`);
  }
}

function sensitiveToolReason(tool) {
  const haystack = `${tool.name ?? ""} ${tool.description ?? ""}`.toLowerCase();
  const sensitivePattern = /\b(authenticate|login|sign[- ]?in|checkout|pay|payment|purchase|buy|book|booking|submit|confirm|order|return|review|delete|cancel)\b/;
  const match = haystack.match(sensitivePattern);
  return match ? `sensitive "${match[0]}" semantics` : null;
}

function printResult(result, flags) {
  if (flags.get("--json")) {
    console.log(JSON.stringify(result));
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

async function main() {
  const { positional, flags } = parseArgs(process.argv.slice(2));
  const [command, targetUrl, toolName, rawArgs] = positional;

  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 1);
  }

  if (!targetUrl || !/^https?:\/\//i.test(targetUrl)) {
    usage();
    throw new Error("A full http(s) URL is required.");
  }

  const { browser, page } = await openPage(targetUrl, flags);
  try {
    const runtime = await getRuntimeState(page);

    if (command === "probe") {
      const directory = await lookupDirectory(targetUrl);
      printResult({ ok: true, runtime, directory }, flags);
      return;
    }

    if (command === "list") {
      const tools = runtime.hasListTools ? await listLiveTools(page) : [];
      printResult({ ok: runtime.hasListTools, runtime, tools }, flags);
      return;
    }

    if (command === "call") {
      if (!toolName) {
        usage();
        throw new Error("Tool name is required for call.");
      }

      if (!runtime.hasExecuteTool) {
        throw new Error("Cannot execute WebMCP tools because navigator.modelContextTesting.executeTool is unavailable.");
      }

      const directoryResult = await findDirectoryTool(targetUrl, toolName);
      assertCallAllowed(directoryResult, flags);

      const liveTools = await listLiveTools(page);
      if (!liveTools.some((tool) => tool.name === toolName)) {
        throw new Error(`Live page did not list tool "${toolName}".`);
      }

      const result = await executeLiveTool(page, toolName, parseJsonArgs(rawArgs));
      printResult({
        ok: true,
        runtime,
        directoryTool: directoryResult.tool,
        result: parseMaybeJson(result.parsed),
      }, flags);
      return;
    }

    usage();
    throw new Error(`Unknown command: ${command}`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
