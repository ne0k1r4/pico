# Website Analyzer API

## POST `/v1/analyze`

Analyzes a public website URL and returns a structured PICO website profile.

### Request

```json
{
  "url": "https://example.com",
  "forceRefresh": false
}
```

### Response

```json
{
  "profile": {
    "url": "https://example.com/",
    "finalUrl": "https://example.com/",
    "origin": "https://example.com",
    "title": "Example Domain",
    "name": "Example Domain",
    "description": "Example description",
    "themeColor": "#155EEF",
    "favicon": "https://example.com/favicon.ico",
    "assets": [
      {
        "kind": "favicon",
        "url": "https://example.com/favicon.ico",
        "source": "heuristic"
      }
    ],
    "frameworks": [
      {
        "name": "nextjs",
        "confidence": 0.85,
        "evidence": ["__NEXT_DATA__ script", "_next static assets"]
      }
    ],
    "pwa": {
      "manifestUrl": "https://example.com/manifest.webmanifest",
      "manifest": {
        "name": "Example",
        "short_name": "Example",
        "theme_color": "#155EEF",
        "icons": [
          {
            "src": "https://example.com/icon-512.png",
            "sizes": "512x512",
            "type": "image/png"
          }
        ]
      },
      "serviceWorkerDetected": true,
      "serviceWorkerEvidence": ["serviceWorker.register call"],
      "pushNotificationsDetected": true
    },
    "security": {
      "https": true,
      "contentSecurityPolicy": true,
      "xFrameOptions": true
    },
    "analyzedAt": "2026-06-13T00:00:00.000Z"
  },
  "cache": {
    "hit": false,
    "ttlSeconds": 86400
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "ANALYSIS_FAILED",
    "message": "URL resolves to a private or reserved network"
  }
}
```

## GET `/health`

Returns service liveness.

```json
{
  "status": "ok"
}
```
