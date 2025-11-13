import { Readability } from '@mozilla/readability';
import { parseHTML } from 'linkedom';

export default {
  async fetch(request, env) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const clientIP = request.headers.get('cf-connecting-ip') || 'unknown';
      
      // Rate Limiting (optional)
      if (env.CACHE && !await checkRateLimit(clientIP, env)) {
        return jsonResponse({ 
          error: 'Rate limit exceeded', 
          message: 'Maximum 100 requests per hour' 
        }, 429, corsHeaders);
      }

      // Multiple URL extraction methods
      let targetUrl = url.pathname.slice(1); // Jina-style: /https://...
      
      // Query parameter fallback
      if (!targetUrl || targetUrl === '') {
        targetUrl = url.searchParams.get('url');
      }
      
      // POST body fallback
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

      // URL validation
      if (!targetUrl) {
        return jsonResponse({
          error: 'URL parameter required',
          usage: {
            'Jina-style': 'GET /https://example.com',
            'Query-param': 'GET /?url=https://example.com',
            'POST': 'POST / with JSON { "url": "https://example.com" }'
          }
        }, 400, corsHeaders);
      }

      // URL normalization
      if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
      }

      try {
        new URL(targetUrl);
      } catch {
        return jsonResponse({ error: 'Invalid URL format' }, 400, corsHeaders);
      }

      // Cache check
      const cacheKey = `content:${btoa(targetUrl)}`;
      if (env.CACHE) {
        const cached = await env.CACHE.get(cacheKey, 'json');
        if (cached) {
          cached.data.cached = true;
          return jsonResponse(cached, 200, corsHeaders);
        }
      }

      // Fetch dengan timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );

      const response = await Promise.race([
        fetch(targetUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
          },
          cf: {
            cacheTtl: 300,
            cacheEverything: false,
          }
        }),
        timeoutPromise
      ]);

      if (!response.ok) {
        return jsonResponse({
          error: `Failed to fetch URL: ${response.status}`,
          status: response.status,
          statusText: response.statusText
        }, response.status, corsHeaders);
      }

      const html = await response.text();
      const contentType = response.headers.get('content-type') || '';

      // Check if response is HTML
      if (!contentType.includes('text/html')) {
        return jsonResponse({
          error: 'Content is not HTML',
          contentType,
          supported: ['text/html', 'application/xhtml+xml']
        }, 400, corsHeaders);
      }

      // Parse HTML dengan LinkedOM
      const htmlWithBase = `<!DOCTYPE html><html><head><base href="${targetUrl}"></head><body>${html}</body></html>`;
      const { document } = parseHTML(htmlWithBase);

      // Extract metadata sebelum Readability
      const metadata = extractMetadata(document);
      const images = extractImages(document, targetUrl);

      // Remove unwanted elements
      const removables = document.querySelectorAll('script, style, noscript, nav, header, footer, iframe, .ad, .ads, [class*="advertisement"]');
      removables.forEach(el => el.remove());

      // Parse dengan Readability
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        return jsonResponse({
          error: 'Could not extract content from page',
          suggestion: 'The page might be too complex or require JavaScript'
        }, 400, corsHeaders);
      }

      // Convert HTML to plain text
      const plainText = htmlToPlainText(article.content);

      // Opsi format dari parameter
      const format = url.searchParams.get('format') || 'json';
      const includeHtml = url.searchParams.get('includeHtml') === 'true';
      const maxLength = parseInt(url.searchParams.get('maxLength')) || 0;
      const includeKeywords = url.searchParams.get('keywords') !== 'false';
      const includeSummary = url.searchParams.get('summary') !== 'false';
      const enhanced = url.searchParams.get('enhanced') !== 'false';

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
          // Basic content (Jina-compatible)
          url: targetUrl,
          title: article.title,
          content: finalContent,
          text: finalContent, // Jina alias
          ...(article.author && { author: article.author }),
          ...(article.excerpt && { excerpt: article.excerpt }),
          
          // Enhanced features
          length: finalContent.length,
          textLength: analysis.wordCount,
          readingTime: analysis.readingTime,
          timestamp: new Date().toISOString(),
          cached: false
        },
      };

      // Tambahkan fitur enhanced jika diminta
      if (enhanced) {
        result.data.analysis = analysis;
        result.data.images = images;
        result.data.metadata = metadata;
        
        if (includeKeywords) {
          result.data.keywords = extractKeywords(finalContent);
        }
        
        if (includeSummary) {
          result.data.summary = generateSummary(finalContent);
        }
        
        if (includeHtml) {
          result.data.htmlContent = article.content;
        }
      }

      // Simpan ke cache (jika available)
      if (env.CACHE) {
        await env.CACHE.put(cacheKey, JSON.stringify(result), {
          expirationTtl: 3600 // 1 hour
        });
      }

      // Response berdasarkan format
      const acceptHeader = request.headers.get('accept') || '';
      if (format === 'text' || acceptHeader.includes('text/plain')) {
        return new Response(finalContent, {
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            ...corsHeaders
          }
        });
      }

      return jsonResponse(result, 200, corsHeaders);

    } catch (error) {
      console.error('Error:', error);
      
      if (error.message === 'Request timeout') {
        return jsonResponse({ 
          error: 'Request timeout',
          message: 'The website took too long to respond'
        }, 408, corsHeaders);
      }
      
      return jsonResponse({
        error: 'Server error',
        message: error.message
      }, 500, corsHeaders);
    }
  },
};

// ========== RATE LIMITING ==========
async function checkRateLimit(ip, env) {
  const key = `rate:${ip}`;
  const current = await env.CACHE.get(key);
  const RATE_LIMIT = 100;
  
  if (current && parseInt(current) >= RATE_LIMIT) {
    return false;
  }
  
  await env.CACHE.put(key, (parseInt(current) || 0) + 1, {
    expirationTtl: 3600
  });
  
  return true;
}

// ========== CONTENT ANALYSIS ==========
function analyzeContent(text) {
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  const readingTime = Math.max(1, Math.ceil(words.length / 200));
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0;
  const readabilityScore = Math.max(0, Math.min(100, 100 - (avgWordsPerSentence * 1.5)));
  
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

// ========== KEYWORD EXTRACTION ==========
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
    word = word.replace(/[^a-z0-9]/g, '');
    if (word.length > 3 && !stopWords.has(word)) {
      frequency[word] = (frequency[word] || 0) + 1;
    }
  });
  
  return Object.entries(frequency)
    .sort(([,a], [,b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word, count]) => ({ 
      word, 
      count, 
      frequency: Math.round((count / words.length) * 10000) / 100 
    }));
}

// ========== SUMMARY GENERATION ==========
function generateSummary(text, maxSentences = 3) {
  const sentences = text.split(/[.!?]+/)
    .map(s => s.trim())
    .filter(s => s.length > 30 && s.length < 500);
  
  if (sentences.length === 0) return '';
  
  const importantSentences = sentences.slice(0, Math.min(maxSentences * 2, sentences.length));
  const scoredSentences = importantSentences.map((sentence, index) => ({
    sentence,
    score: (importantSentences.length - index) * 0.5 + Math.min(sentence.length / 100, 1)
  }));
  
  return scoredSentences
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .map(item => item.sentence + '.')
    .join(' ');
}

// ========== IMAGE EXTRACTION ==========
function extractImages(document, baseUrl) {
  try {
    const images = Array.from(document.querySelectorAll('img'))
      .map(img => {
        let src = img.src || '';
        if (src && !src.startsWith('http')) {
          try {
            src = new URL(src, baseUrl).href;
          } catch (e) {
            console.error('Error resolving image URL:', e);
          }
        }
        
        return {
          src: src,
          alt: img.alt || '',
          title: img.title || '',
          width: img.getAttribute('width') || null,
          height: img.getAttribute('height') || null
        };
      })
      .filter(img => img.src && img.src.startsWith('http'));
    
    return images.slice(0, 20);
  } catch (error) {
    return [];
  }
}

// ========== METADATA EXTRACTION ==========
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
    
    // Description fallback
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

// ========== HTML TO PLAIN TEXT ==========
function htmlToPlainText(html) {
  if (!html) return '';

  // Parse HTML dengan LinkedOM
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
    .replace(/^\s+|\s+$/gm, '')
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

// ========== HELPER FUNCTION ==========
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    },
  });
}