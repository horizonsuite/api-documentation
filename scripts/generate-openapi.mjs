import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import protobuf from "protobufjs";

const API_ORIGIN = "https://api.horizonsuite.de";
const AUTH_ORIGIN = "https://auth.horizonsuite.de";
const generatedDir = path.resolve("generated");

const scalarSchemas = {
  bool: { type: "boolean" },
  bytes: { type: "string", format: "byte" },
  double: { type: "number", format: "double" },
  fixed32: { type: "integer", format: "int64", minimum: 0 },
  fixed64: { type: "string", format: "uint64", pattern: "^[0-9]+$" },
  float: { type: "number", format: "float" },
  int32: { type: "integer", format: "int32" },
  int64: { type: "string", format: "int64", pattern: "^-?[0-9]+$" },
  sfixed32: { type: "integer", format: "int32" },
  sfixed64: { type: "string", format: "int64", pattern: "^-?[0-9]+$" },
  sint32: { type: "integer", format: "int32" },
  sint64: { type: "string", format: "int64", pattern: "^-?[0-9]+$" },
  string: { type: "string" },
  uint32: { type: "integer", format: "int64", minimum: 0 },
  uint64: { type: "string", format: "uint64", pattern: "^[0-9]+$" },
};

const requiredByMessage = {
  CreateCustomerAccountRequest: ["displayName"],
  CreateInstallationGroupRequest: ["customerAccountId", "displayName", "deviceLimit"],
  CreateInstallationRequest: ["installationGroupId", "displayName"],
  AssignRoleRequest: ["accountId", "roleKey", "scopeType", "scopeId"],
  RevokeRoleAssignmentRequest: ["assignmentId", "correlationId"],
  InviteMemberRequest: ["email", "displayName", "roleKey", "scopeType", "scopeId"],
  RemoveMemberRequest: ["accountId", "scopeType", "scopeId", "correlationId"],
  ActivateDeviceRequest: ["installationId", "installationInstanceId", "displayName", "operatingSystem", "appVersion"],
  DeactivateDeviceRequest: ["deviceId"],
  GetEntitlementsRequest: ["installationId", "deviceId"],
  ApplyBillingEventRequest: [
    "idempotencyKey", "externalReference", "installationGroupId", "eventType",
    "moduleKey", "quantity", "validFromUnix", "validUntilUnix", "providerVersion", "occurredAtUnix",
  ],
  ApplyScopeRestrictionRequest: [
    "customerAccountId", "scopeType", "scopeId", "type", "mode",
    "publicReasonCode", "internalReason", "correlationId",
  ],
  RemoveScopeRestrictionRequest: ["customerAccountId", "restrictionId", "correlationId"],
  RestrictContractOwnerRequest: [
    "customerAccountId", "type", "mode", "publicReasonCode", "internalReason", "correlationId",
  ],
  LiftContractRestrictionRequest: [
    "customerAccountId", "accountRestrictionId", "scopeRestrictionId", "correlationId",
  ],
  IntrospectRequest: ["accessToken", "requiredClientId"],
  ApplyAccountRestrictionRequest: [
    "accountId", "type", "mode", "publicReasonCode", "internalReason", "createdBy", "correlationId",
  ],
  RemoveAccountRestrictionRequest: ["accountId", "restrictionId", "removedBy", "correlationId"],
  SetDashboardAccessRequest: ["accountId", "allowed", "changedBy"],
  InviteAccountRequest: ["email", "displayName", "dashboardAccess", "invitedBy"],
};

const fieldEnums = {
  "AssignRoleRequest.roleKey": ["OWNER", "GROUP_ADMIN", "INSTALLATION_ADMIN", "INSTALLATION_HELPER", "EMPLOYEE"],
  "InviteMemberRequest.roleKey": ["OWNER", "GROUP_ADMIN", "INSTALLATION_ADMIN", "INSTALLATION_HELPER", "EMPLOYEE"],
  "AssignRoleRequest.scopeType": ["CUSTOMER_ACCOUNT", "INSTALLATION_GROUP", "INSTALLATION"],
  "InviteMemberRequest.scopeType": ["CUSTOMER_ACCOUNT", "INSTALLATION_GROUP", "INSTALLATION"],
  "RemoveMemberRequest.scopeType": ["CUSTOMER_ACCOUNT", "INSTALLATION_GROUP", "INSTALLATION"],
  "ApplyScopeRestrictionRequest.scopeType": ["CUSTOMER_ACCOUNT", "INSTALLATION_GROUP", "INSTALLATION"],
  "ActivateDeviceRequest.operatingSystem": ["windows", "macos", "linux"],
  "SessionClientMessage.kind": ["OPEN", "RESUME", "HEARTBEAT"],
  "ApplyBillingEventRequest.eventType": [
    "SUBSCRIPTION_CREATED", "PAYMENT_CONFIRMED", "SUBSCRIPTION_RENEWED",
    "PAYMENT_OVERDUE", "SUBSCRIPTION_CANCELLED", "SUBSCRIPTION_REACTIVATED",
  ],
  "ApplyScopeRestrictionRequest.mode": ["LOGIN_LIMITED", "SERVICE_LOCK", "READ_ONLY", "FULL_LOCK"],
  "RestrictContractOwnerRequest.mode": ["LOGIN_LIMITED", "SERVICE_LOCK", "READ_ONLY", "FULL_LOCK"],
};

const operationDescriptions = {
  "horizon.api.v1.HealthService.Check": "Liveness and version check for the public API service.",
  "horizon.api.v1.CustomerAdminService.CreateCustomerAccount": "Creates or reconciles the contract account owned by the authenticated dashboard user.",
  "horizon.api.v1.CustomerAdminService.CreateInstallationGroup": "Creates a group that shares device and module quotas across its installations.",
  "horizon.api.v1.CustomerAdminService.CreateInstallation": "Creates an installation or site inside an installation group.",
  "horizon.api.v1.CustomerAdminService.AssignRole": "Assigns a role at customer, group, or installation scope. Delegation is limited to the caller's own permissions.",
  "horizon.api.v1.CustomerAdminService.RevokeRoleAssignment": "Revokes one role assignment and terminates sessions that no longer remain authorized.",
  "horizon.api.v1.CustomerAdminService.InviteMember": "Creates or locates an Auth account and assigns it to a tenant scope.",
  "horizon.api.v1.CustomerAdminService.RemoveMember": "Revokes matching assignments and terminates affected live sessions.",
  "horizon.api.v1.CustomerAdminService.ApplyScopeRestriction": "Applies a fail-closed restriction to a customer, group, or installation scope.",
  "horizon.api.v1.CustomerAdminService.RemoveScopeRestriction": "Removes a previously applied scope restriction.",
  "horizon.api.v1.CustomerAdminService.RestrictContractOwner": "Coordinates an owner account restriction in Auth with a customer-wide service restriction in API.",
  "horizon.api.v1.CustomerAdminService.LiftContractRestriction": "Removes the coordinated Auth and API restriction pair.",
  "horizon.api.v1.LicenseService.ActivateDevice": "Activates an installation instance while atomically enforcing group and installation device quotas.",
  "horizon.api.v1.LicenseService.DeactivateDevice": "Deactivates a device and terminates its live sessions.",
  "horizon.api.v1.LicenseService.GetEntitlements": "Returns effective modules, quota use, and restriction state for a device.",
  "horizon.api.v1.LicenseService.ConnectSession": "Bidirectional native gRPC stream. The first client message is OPEN or RESUME; later messages are HEARTBEAT. Swagger UI cannot execute streaming RPCs.",
  "horizon.api.v1.BillingService.ApplyBillingEvent": "Applies an ordered, idempotent subscription event from a trusted billing backend.",
  "horizon.auth.v1.HealthService.Check": "Liveness and version check for the Auth RPC service.",
  "horizon.auth.v1.AuthPublicService.GetMySecurityProfile": "Returns the authenticated user's verification, MFA, Passkey, session, and restriction status.",
  "horizon.auth.v1.AuthPublicService.RevokeMySessions": "Revokes the user's sessions, optionally retaining the current web session.",
  "horizon.auth.v1.AuthInternalService.Introspect": "Validates a reference access token for an exact client ID. Internal backplane only.",
  "horizon.auth.v1.AuthInternalService.ApplyAccountRestriction": "Applies an account restriction and publishes a monotonic security event. Internal backplane only.",
  "horizon.auth.v1.AuthInternalService.RemoveAccountRestriction": "Removes an account restriction and publishes a monotonic security event. Internal backplane only.",
  "horizon.auth.v1.AuthInternalService.SetDashboardAccess": "Changes dashboard access and revokes incompatible sessions. Internal backplane only.",
  "horizon.auth.v1.AuthInternalService.InviteAccount": "Creates or reconciles an invited account. Internal backplane only.",
  "horizon.auth.v1.AuthInternalService.WatchSecurityEvents": "Resumable server-streaming security event feed. Internal backplane only; Swagger UI cannot execute streaming RPCs.",
};

const tagDescriptions = {
  HealthService: "Service health and release identity.",
  CustomerAdminService: "Tenant hierarchy, membership, roles, and restrictions.",
  LicenseService: "Device activation, entitlements, and live application sessions.",
  BillingService: "Trusted, idempotent billing event ingestion.",
  AuthPublicService: "Authenticated account security operations.",
  AuthInternalService: "Private service-backplane operations. These routes are blocked at the public origin.",
  OIDC: "OAuth 2.0 and OpenID Connect endpoints used by browser and desktop clients.",
  AccountUI: "Public account and login surface.",
};

function words(value) {
  return value.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function fieldSchema(field, messageName) {
  field.resolve();
  let schema;
  if (field.resolvedType instanceof protobuf.Enum) {
    schema = { type: "string", enum: Object.keys(field.resolvedType.values) };
  } else if (field.resolvedType instanceof protobuf.Type) {
    schema = { $ref: "#/components/schemas/" + field.resolvedType.name };
  } else {
    schema = { ...(scalarSchemas[field.type] ?? { type: "string" }) };
  }

  const enumValues = fieldEnums[messageName + "." + field.name];
  if (enumValues) schema = { type: "string", enum: enumValues };
  if (field.name.endsWith("Unix")) {
    schema.description = "Unix timestamp in seconds, encoded as a decimal string by ProtoJSON.";
    schema.example = "1791392400";
  } else if (field.name === "email") {
    schema.format = "email";
    schema.example = "person@example.com";
  } else if (field.name.endsWith("Id") || field.name.includes("Id")) {
    schema.description = "Opaque server-issued identifier.";
  }
  if (field.repeated) schema = { type: "array", items: schema };
  return schema;
}

function schemasFor(namespace) {
  const schemas = {};
  for (const value of Object.values(namespace.nested ?? {})) {
    if (value instanceof protobuf.Type) {
      const properties = {};
      for (const field of value.fieldsArray) properties[field.name] = fieldSchema(field, value.name);
      const schema = {
        type: "object",
        description: words(value.name) + " encoded with ProtoJSON field names.",
        properties,
        additionalProperties: false,
      };
      const required = requiredByMessage[value.name];
      if (required?.length) schema.required = required;
      schemas[value.name] = schema;
    }
  }
  schemas.ConnectError = {
    type: "object",
    description: "Connect protocol error envelope.",
    required: ["code", "message"],
    properties: {
      code: { type: "string", example: "invalid_argument" },
      message: { type: "string" },
      details: { type: "array", items: { type: "object", additionalProperties: true } },
    },
    additionalProperties: true,
  };
  return schemas;
}

function securityFor(packageName, serviceName) {
  if (serviceName === "HealthService") return [];
  if (serviceName === "BillingService") return [{ BillingServiceToken: [] }];
  if (serviceName === "AuthInternalService") return [{ InternalServiceToken: [] }];
  return [{ OAuth2: ["openid", "profile", "email"] }];
}

function rpcPaths(namespace, packageName) {
  const paths = {};
  for (const service of Object.values(namespace.nested ?? {})) {
    if (!(service instanceof protobuf.Service)) continue;
    for (const method of service.methodsArray) {
      method.resolve();
      const operationId = packageName + "." + service.name + "." + method.name;
      const streaming = method.requestStream || method.responseStream;
      paths["/" + packageName + "." + service.name + "/" + method.name] = {
        post: {
          tags: [service.name],
          summary: words(method.name),
          description: operationDescriptions[operationId] ?? (words(method.name) + "."),
          operationId,
          security: securityFor(packageName, service.name),
          parameters: streaming ? [] : [{ $ref: "#/components/parameters/ConnectProtocolVersion" }],
          requestBody: {
            required: method.resolvedRequestType.fieldsArray.length > 0,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/" + method.resolvedRequestType.name },
              },
            },
          },
          responses: {
            "200": {
              description: streaming ? "Streaming response. Use a native gRPC client." : "Successful ProtoJSON response.",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/" + method.resolvedResponseType.name },
                },
              },
            },
            default: { $ref: "#/components/responses/ConnectError" },
          },
          ...(streaming ? {
            "x-horizonsuite-streaming": method.requestStream && method.responseStream ? "bidirectional" : "server",
            "x-horizonsuite-try-it-out": false,
          } : {}),
          ...(service.name === "AuthInternalService" ? { "x-horizonsuite-internal-only": true } : {}),
        },
      };
    }
  }
  return paths;
}

function commonComponents(schemas, packageName) {
  const securitySchemes = {
    OAuth2: {
      type: "oauth2",
      description: "Authorization Code with PKCE S256. Public clients do not use a client secret.",
      flows: {
        authorizationCode: {
          authorizationUrl: AUTH_ORIGIN + "/auth",
          tokenUrl: AUTH_ORIGIN + "/token",
          scopes: {
            openid: "OpenID Connect identity",
            profile: "Basic profile claims",
            email: "Email and verification claims",
            offline_access: "Refresh token access",
          },
        },
      },
    },
  };
  if (packageName === "horizon.auth.v1") {
    securitySchemes.InternalServiceToken = {
      type: "apiKey",
      in: "header",
      name: "X-Internal-Service-Token",
      description: "Confidential service-backplane credential. Never expose it in browser or desktop code.",
    };
  }
  if (packageName === "horizon.api.v1") {
    securitySchemes.BillingServiceToken = {
      type: "apiKey",
      in: "header",
      name: "X-Billing-Service-Token",
      description: "Confidential billing backend credential. Never expose it in frontend code.",
    };
  }
  return {
    schemas,
    parameters: {
      ConnectProtocolVersion: {
        name: "Connect-Protocol-Version",
        in: "header",
        required: true,
        description: "Connect unary protocol version.",
        schema: { type: "string", const: "1", default: "1" },
      },
    },
    responses: {
      ConnectError: {
        description: "Connect protocol error.",
        content: {
          "application/json": { schema: { $ref: "#/components/schemas/ConnectError" } },
        },
      },
    },
    securitySchemes,
  };
}

async function documentFromProto({ protoPath, packageName, title, description, serverUrl }) {
  const root = await protobuf.load(protoPath);
  root.resolveAll();
  const namespace = root.lookup(packageName);
  const schemas = schemasFor(namespace);
  delete schemas.Empty;
  const paths = rpcPaths(namespace, packageName);
  const tags = Object.values(namespace.nested ?? {})
    .filter((value) => value instanceof protobuf.Service)
    .map((service) => ({ name: service.name, description: tagDescriptions[service.name] }));
  return {
    openapi: "3.1.1",
    info: {
      title,
      version: "0.1.0",
      description,
      contact: { name: "HorizonSuite", url: "https://github.com/horizonsuite/api-documentation" },
    },
    externalDocs: {
      description: "Canonical Protocol Buffer contracts",
      url: "https://github.com/horizonsuite/api-documentation/tree/main/proto",
    },
    servers: [{ url: serverUrl, description: "Production" }],
    tags,
    paths,
    components: commonComponents(schemas, packageName),
  };
}

function addAuthHttpEndpoints(document) {
  document.tags.unshift({ name: "OIDC", description: tagDescriptions.OIDC });
  Object.assign(document.components.schemas, {
    OidcDiscovery: {
      type: "object",
      required: ["issuer", "authorization_endpoint", "token_endpoint", "jwks_uri"],
      properties: {
        issuer: { type: "string", format: "uri" },
        authorization_endpoint: { type: "string", format: "uri" },
        token_endpoint: { type: "string", format: "uri" },
        userinfo_endpoint: { type: "string", format: "uri" },
        jwks_uri: { type: "string", format: "uri" },
        end_session_endpoint: { type: "string", format: "uri" },
        scopes_supported: { type: "array", items: { type: "string" } },
        response_types_supported: { type: "array", items: { type: "string" } },
        grant_types_supported: { type: "array", items: { type: "string" } },
        code_challenge_methods_supported: { type: "array", items: { type: "string" } },
      },
      additionalProperties: true,
    },
    TokenResponse: {
      type: "object",
      required: ["access_token", "token_type", "expires_in"],
      properties: {
        access_token: { type: "string" },
        token_type: { type: "string", example: "Bearer" },
        expires_in: { type: "integer", format: "int32" },
        refresh_token: { type: "string" },
        id_token: { type: "string" },
        scope: { type: "string" },
      },
    },
    UserInfo: {
      type: "object",
      required: ["sub"],
      properties: {
        sub: { type: "string" },
        name: { type: "string" },
        email: { type: "string", format: "email" },
        email_verified: { type: "boolean" },
      },
      additionalProperties: true,
    },
    JwkSet: {
      type: "object",
      required: ["keys"],
      properties: { keys: { type: "array", items: { type: "object", additionalProperties: true } } },
    },
  });

  document.paths["/.well-known/openid-configuration"] = {
    get: {
      tags: ["OIDC"],
      summary: "Discover the OpenID Provider",
      operationId: "oidcDiscovery",
      security: [],
      responses: {
        "200": {
          description: "OpenID Provider metadata.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/OidcDiscovery" } } },
        },
      },
    },
  };
  document.paths["/healthz"] = {
    get: {
      tags: ["HealthService"],
      summary: "Check the Auth web service",
      operationId: "authWebHealth",
      security: [],
      responses: {
        "200": {
          description: "Healthy service.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status", "service", "version"],
                properties: {
                  status: { type: "string", const: "ok" },
                  service: { type: "string", const: "auth-server" },
                  version: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
  document.paths["/auth"] = {
    get: {
      tags: ["OIDC"],
      summary: "Start Authorization Code with PKCE",
      operationId: "oidcAuthorize",
      security: [],
      parameters: [
        { name: "response_type", in: "query", required: true, schema: { type: "string", const: "code" } },
        { name: "client_id", in: "query", required: true, schema: { type: "string", enum: ["horizon-dashboard", "horizon-desktop"] } },
        { name: "redirect_uri", in: "query", required: true, schema: { type: "string", format: "uri" } },
        { name: "scope", in: "query", required: true, schema: { type: "string", example: "openid profile email offline_access" } },
        { name: "state", in: "query", required: true, schema: { type: "string" } },
        { name: "code_challenge", in: "query", required: true, schema: { type: "string" } },
        { name: "code_challenge_method", in: "query", required: true, schema: { type: "string", const: "S256" } },
      ],
      responses: {
        "302": { description: "Redirects into the protected login and consent interaction." },
        default: { description: "Invalid OAuth request." },
      },
    },
  };
  document.paths["/token"] = {
    post: {
      tags: ["OIDC"],
      summary: "Exchange an authorization code or refresh token",
      operationId: "oidcToken",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/x-www-form-urlencoded": {
            schema: {
              type: "object",
              required: ["grant_type", "client_id"],
              properties: {
                grant_type: { type: "string", enum: ["authorization_code", "refresh_token"] },
                client_id: { type: "string" },
                code: { type: "string" },
                redirect_uri: { type: "string", format: "uri" },
                code_verifier: { type: "string" },
                refresh_token: { type: "string" },
              },
            },
          },
        },
      },
      responses: {
        "200": {
          description: "Token response.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/TokenResponse" } } },
        },
        default: { description: "OAuth token error." },
      },
    },
  };
  document.paths["/jwks"] = {
    get: {
      tags: ["OIDC"],
      summary: "Read JSON Web Keys",
      operationId: "oidcJwks",
      security: [],
      responses: {
        "200": {
          description: "Current public signing keys.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/JwkSet" } } },
        },
      },
    },
  };
  document.paths["/me"] = {
    get: {
      tags: ["OIDC"],
      summary: "Read OpenID Connect user information",
      operationId: "oidcUserInfo",
      security: [{ OAuth2: ["openid", "profile", "email"] }],
      responses: {
        "200": {
          description: "Claims for the current subject.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UserInfo" } } },
        },
        "401": { description: "Missing, invalid, or revoked access token." },
      },
    },
  };
  document.paths["/token/revocation"] = {
    post: {
      tags: ["OIDC"],
      summary: "Revoke an access or refresh token",
      operationId: "oidcRevokeToken",
      security: [],
      requestBody: {
        required: true,
        content: {
          "application/x-www-form-urlencoded": {
            schema: {
              type: "object",
              required: ["token"],
              properties: {
                token: { type: "string" },
                token_type_hint: { type: "string", enum: ["access_token", "refresh_token"] },
                client_id: { type: "string" },
              },
            },
          },
        },
      },
      responses: { "200": { description: "The token is now revoked or was already invalid." } },
    },
  };
  return document;
}

const api = await documentFromProto({
  protoPath: "proto/horizon/api/v1/api.proto",
  packageName: "horizon.api.v1",
  title: "HorizonSuite API Server",
  description: "Connect, gRPC-Web, and native gRPC contracts for tenant administration, licensing, devices, and live sessions. Unary methods use ProtoJSON over HTTP POST. Bidirectional streaming methods require a native gRPC client.",
  serverUrl: API_ORIGIN,
});

const auth = addAuthHttpEndpoints(await documentFromProto({
  protoPath: "proto/horizon/auth/v1/auth.proto",
  packageName: "horizon.auth.v1",
  title: "HorizonSuite Auth Server",
  description: "OAuth 2.0, OpenID Connect, account security, and service-backplane contracts. Public clients use Authorization Code with PKCE S256 and never embed a client secret.",
  serverUrl: AUTH_ORIGIN,
}));

await mkdir(generatedDir, { recursive: true });
await Promise.all([
  writeFile(path.join(generatedDir, "api.json"), JSON.stringify(api, null, 2) + "\n", "utf8"),
  writeFile(path.join(generatedDir, "auth.json"), JSON.stringify(auth, null, 2) + "\n", "utf8"),
]);

console.log("Generated OpenAPI documents from Protocol Buffer contracts");
