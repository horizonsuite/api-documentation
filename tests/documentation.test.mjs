import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const api = JSON.parse(await readFile("generated/api.json", "utf8"));
const auth = JSON.parse(await readFile("generated/auth.json", "utf8"));
const html = await readFile("src/index.html", "utf8");

function operations(document) {
  return Object.entries(document.paths).flatMap(([path, item]) =>
    Object.entries(item)
      .filter(([method]) => ["get", "post", "put", "patch", "delete"].includes(method))
      .map(([method, operation]) => ({ path, method, operation })),
  );
}

test("documents every protobuf RPC", () => {
  const apiOperationIds = operations(api).map(({ operation }) => operation.operationId);
  const authOperationIds = operations(auth).map(({ operation }) => operation.operationId);

  assert.equal(apiOperationIds.filter((id) => id.startsWith("horizon.api.v1.")).length, 17);
  assert.equal(authOperationIds.filter((id) => id.startsWith("horizon.auth.v1.")).length, 9);
  assert.equal(new Set([...apiOperationIds, ...authOperationIds]).size, apiOperationIds.length + authOperationIds.length);
});

test("uses the production origins and PKCE OAuth metadata", () => {
  assert.equal(api.servers[0].url, "https://api.horizonsuite.de");
  assert.equal(auth.servers[0].url, "https://auth.horizonsuite.de");
  assert.equal(api.components.securitySchemes.OAuth2.flows.authorizationCode.authorizationUrl, "https://auth.horizonsuite.de/auth");
  assert.equal(api.components.securitySchemes.OAuth2.flows.authorizationCode.tokenUrl, "https://auth.horizonsuite.de/token");
  assert.deepEqual(auth.paths["/auth"].get.parameters.at(-1).schema, {
    type: "string",
    const: "S256",
  });
});

test("marks confidential and streaming operations", () => {
  const billing = api.paths["/horizon.api.v1.BillingService/ApplyBillingEvent"].post;
  const session = api.paths["/horizon.api.v1.LicenseService/ConnectSession"].post;
  const internal = auth.paths["/horizon.auth.v1.AuthInternalService/Introspect"].post;

  assert.deepEqual(billing.security, [{ BillingServiceToken: [] }]);
  assert.equal(session["x-horizonsuite-streaming"], "bidirectional");
  assert.equal(session["x-horizonsuite-try-it-out"], false);
  assert.equal(internal["x-horizonsuite-internal-only"], true);
  assert.deepEqual(internal.security, [{ InternalServiceToken: [] }]);
});

test("models ProtoJSON 64-bit integers as decimal strings", () => {
  assert.equal(api.components.schemas.ApplyBillingEventRequest.properties.providerVersion.type, "string");
  assert.equal(api.components.schemas.ModuleEntitlement.properties.validUntilUnix.type, "string");
  assert.equal(auth.components.schemas.SecurityEvent.properties.sequence.type, "string");
});

test("ships only local executable and stylesheet assets", () => {
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(html, /<link[^>]+href=["']https?:/i);
  assert.match(html, /assets\/swagger-ui-bundle\.js/);
  assert.match(html, /openapi\/api\.json/);
  assert.match(html, /openapi\/auth\.json/);
});

