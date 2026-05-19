# WebMCP Directory API

Base URL: `https://webmcp.cool`

The API is read-only and unauthenticated. Use it to discover WebMCP-enabled websites, inspect registered tool schemas, and probe arbitrary URLs.

## Endpoints

### List Sites

```http
GET /api/v1/sites
```

Useful query parameters:

- `type`: `live`, `demo`, or `all`
- `q`: substring search across host, URL, description, and tool text
- `tool`: substring search over tool names
- `kind`: `read`, `write`, or `action`; repeat to OR
- `impl`: `imperative` or `declarative`
- `fields`: `full`, `summary`, or `minimal`
- `limit`: maximum `500`
- `offset`: pagination offset

Example:

```bash
curl -s 'https://webmcp.cool/api/v1/sites?q=checkout&fields=summary' | jq .
```

### Get One Site

```http
GET /api/v1/sites/{host}
```

Returns the site's URL, description, type, and tools with JSON Schemas.

### List Site Tools

```http
GET /api/v1/sites/{host}/tools
```

Use when the host is already known and only tool metadata is needed.

### Get One Tool

```http
GET /api/v1/sites/{host}/tools/{tool}
```

Use before calling a specific tool. Read `description`, `kind`, and `inputSchema`.

### Search All Tools

```http
GET /api/v1/tools?q={query}
```

Returns a flat list of matching tools across all directory sites.

Example:

```bash
curl -s 'https://webmcp.cool/api/v1/tools?q=checkout&limit=5' | jq .
```

### Lookup URL

```http
GET /api/v1/lookup?url={url}
GET /api/v1/lookup?host={host}
```

Use this first for arbitrary user-provided URLs. `supported: true` means the directory has a matching site entry. Path-scoped demos can match by URL prefix.

### Stats And OpenAPI

```http
GET /api/v1/stats
GET /api/openapi.json
GET /api/directory.json
```

Use OpenAPI for schema refreshes and `directory.json` only when a full dump is useful.

## Tool Fields

- `name`: stable tool identifier to invoke.
- `kind`: `read`, `write`, or `action`.
- `impl`: `imperative` for `navigator.modelContext.registerTool`; `declarative` for HTML tool elements/forms.
- `description`: natural-language tool guidance.
- `inputSchema`: JSON Schema for arguments.
- `page`: optional relative page hint.

## Interaction Sequence

1. `lookup` a URL or search by need.
2. Fetch the target site or tool definition.
3. Open the site URL in a WebMCP-capable browser.
4. Use `navigator.modelContextTesting.listTools()` through Playwright to confirm live registration.
5. Execute the selected tool only after validating arguments and side-effect risk.
