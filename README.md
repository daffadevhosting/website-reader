🚀 Workers Content Extractor API

Cloudflare Worker untuk ekstraksi konten web yang compatible dengan R.jina.ai, mendukung SPA (Single Page Applications) dan website tradisional.

✨ Features

· ✅ Jina.ai Compatible - Drop-in replacement untuk R.jina.ai
· ✅ SPA Support - Ekstrak konten dari JavaScript-heavy websites
· ✅ Markdown Output - Konten dalam format terstruktur
· ✅ Lightning Fast - Cloudflare edge network
· ✅ Free & Open Source - Tidak ada biaya API
· ✅ CORS Enabled - Ready untuk frontend applications
· ✅ Multiple URL Formats - Support berbagai cara request

🚀 Quick Start

Basic Usage

```bash
# Jina.ai style (recommended)
curl "https://readability.mvstream.workers.dev/https://example.com"

# Query parameter style
curl "https://readability.mvstream.workers.dev/?url=https://example.com"

# POST request
curl -X POST https://readability.mvstream.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

📋 API Reference

GET /https://example.com

Ekstrak konten dari URL langsung (Jina-style)

GET /?url=https://example.com

Ekstrak konten via query parameter

POST /

```json
{
  "url": "https://example.com"
}
```

Parameters

Parameter Type Default Description
url string required Target URL untuk diekstrak
format string text Output format: text atau json

📦 Response Formats

Text Format (Default)

```
Title: Website Title
Source: https://example.com

Konten website dalam format text/markdown...
Section headings, paragraphs, lists, dll.
```

JSON Format

```bash
curl "https://readability.mvstream.workers.dev/https://example.com?format=json"
```

```json
{
  "success": true,
  "data": {
    "url": "https://example.com",
    "title": "Website Title",
    "byline": "Author Name",
    "excerpt": "Article excerpt...",
    "content": "Full content in markdown...",
    "length": 1500,
    "siteName": "Site Name"
  }
}
```

🔧 Installation & Deployment

Prerequisites

· Cloudflare Account
· Wrangler CLI
· Node.js 16+

1. Clone & Setup

```bash
git clone <your-repo>
cd rjina-worker
npm install
```

2. Configure Wrangler

```bash
npx wrangler login
```

3. Deploy

```bash
# Development
npm run dev

# Production
npm run deploy
```

🛠️ Technical Details

Built With

· Cloudflare Workers - Edge runtime
· Mozilla Readability - Content extraction
· LinkedOM - DOM parsing
· HTML-to-Text - Clean text conversion

Architecture

```
Request → Cloudflare Worker → Fetch Target URL → 
Readability Extraction → Text Cleaning → Response
```

🎯 Use Cases

1. AI Content Processing

```javascript
// Untuk AI coding assistants
const content = await extractContent('https://docs.example.com');
// Gunakan content untuk AI analysis dan code generation
```

2. Web Scraping API

```javascript
// Untuk aplikasi yang butuh web content
fetch('https://readability.mvstream.workers.dev/https://news-site.com')
  .then(r => r.text())
  .then(content => {
    // Process content untuk aplikasi Anda
  });
```

3. Content Migration

```javascript
// Migrasi konten antar platform
const oldContent = await extractContent('https://old-blog.com/post');
// Convert ke format baru dan simpan
```

🔄 Integration Examples

Frontend JavaScript

```javascript
async function extractWebContent(url) {
  const response = await fetch(`https://readability.mvstream.workers.dev/${url}`);
  return await response.text();
}

// Usage
const article = await extractWebContent('https://blog.example.com/post');
console.log(article);
```

Node.js Application

```javascript
const fetch = require('node-fetch');

class ContentExtractor {
  constructor(baseUrl = 'https://readability.mvstream.workers.dev') {
    this.baseUrl = baseUrl;
  }

  async extract(url) {
    const response = await fetch(`${this.baseUrl}/${url}`);
    return await response.text();
  }
}
```

Python Application

```python
import requests

def extract_content(url):
    response = requests.get(f"https://readability.mvstream.workers.dev/{url}")
    return response.text

# Usage
content = extract_content("https://example.com")
print(content)
```

⚡ Performance

· Response Time: < 2 seconds (rata-rata)
· Uptime: 99.9% (Cloudflare guarantee)
· Cache: Built-in Cloudflare caching
· Scale: Unlimited dengan Workers plan

🔒 Error Handling

Common Errors

```json
{
  "error": "Missing URL parameter"
}
```

```json
{
  "error": "Invalid URL format"
}
```

```json
{
  "error": "Could not extract content from page"
}
```

HTTP Status Codes

· 200 - Success
· 400 - Bad Request (invalid URL, missing parameter)
· 408 - Request Timeout
· 500 - Internal Server Error

🌐 CORS Support

API fully support CORS untuk frontend applications:

```javascript
// Browser applications
fetch('https://readability.mvstream.workers.dev/https://example.com')
  .then(response => response.text())
  .then(content => {
    // Process content di browser
  });
```

📊 Examples

Input URL

```
https://coder-ai.pages.dev
```

Output

```
Title: CoderAI - AI-Powered Coding Assistant
Source: https://coder-ai.pages.dev

CoderAI - AI-Powered Coding Assistant
## AI-Powered Coding Assistant
Generate API keys and integrate with our powerful LLM chat API. Perfect for developers building AI applications.

## Features
### ** API Key Management
Generate, manage, and revoke API keys with ease

### ** Rate Limiting
Customizable rate limits for each API key

### ** Usage Analytics
Track your API usage and monitor performance

## Pricing
### Starter Pack
$6/10,000
- ** 10,000 AI Tokens
- ** API Key Management
- ** Usage Analytics
- ** Priority Support

[Get Started](https://coder-ai.pages.dev/dashboard)
...
```

🚨 Limitations

· JavaScript Execution: Tidak execute JavaScript client-side
· Dynamic Content: Konten yang di-load via AJAX mungkin tidak terambil
· Authentication: Tidak support websites yang butuh login
· Rate Limiting: Basic rate limiting (consider upgrade untuk heavy use)

🔄 Comparison dengan R.jina.ai

Feature R.jina.ai rJina Worker
Cost $10-$500/month FREE
JavaScript Rendering ✅ ⚠️ Limited
SPA Support ✅ ✅
Self-hosted ❌ ✅
Customizable ❌ ✅
Rate Limits Tier-based Generous

📈 Monitoring

Check usage di Cloudflare Dashboard:

```bash
# Install Wrangler
npm install -g wrangler

# View analytics
wrangler analytics
```

🤝 Contributing

Kontribusi welcome!

1. Fork repository
2. Buat feature branch (git checkout -b feature/AmazingFeature)
3. Commit changes (git commit -m 'Add AmazingFeature')
4. Push branch (git push origin feature/AmazingFeature)
5. Open Pull Request

📄 License

MIT License - bebas digunakan untuk project personal dan komersial.

🆓 Pricing

100% FREE - Tidak ada biaya bulanan, tidak ada limit request (dalam reasonable use).

🛠️ Support

Jika mengalami issues:

1. Check error message di response
2. Pastikan URL valid dan accessible
3. Test dengan website sederhana terlebih dahulu
4. Open issue di repository

---

Dibuat dengan ❤️ menggunakan Cloudflare Workers + Mozilla Readability

URL Production: https://readability.mvstream.workers.dev

Status: ✅ Production Ready