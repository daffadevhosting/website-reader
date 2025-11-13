📄 Content Extractor API

Cloudflare Worker untuk ekstraksi konten artikel dari berbagai website. API ini menggunakan Mozilla Readability untuk mengambil konten utama dari halaman web dan menyajikannya dalam format yang terstruktur.

✨ Fitur

· ✅ Content Extraction - Ekstrak konten utama dari artikel
· ✅ Plain Text Conversion - Konversi HTML ke teks bersih
· ✅ Metadata Extraction - Ambil metadata (Open Graph, Twitter Cards, dll)
· ✅ Image Extraction - Ekstrak semua gambar dari artikel
· ✅ Content Analysis - Analisis statistik konten (word count, reading time, dll)
· ✅ Keyword Extraction - Otomatis ekstrak kata kunci penting
· ✅ Summary Generation - Generate ringkasan otomatis
· ✅ Caching System - Cache hasil untuk performa lebih baik
· ✅ Rate Limiting - Proteksi terhadap abuse
· ✅ CORS Support - Support untuk frontend applications
· ✅ Multiple Formats - Response dalam JSON atau plain text

🚀 Cara Menggunakan

Basic Usage

```bash
# GET request
GET https://your-worker.workers.dev/?url=https://example.com/article

# POST request
POST https://your-worker.workers.dev/
Content-Type: application/json

{
  "url": "https://example.com/article"
}
```

Advanced Parameters

Parameter Type Default Description
url string required URL target untuk di-scrape
format string json Response format: json atau text
includeHtml boolean false Sertakan HTML content dalam response
maxLength number 0 Batas maksimal karakter konten (0 = unlimited)
keywords boolean true Include keyword extraction
summary boolean true Include auto-generated summary

Contoh Request Lengkap

```bash
# Dengan semua fitur
GET https://your-worker.workers.dev/?url=https://example.com/article&includeHtml=true&maxLength=5000&keywords=true&summary=true

# Format plain text
GET https://your-worker.workers.dev/?url=https://example.com/article&format=text

# Batasi konten
GET https://your-worker.workers.dev/?url=https://example.com/article&maxLength=1000
```

📋 Response Format

Success Response (JSON)

```json
{
  "success": true,
  "data": {
    "url": "https://example.com/article",
    "title": "Judul Artikel",
    "author": "Penulis Artikel",
    "content": "Konten artikel dalam format plain text...",
    "excerpt": "Ringkasan singkat artikel...",
    "length": 2450,
    "textLength": 450,
    "analysis": {
      "wordCount": 450,
      "sentenceCount": 25,
      "paragraphCount": 8,
      "readingTime": 3,
      "readabilityScore": 75,
      "avgWordsPerSentence": 18.0,
      "avgSentencePerParagraph": 3.1,
      "characterCount": 2450,
      "characterCountWithoutSpaces": 2050
    },
    "keywords": [
      {"word": "technology", "count": 15, "frequency": 3.33},
      {"word": "innovation", "count": 12, "frequency": 2.67}
    ],
    "summary": "Ringkasan otomatis dari artikel...",
    "images": [
      {
        "src": "https://example.com/image1.jpg",
        "alt": "Deskripsi gambar",
        "title": "Judul gambar",
        "width": 800,
        "height": 600
      }
    ],
    "metadata": {
      "description": "Meta description...",
      "keywords": "meta,keywords",
      "og:title": "Open Graph Title",
      "twitter:card": "summary_large_image"
    },
    "cached": false,
    "timestamp": "2024-01-01T12:00:00.000Z"
  }
}
```

Plain Text Response

```text
Konten artikel dalam format plain text...
```

🔧 Installation & Deployment

Prerequisites

· Node.js 16+
· Wrangler CLI
· Cloudflare Account

Setup

1. Install dependencies:

```bash
npm install
```

1. Configure Wrangler:

```bash
npx wrangler login
```

1. Deploy:

```bash
# Development
npm run dev

# Production
npm run deploy
```

Konfigurasi KV (Opsional)

Untuk menggunakan fitur cache dan rate limiting, setup KV namespace:

```bash
# Create KV namespace
npx wrangler kv:namespace create YOUR_NAMESPACE

# Update wrangler.toml dengan binding ID
```

wrangler.toml:

```toml
name = "content-extractor"
compatibility_date = "2023-10-01"

[[kv_namespaces]]
binding = "YOUR_NAMESPACE"
id = "your-kv-namespace-id"
```

🛠️ API Endpoints

GET /?url={url}

Ekstrak konten dari URL yang diberikan

POST /

Ekstrak konten dari URL dalam request body

OPTIONS /

Handle CORS preflight requests

⚙️ Error Handling

HTTP Status Error Type Description
400 Invalid URL Format URL tidak valid
400 URL parameter required Parameter URL tidak ditemukan
400 Content is not HTML Response bukan HTML
400 Could not extract content Gagal ekstrak konten
408 Request timeout Website terlalu lama merespon
429 Rate limit exceeded Melebihi batas request
500 Server error Error internal server

🔒 Rate Limiting

· 100 requests per hour per IP address
· Menggunakan Cloudflare KV untuk penyimpanan
· Optional - bisa di-disable dengan menghapus KV binding

🎯 Use Cases

· Content Aggregation - Kumpulkan artikel dari berbagai sumber
· Text Analysis - Analisis konten untuk NLP
· News Monitoring - Monitor berita dari berbagai website
· Research Tool - Ekstrak data untuk penelitian
· Content Preview - Generate preview untuk link sharing

🌐 CORS Support

API mendukung CORS untuk penggunaan di frontend applications:

```javascript
fetch('https://your-worker.workers.dev/?url=https://example.com')
  .then(response => response.json())
  .then(data => console.log(data));
```

🚫 Limitations

· Tidak support JavaScript-heavy websites (SPA)
· Mungkin tidak bekerja dengan website yang membutuhkan authentication
· Beberapa website mungkin memblokir scraping
· Ukuran worker memory limit (~128MB)

🔧 Development

```bash
# Development server
npm run dev

# Deploy to production
npm run deploy

# Test locally
curl "http://localhost:8787/?url=https://example.com"
```

📝 License

MIT License - bebas digunakan untuk project personal dan komersial.

🤝 Contributing

Pull requests welcome! Untuk perubahan besar, silakan buka issue terlebih dahulu.

📞 Support

Jika mengalami masalah:

1. Cek error message di response
2. Pastikan URL valid dan accessible
3. Coba tanpa parameter tambahan terlebih dahulu
4. Buat issue di repository

---

Dibuat dengan ❤️ menggunakan Cloudflare Workers + Mozilla Readability
