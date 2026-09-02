import { readFile, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const markdownFiles = [
  "README.md",
  "docs/reference/h2h-api.md",
  "docs/guides/payment-gateway.md",
  "docs/guides/integration.md",
];
const openapiFile = "openapi/autolaris-h2h.openapi.json";
const textFiles = [...markdownFiles, openapiFile];

const contents = new Map(
  await Promise.all(
    textFiles.map(async (file) => [
      file,
      await readFile(join(root, file), "utf8"),
    ]),
  ),
);

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const markdownAnchors = (content) =>
  new Set(
    [...content.matchAll(/^#{1,6}\s+(.+)$/gm)].map((heading) =>
      heading[1]
        .replaceAll("`", "")
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}\s-]/gu, "")
        .replace(/\s+/g, "-"),
    ),
  );

let spec;
try {
  spec = JSON.parse(contents.get(openapiFile));
} catch (error) {
  failures.push(`${openapiFile} is not valid JSON: ${error.message}`);
}

const endpoints = [
  ["post", "/api/h2h/ongkir"],
  ["post", "/api/h2h/order"],
  ["post", "/api/h2h/lacak"],
  ["post", "/api/h2h/cancel"],
  ["post", "/api/h2h/create_payment"],
  ["get", "/api/h2h/list_payment"],
  ["post", "/api/h2h/submit"],
  ["post", "/api/h2h/advice"],
];
const postmanCreateOrderFields = [
  "reff_id", "channel_code", "courir_id", "origin", "destination",
  "weight", "length", "width", "height", "shipper_name", "shipper_phone",
  "shipper_email", "shipper_address", "receiver_name", "receiver_phone",
  "receiver_email", "receiver_address", "callback_url", "grand_total",
  "cod_value", "longitude", "latitude", "remark", "order_details",
];

if (spec) {
  check(spec.openapi === "3.1.0", `${openapiFile} must use OpenAPI 3.1.0`);
  check(
    spec.servers?.[0]?.url === "https://api-h2h.autolaris.com",
    "OpenAPI server URL is missing or incorrect",
  );
  check(
    spec.components?.securitySchemes?.bearerAuth?.scheme === "bearer",
    "OpenAPI bearerAuth security scheme is missing",
  );

  const operationIds = [];
  for (const pathItem of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(pathItem)) {
      if (operation?.operationId) operationIds.push(operation.operationId);
    }
  }
  check(
    new Set(operationIds).size === operationIds.length,
    "OpenAPI operationId values must be unique",
  );

  const resolvePointer = (pointer) =>
    pointer
      .slice(2)
      .split("/")
      .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
      .reduce((value, part) => value?.[part], spec);

  const checkRefs = (value, location = "$") => {
    if (!value || typeof value !== "object") return;
    if (typeof value.$ref === "string" && value.$ref.startsWith("#/")) {
      check(
        resolvePointer(value.$ref) !== undefined,
        `OpenAPI reference not found at ${location}: ${value.$ref}`,
      );
    }
    for (const [key, child] of Object.entries(value)) {
      checkRefs(child, `${location}.${key}`);
    }
  };
  checkRefs(spec);

  for (const [method, path] of endpoints) {
    check(
      Boolean(spec.paths?.[path]?.[method]),
      `OpenAPI is missing ${method.toUpperCase()} ${path}`,
    );
  }

  const createOrderSchema = spec.components?.schemas?.CreateOrderRequest;
  const createOrderProperties = Object.assign(
    {},
    ...(createOrderSchema?.allOf ?? []).map((part) =>
      part.$ref ? resolvePointer(part.$ref)?.properties : part.properties,
    ),
  );
  for (const field of postmanCreateOrderFields) {
    check(
      Boolean(createOrderProperties[field]),
      `Create Order schema is missing public Postman field: ${field}`,
    );
  }
  check(
    createOrderProperties.callback_url?.description
      ?.toLowerCase()
      .includes("tracking-status"),
    "Create Order callback_url must be documented as tracking, not settlement",
  );
}

for (const file of markdownFiles) {
  const content = contents.get(file);
  const fences = content.match(/^```/gm)?.length ?? 0;
  check(fences % 2 === 0, `${file} has an unclosed fenced code block`);

  const anchors = markdownAnchors(content);
  for (const match of content.matchAll(/\[[^\]]+\]\(#([^)]+)\)/g)) {
    check(
      anchors.has(decodeURIComponent(match[1]).toLowerCase()),
      `${file} links to missing local anchor: #${match[1]}`,
    );
  }

  const localLink =
    /\[[^\]]+\]\((?!https?:|mailto:|#)([^)#]+)(?:#([^)]+))?\)/g;
  for (const match of content.matchAll(localLink)) {
    const target = resolve(root, dirname(file), decodeURIComponent(match[1]));
    try {
      await stat(target);
      if (match[2] && target.endsWith(".md")) {
        const targetContent = await readFile(target, "utf8");
        const anchors = markdownAnchors(targetContent);
        check(
          anchors.has(decodeURIComponent(match[2]).toLowerCase()),
          `${file} links to missing anchor: ${match[1]}#${match[2]}`,
        );
      }
    } catch {
      failures.push(`${file} links to missing file: ${match[1]}`);
    }
  }
}

for (const file of ["README.md", "docs/reference/h2h-api.md"]) {
  const content = contents.get(file);
  for (const [method, path] of endpoints) {
    check(
      content.includes(path),
      `${file} does not mention ${method.toUpperCase()} ${path}`,
    );
  }
}

const allText = textFiles.map((file) => contents.get(file)).join("\n");
check(
  !/\b[a-f0-9]{64}\b/i.test(allText),
  "Possible 64-character API key found in documentation",
);
check(
  !/tidak ada endpoint[^\n]*(list|channel)/i.test(allText),
  "Documentation still claims that a payment-channel endpoint is unavailable",
);
check(
  contents.get("docs/guides/integration.md").includes("payload.rc !== \"00\""),
  "Integration client must reject logical errors (rc !== 00)",
);
check(
  contents.get("docs/guides/payment-gateway.md").includes(
    "tidak mengubah status order",
  ),
  "Callback discovery guidance must forbid unverified status updates",
);
check(
  contents.get("docs/guides/payment-gateway.md").includes(
    "DELIVERED` adalah status pengiriman",
  ),
  "Payment guide must keep DELIVERED out of paid settlement",
);
check(
  contents.get("README.md").includes("courir_id: 1") &&
    contents.get("README.md").includes("kontrak operasional akun"),
  "README must label the non-physical courier id as an account contract",
);
check(
  contents
    .get("docs/reference/h2h-api.md")
    .includes("callback **status\ntracking ekspedisi**"),
  "Create Order reference must distinguish tracking callback from payment settlement",
);

if (failures.length > 0) {
  console.error(`Documentation validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    `Documentation validation passed: ${markdownFiles.length} Markdown files, ${endpoints.length} endpoints, OpenAPI 3.1.0.`,
  );
}
