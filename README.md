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
# Jina.ai compatible
curl "https://your-worker.workers.dev/https://news.ycombinator.com"

# Dengan semua fitur
curl "https://your-worker.workers.dev/https://example.com?enhanced=true&keywords=true&summary=true"

# Output text
curl "https://your-worker.workers.dev/https://example.com?format=text"

# Dengan limitasi
curl "https://your-worker.dev/https://example.com?maxLength=1000"
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

`GET /?url={url}`

Ekstrak konten dari URL yang diberikan

`POST /`

Ekstrak konten dari URL dalam request body

`OPTIONS /`

Handle CORS preflight requests

⚙️ Error Handling

HTTP Status Error Type Description

`400 Invalid URL Format URL tidak valid`

`400 URL parameter required Parameter URL tidak ditemukan`

`400 Content is not HTML Response bukan HTML`

`400 Could not extract content Gagal ekstrak konten`

`408 Request timeout Website terlalu lama merespon`

`429 Rate limit exceeded Melebihi batas request`

`500 Server error Error internal server`


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


🎨 Untuk AI Web Designer/Pengembangan Website

1. Content Analysis & Competitor Research

```javascript
// Analisis konten competitor
const competitorContent = await extractContent('https://competitor-website.com');
console.log(competitorContent.analysis);
// Hasil: wordCount, readingTime, keywords, structure
```

2. Auto Content Generation

```javascript
// Generate konten berdasarkan research
function generateContentBrief(targetUrl) {
  const analysis = await extractContent(targetUrl);
  
  return {
    targetWordCount: analysis.analysis.wordCount,
    keywords: analysis.keywords,
    readingTime: analysis.analysis.readingTime,
    contentStructure: analysis.analysis.paragraphCount,
    tone: analyzeTone(analysis.content)
  };
}
```

3. Website Migration & Redesign

```javascript
// Extract semua konten dari website lama
const pages = [
  '/about', '/services', '/blog/post-1', '/contact'
];

for (const page of pages) {
  const content = await extractContent(`https://old-website.com${page}`);
  // Simpan ke CMS baru atau generate HTML baru
  await saveToNewCMS(page, content);
}
```

🤖 Integration dengan AI Tools

1. ChatGPT + Web Content

```javascript
// System prompt untuk AI dengan context website
const systemPrompt = `
Anda adalah web designer. Berikut konten dari website client:

TITLE: ${article.title}
CONTENT: ${article.content}
KEYWORDS: ${article.keywords.map(k => k.word).join(', ')}
READING TIME: ${article.analysis.readingTime} menit

Berdasarkan ini, rekomendasikan redesign website.
`;
```

2. Auto Wireframe Generation

```javascript
// Analisis struktur untuk generate wireframe
function generateWireframeSpecs(content) {
  return {
    header: content.images.length > 0 ? 'with-hero' : 'minimal',
    contentSections: Math.ceil(content.analysis.paragraphCount / 3),
    sidebar: content.analysis.wordCount > 1000 ? true : false,
    imageGalleries: content.images.length > 5 ? 'grid-layout' : 'single-image'
  };
}
```

💡 Use Cases Spesifik untuk Web Designer

1. Client Onboarding Automation

```javascript
// Auto-analysis client's existing website
async function clientOnboarding(clientWebsite) {
  const analysis = await extractContent(clientWebsite);
  
  return {
    seoHealth: {
      wordCount: analysis.analysis.wordCount,
      keywordDensity: analysis.keywords,
      readability: analysis.analysis.readabilityScore
    },
    designRecommendations: {
      contentHierarchy: suggestHierarchy(analysis.content),
      imageOptimization: analysis.images.length,
      mobileOptimization: checkMobileReadability(analysis.content)
    },
    contentStrategy: {
      gaps: findContentGaps(analysis),
      opportunities: findSEOOpportunities(analysis.keywords)
    }
  };
}
```

2. Content Migration Tool

```javascript
// Convert website lama ke design system baru
class WebsiteMigrator {
  async migrate(oldUrl, newTemplate) {
    const content = await extractContent(oldUrl);
    
    return {
      title: content.title,
      content: this.reformatContent(content.content, newTemplate),
      metadata: {
        description: content.excerpt,
        keywords: content.keywords,
        images: content.images
      },
      design: this.applyDesignSystem(content, newTemplate)
    };
  }
}
```

3. A/B Testing Content Analysis

```javascript
// Analisis performa konten yang berbeda
async function analyzeContentPerformance(urlA, urlB) {
  const [contentA, contentB] = await Promise.all([
    extractContent(urlA),
    extractContent(urlB)
  ]);

  return {
    engagement: {
      a: contentA.analysis.readingTime,
      b: contentB.analysis.readingTime
    },
    seo: {
      a: contentA.keywords,
      b: contentB.keywords
    },
    recommendations: generateABRecommendations(contentA, contentB)
  };
}
```

🚀 Real Projects untuk Web Designer

Project 1: Auto Website Auditor

```javascript
// Comprehensive website audit
async function websiteAudit(siteUrl) {
  const pages = await crawlSitemap(siteUrl);
  const audits = [];
  
  for (const page of pages.slice(0, 10)) { // Sample 10 pages
    const content = await extractContent(page);
    audits.push({
      url: page,
      score: calculatePageScore(content),
      issues: findContentIssues(content),
      recommendations: generateRecommendations(content)
    });
  }
  
  return generateAuditReport(audits);
}
```

Project 2: Content Migration SaaS

```javascript
// Service untuk migrasi WordPress ke Webflow/Shopify
app.post('/migrate', async (req, res) => {
  const { oldSite, newPlatform } = req.body;
  
  const content = await extractContent(oldSite);
  const migrated = await migrateToPlatform(content, newPlatform);
  
  res.json({
    success: true,
    pagesMigrated: migrated.length,
    contentPreserved: calculatePreservationRate(content, migrated)
  });
});
```

Project 3: AI Design Assistant

```javascript
// ChatGPT plugin untuk web designer
const designAssistant = {
  async analyzeForRedesign(clientWebsite) {
    const content = await extractContent(clientWebsite);
    
    return {
      designBrief: `
        Client memiliki website dengan:
        - ${content.analysis.wordCount} kata konten
        - ${content.images.length} gambar
        - Fokus keyword: ${content.keywords.slice(0, 5).map(k => k.word).join(', ')}
        
        Rekomendasi design:
        ${content.analysis.readingTime > 5 ? 'Gunakan sidebar navigation' : 'Single page layout'}
        ${content.images.length > 10 ? 'Implement gallery grid' : 'Hero image focus'}
      `,
      contentStrategy: generateContentPlan(content),
      technicalSpecs: generateTechRequirements(content)
    };
  }
};
```

💰 Business Opportunities

1. Website Audit Service

```javascript
// Offer sebagai service ke client
const auditPackage = {
  basic: ['content-analysis', 'seo-check'],
  pro: ['competitor-analysis', 'migration-plan', 'content-strategy'],
  enterprise: ['full-automation', 'api-access', 'custom-integrations']
};
```

2. Content Migration Tool

· Migrasi WordPress → Webflow
· Shopify site redesign
· Legacy site modernization

3. AI-Powered Design Agency

```javascript
// Automated client proposals
async function generateProposal(clientWebsite) {
  const analysis = await extractContent(clientWebsite);
  
  return {
    currentState: analysis,
    proposedSolution: generateDesignSolution(analysis),
    timeline: estimateTimeline(analysis),
    cost: calculateProjectCost(analysis)
  };
}
```

🎯 Quick Start untuk Project

Install & Setup:

```bash
# Buat project baru
npm create cloudflare@latest my-design-tool
cd my-design-tool

# Install dependencies
npm install
```

Basic Integration:

```javascript
// design-assistant.js
export class DesignAssistant {
  constructor() {
    this.apiUrl = 'https://readability.mvstream.workers.dev';
  }
  
  async analyzeSite(url) {
    const response = await fetch(`${this.apiUrl}/${url}?enhanced=true`);
    const data = await response.json();
    
    return this.generateDesignRecommendations(data.data);
  }
  
  generateDesignRecommendations(content) {
    return {
      layout: this.suggestLayout(content),
      typography: this.suggestTypography(content),
      colorScheme: this.suggestColors(content),
      components: this.suggestComponents(content)
    };
  }
}
```

📝 License

GPL - 3.0 - bebas digunakan untuk project personal dan komersial.

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
