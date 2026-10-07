const baseUrl = new URL(".", window.location.href);

window.addEventListener("DOMContentLoaded", () => {
  const ui = SwaggerUIBundle({
    urls: [
      { name: "API Server", url: new URL("openapi/api.json", baseUrl).href },
      { name: "Auth Server", url: new URL("openapi/auth.json", baseUrl).href },
    ],
    "urls.primaryName": "API Server",
    dom_id: "#swagger-ui",
    deepLinking: true,
    displayOperationId: false,
    displayRequestDuration: true,
    filter: true,
    persistAuthorization: true,
    showExtensions: true,
    showCommonExtensions: true,
    tagsSorter: "alpha",
    operationsSorter: "alpha",
    validatorUrl: null,
    oauth2RedirectUrl: new URL("oauth2-redirect.html", baseUrl).href,
    requestInterceptor(request) {
      if (request.method === "POST" && request.url.includes("/horizon.")) {
        request.headers = request.headers || {};
        request.headers["Connect-Protocol-Version"] = "1";
      }
      return request;
    },
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset,
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl,
    ],
    layout: "StandaloneLayout",
  });

  ui.initOAuth({
    clientId: "horizon-api-docs",
    appName: "HorizonSuite API Reference",
    scopes: ["openid", "profile", "email", "offline_access"],
    usePkceWithAuthorizationCodeGrant: true,
  });

  window.ui = ui;
});
