# HorizonSuite API documentation

Static Swagger UI documentation for the production HorizonSuite API and Auth
services. The site is built for GitHub Pages and is published at:

<https://horizonsuite.github.io/api-documentation/>

The canonical Protocol Buffer contracts are stored in `proto/`. The build
generates OpenAPI 3.1 documents from those contracts, validates them with
Redocly, and packages a pinned local copy of Swagger UI. No runtime dependency
is loaded from a third-party CDN.

## Local validation

```sh
npm ci
npm run check
```

The generated static site is written to `dist/`. Serve that directory through
any static HTTP server to test interactive requests and OAuth redirects.

## Publishing

Pushes to `main` run `.github/workflows/pages.yml`. Pull requests validate and
build the site without deploying it. The production workflow publishes the
verified `dist/` directory through GitHub Pages.

## Contract synchronization

Update the matching file under `proto/horizon/` whenever a server contract
changes, then run `npm run check`. The generator documents ProtoJSON field
names, Connect unary paths, security schemes, and streaming limitations.
