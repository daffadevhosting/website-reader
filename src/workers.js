import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

// Konfigurasi
const CACHE_TTL = 3600; // 1 jam cache
const RATE_LIMIT = 100; // 100 requests per jam
const REQUEST_TIMEOUT = 10000; // 10 detik timeout

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
      });
    }

    try {
      const url = new URL(request.url);
      const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
      
      // Rate Limiting
      if (!await checkRateLimit(clientIP, env)) {
        return jsonResponse({ 
          error: 'Rate limit exceeded', 
          message: 'Maximum 100 requests per hour' 
        }, 429);
      }

      // Method 1: GET parameter
      let targetUrl = url.searchParams.get('url');
      
      // Method 2: POST body
      if (!targetUrl && request.method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await request.json();
          targetUrl = body.url;
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const body = await request.text();
          const params = new URLSearchParams(body);
          targetUrl = params.get('url');
        }
      }

      if (!targetUrl) {
        return jsonResponse({
          error: 'URL parameter required',
          example: 'https://your-worker.dev/?url=https://example.com',
          usage: {
            get: 'GET /?url=https://example.com',
            post: 'POST / with JSON { "url": "https://example.com" }'
          }
        }, 400);
      }

      // Validate URL
      try {
        new URL(targetUrl);
      } catch {
        return jsonResponse({ error: 'Invalid URL format' }, 400);
      }

      // Cek cache dulu
      const cacheKey = `article:${btoa(targetUrl)}`;
      const cached = await env.YOUR_NAMESPACE?.get(cacheKey, 'json');
      
      if (cached) {
        cached.data.cached = true;
        return jsonResponse(cached);
      }

      // Fetch dengan timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), REQUEST_TIMEOUT)
      );

      const response = await Promise.race([
        fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
          },
        }),
        timeoutPromise
      ]);

      if (!response.ok) {
        return jsonResponse({
          error: `Failed to fetch URL: ${response.status}`,
          status: response.status,
          statusText: response.statusText
        }, response.status);
      }

      const html = await response.text();
      const contentType = response.headers.get('content-type') || '';

      // Check if response is HTML
      if (!contentType.includes('text/html')) {
        return jsonResponse({
          error: 'Content is not HTML',
          contentType,
          supported: ['text/html', 'application/xhtml+xml']
        }, 400);
      }

      // Parse HTML dengan linkedom dan base href
      const htmlWithBase = `<base href="${targetUrl}">${html}`;
      const { document } = parseHTML(htmlWithBase);
      
      // Extract metadata sebelum Readality (karena Readability bisa modif DOM)
      const metadata = extractMetadata(document);
      const images = extractImages(document, targetUrl);

      // Parse dengan Readability
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        return jsonResponse({
          error: 'Could not extract content from page',
          suggestion: 'The page might be too complex or require JavaScript'
        }, 400);
      }

      // Convert HTML to plain text
      const plainText = htmlToPlainText(article.content);

      // Opsi format dari parameter
      const format = url.searchParams.get('format') || 'json';
      const includeHtml = url.searchParams.get('includeHtml') === 'true';
      const maxLength = parseInt(url.searchParams.get('maxLength')) || 0;
      const includeKeywords = url.searchParams.get('keywords') !== 'false';
      const includeSummary = url.searchParams.get('summary') !== 'false';

      // Potong teks jika diperlukan
      let finalContent = plainText;
      if (maxLength > 0 && finalContent.length > maxLength) {
        finalContent = finalContent.substring(0, maxLength) + '...';
      }

      // Analisis konten
      const analysis = analyzeContent(finalContent);
      
      // Data response lengkap
      const result = {
        success: true,
        data: {
          url: targetUrl,
          title: article.title,
          author: article.author,
          content: finalContent,
          excerpt: article.excerpt,
          length: finalContent.length,
          textLength: analysis.wordCount,
          analysis: analysis,
          images: images,
          metadata: metadata,
          ...(includeHtml && { htmlContent: article.content }),
          ...(includeKeywords && { keywords: extractKeywords(finalContent) }),
          ...(includeSummary && { summary: generateSummary(finalContent) }),
          cached: false,
          timestamp: new Date().toISOString()
        },
      };

      // Simpan ke cache (jika available)
      if (env.YOUR_NAMESPACE) {
        await env.YOUR_NAMESPACE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: CACHE_TTL
        });
      }

      // Response berdasarkan format
      if (format === 'text') {
        return new Response(finalContent, {
          headers: { 
            'Content-Type': 'text/plain; charset=utf-8', 
            'Access-Control-Allow-Origin': '*',
            'X-Original-Title': article.title || '',
            'X-Word-Count': analysis.wordCount.toString()
          }
        });
      }

      return jsonResponse(result);

    } catch (error) {
      console.error('Error:', error);
      
      if (error.message === 'Request timeout') {
        return jsonResponse({ 
          error: 'Request timeout',
          message: 'The website took too long to respond'
        }, 408);
      }
      
      return jsonResponse({
        error: 'Server error',
        message: error.message,
        stack: env.NODE_ENV === 'development' ? error.stack : undefined
      }, 500);
    }
  },
};

// ========== FITUR CACHE ==========
async function checkRateLimit(ip, env) {
  if (!env.YOUR_NAMESPACE) return true; // Skip jika tidak ada KV
  
  const key = `rate:${ip}`;
  const current = await env.YOUR_NAMESPACE.get(key);
  
  if (current && parseInt(current) >= RATE_LIMIT) {
    return false;
  }
  
  await env.YOUR_NAMESPACE.put(key, (parseInt(current) || 0) + 1, {
    expirationTtl: 3600
  });
  
  return true;
}

// ========== FITUR ANALISIS KONTEN ==========
function analyzeContent(text) {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  // Reading time (average 200 WPM)
  const readingTime = Math.max(1, Math.ceil(words.length / 200));
  
  // Basic readability score
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
  const readabilityScore = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence * 1.5)));
  
  // Character statistics
  const chars = text.length;
  const charsWithoutSpaces = text.replace(/\s/g, '').length;
  
  return {
    wordCount: words.length,
    sentenceCount: sentences.length,
    paragraphCount: paragraphs.length,
    readingTime,
    readabilityScore: Math.round(readabilityScore),
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    avgSentencePerParagraph: paragraphs.length > 0 ? Math.round(sentences.length / paragraphs.length * 10) / 10 : 0,
    characterCount: chars,
    characterCountWithoutSpaces: charsWithoutSpaces
  };
}

// ========== FITUR KEYWORD EXTRACTION ==========
function extractKeywords(text, maxKeywords = 15) {
  const words = text.toLowerCase().split(/\s+/);
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
    'of', 'with', 'by', 'as', 'is', 'was', 'were', 'be', 'been', 'have',
    'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'this', 'that', 'these', 'those', 'from', 'about', 'into', 'through'
  ]);
  
  const frequency = {};
  words.forEach(word => {
    // Clean word: remove punctuation, keep only letters and numbers
    word = word.replace(/[^a-z0-9]/g, '');
    if (word.length > 3 && !stopWords.has(word)) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  });
  
  return Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word, count]) => ({ word, count, frequency: Math.round((count / words.length) * 10000) / 100 }));
}

// ========== FITUR SUMMARY GENERATION ==========
function generateSummary(text, maxSentences = 3) {
  const sentences = text.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 500); // Filter kalimat yang terlalu pendek/panjang
  
  if (sentences.length === 0) return '';
  
  // Prioritize early sentences (often contain main ideas)
  const importantSentences = sentences.slice(0, Math.min(maxSentences * 2, sentences.length));
  
  // Simple scoring based on position and length
  const scoredSentences = importantSentences.map((sentence, index) => ({
    sentence,
    score: (importantSentences.length - index) * 0.5 + Math.min(sentence.length / 100, 1)
  }));
  
  // Take top sentences
  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map(item => item.sentence + '.')
    .join(' ');
}

// ========== FITUR IMAGE EXTRACTION ==========
function extractImages(document, baseUrl) {
  try {
    const images = Array.from(document.querySelectorAll('img'))
      .map(img => {
        let src = img.src || '';
        // Resolve relative URLs
        if (src && !src.startsWith('http')) {
          src = new URL(src, baseUrl).href;
        }
        
        return {
          src: src,
          alt: img.alt || '',
          title: img.title || '',
          width: img.width || null,
          height: img.height || null
        };
      })
      .filter(img => img.src && img.src.startsWith('http')); // Filter hanya URL valid
    
    return images.slice(0, 20); // Batasi jumlah gambar
  } catch (error) {
    return [];
  }
}

// ========== FITUR METADATA EXTRACTION ==========
function extractMetadata(document) {
  const metadata = {};
  
  try {
    // Standard meta tags
    const metaTags = document.querySelectorAll('meta[name][content]');
    metaTags.forEach(tag => {
      const name = tag.getAttribute('name');
      const content = tag.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    // Open Graph metadata
    const ogTags = document.querySelectorAll('meta[property^="og:"]');
    ogTags.forEach(tag => {
      const property = tag.getAttribute('property');
      const content = tag.getAttribute('content');
      if (property && content) {
        metadata[property] = content;
      }
    });
    
    // Twitter Card metadata
    const twitterTags = document.querySelectorAll('meta[name^="twitter:"]');
    twitterTags.forEach(tag => {
      const name = tag.getAttribute('name');
      const content = tag.getAttribute('content');
      if (name && content) {
        metadata[name] = content;
      }
    });
    
    // Canonical URL
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      metadata.canonical = canonical.getAttribute('href');
    }
    
    // Description from meta or first paragraph
    if (!metadata.description) {
      const firstParagraph = document.querySelector('p');
      if (firstParagraph) {
        metadata.autoDescription = firstParagraph.textContent?.substring(0, 200) + '...';
      }
    }
    
  } catch (error) {
    console.error('Metadata extraction error:', error);
  }
  
  return metadata;
}

// ========== FUNGSI BANTU YANG SUDAH ADA ==========
function htmlToPlainText(html) {
  if (!html) return '';

  const { document } = parseHTML(html);
  const doc = document;

  // Remove unwanted elements
  const scripts = doc.querySelectorAll('script, style, noscript, nav, header, footer');
  scripts.forEach(el => el.remove());

  let text = processNode(doc.body || doc.documentElement);

  // Clean up whitespace
  text = text
    .replace(/\n\s*\n/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/^\s+|\s+$/gm, '') // Trim each line
    .trim();

  return text;
}

function processNode(node) {
  let text = '';

  for (let child of node.childNodes) {
    if (child.nodeType === 3) { // Text node
      text += child.textContent;
    } else if (child.nodeType === 1) { // Element node
      const tagName = child.tagName.toLowerCase();

      // Add spacing for block elements
      if (['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'td', 'th', 'blockquote', 'pre', 'br'].includes(tagName)) {
        text += '\n';
      }

      text += processNode(child);

      if (['p', 'div', 'section', 'article', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr', 'td', 'th', 'blockquote', 'pre'].includes(tagName)) {
        text += '\n';
      }

      // Add separator for table cells
      if (tagName === 'td' || tagName === 'th') {
        text += ' | ';
      }
    }
  }

  return text;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
