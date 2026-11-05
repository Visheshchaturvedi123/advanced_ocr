# Brahma Hub

Local companion service for Brahma modules that need native capabilities (currently Image Lab).

## Run

From the repo root:

```powershell
.\hub\start-brahma-hub.bat
```

Or directly:

```powershell
npx tsx hub\server.ts
```

The Hub listens only on `127.0.0.1:47821`. Keep the terminal open while using Image Lab.

## Token

On first start the Hub creates a random token and prints it:

```
Token: <random hex token>
Token file: <repo>\hub\data\hub-token.txt
```

Paste that token into **Brahma Settings -> Brahma Hub**, then click **Test Hub**.

To use a fixed token instead, set `BRAHMA_HUB_TOKEN` before starting:

```powershell
$env:BRAHMA_HUB_TOKEN = "your-token"
.\hub\start-brahma-hub.bat
```

## Security

- Binds to loopback only (`127.0.0.1`).
- Requires `X-Brahma-Token` (or `?token=`) on every request.
- CORS allows only `chrome-extension://` origins and the local Hub origin.
- Tokens are stored in `hub/data/hub-token.txt` and excluded from git.

## Data locations

Runtime data is kept under `hub/data`:

- `sample_photos/` - generated demo images
- `imported_photos/` - folders uploaded from the browser
- `optimized_webp/` - default optimization output
- `.cache/` - preview/thumbnail cache
- `hub-token.txt` - local auth token

## Endpoints

- `GET /api/hub/health` - Hub status
- `GET /api/hub/info` - Hub version/capabilities
- Image Lab routes under `/api/...` (scan, optimize, preview, thumbnails, ZIP download, history, cache)

## Troubleshooting

- **Hub offline**: start `start-brahma-hub.bat`; check `http://127.0.0.1:47821/api/hub/health` with your token.
- **Unauthorized**: re-copy the token from the Hub terminal or `hub/data/hub-token.txt` into Brahma Settings.
- **Sharp/Image Lab errors**: run `npm run modules:install` from the repo root.
- **Port already in use**: stop the other process or start with `BRAHMA_HUB_PORT=47822` and set the same URL in Brahma settings.
