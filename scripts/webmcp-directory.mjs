#!/usr/bin/env node

const BASE_URL = "https://webmcp.cool";

function usage() {
  console.error(`Usage:
  node scripts/webmcp-directory.mjs search <query> [--limit 10]
  node scripts/webmcp-directory.mjs lookup <url-or-host>
  node scripts/webmcp-directory.mjs site <host>
  node scripts/webmcp-directory.mjs tool <host> <tool>
  node scripts/webmcp-directory.mjs stats
`);
}

function readFlag(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  return args[index + 1] ?? fallback;
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${await response.text()}`);
  }

  return response.json();
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  if (!command || command === "--help" || command === "-h") {
    usage();
    process.exit(command ? 0 : 1);
  }

  let data;

  if (command === "search") {
    const query = args[0];
    if (!query) {
      usage();
      process.exit(1);
    }
    const limit = readFlag(args, "--limit", "10");
    data = await getJson(`/api/v1/tools?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(limit)}`);
  } else if (command === "lookup") {
    const target = args[0];
    if (!target) {
      usage();
      process.exit(1);
    }
    const key = /^https?:\/\//i.test(target) ? "url" : "host";
    data = await getJson(`/api/v1/lookup?${key}=${encodeURIComponent(target)}`);
  } else if (command === "site") {
    const host = args[0];
    if (!host) {
      usage();
      process.exit(1);
    }
    data = await getJson(`/api/v1/sites/${encodeURIComponent(host)}`);
  } else if (command === "tool") {
    const [host, tool] = args;
    if (!host || !tool) {
      usage();
      process.exit(1);
    }
    data = await getJson(`/api/v1/sites/${encodeURIComponent(host)}/tools/${encodeURIComponent(tool)}`);
  } else if (command === "stats") {
    data = await getJson("/api/v1/stats");
  } else {
    usage();
    process.exit(1);
  }

  console.log(JSON.stringify(data, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
