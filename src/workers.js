import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const ALLOWED_DOMAINS = [
  // 'example.com',
  // 'news.site'
];

const BLOCKED_DOMAINS = [
  'localhost',
  '127.0.0.1',
  '192.168.',
  '10.',
  '172.16.',
  '169.254.',
  '::1'
];

function htmlToMarkdown(html, meta = {}) {
  if (!html) return '';

  const markdown = html
    // Headings
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '\n#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '\n##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '\n###### $1\n\n')

    // Bold / Italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')

    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')

    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '\n![$2]($1)\n')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '\n![$1]($2)\n')

    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '\n- $1')
    .replace(/<\/ul>/gi, '\n\n')
    .replace(/<\/ol>/gi, '\n\n')

    // Code blocks
    .replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '\n```\n$1\n```\n')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')

    // Paragraphs
    .replace(/<p[^>]*>(.*?)<\/p>/gis, '\n$1\n\n')

    // Containers
    .replace(/<div[^>]*>(.*?)<\/div>/gis, '\n$1\n')
    .replace(/<section[^>]*>(.*?)<\/section>/gis, '\n$1\n')
    .replace(/<article[^>]*>(.*?)<\/article>/gis, '\n$1\n')
    .replace(/<main[^>]*>(.*?)<\/main>/gis, '\n$1\n')
    .replace(/<footer[^>]*>(.*?)<\/footer>/gis, '\n$1\n')

    // br
    .replace(/<br[^>]*>/gi, '\n')

    // strip remaining HTML
    .replace(/<[^>]+>/g, '')

    // cleanup
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n +/g, '\n')
    .trim();

  return markdown;
}

// Security: URL validation
function validateUrl(urlString) {
  try {
    const url = new URL(urlString);
    
    // Force HTTPS for security
    if (url.protocol !== 'https:') {
      url.protocol = 'https:';
    }
    
    const hostname = url.hostname;
    
    // Check blocked domains
    for (const blocked of BLOCKED_DOMAINS) {
      if (hostname.includes(blocked)) {
        throw new Error(`Access to ${blocked} is not allowed`);
      }
    }
    
    // Check allowed domains
    if (ALLOWED_DOMAINS.length > 0) {
      const isAllowed = ALLOWED_DOMAINS.some(domain => hostname.includes(domain));
      if (!isAllowed) {
        throw new Error(`Domain ${hostname} is not in allowed list`);
      }
    }
    
    // Additional security checks
    if (url.username || url.password) {
      throw new Error('URLs with credentials are not allowed');
    }
    
    return url.toString();
  } catch (error) {
    throw new Error(`Invalid URL: ${error.message}`);
  }
}

// Cache management
function getCacheKey(url, mode, selector) {
  return `${url}|${mode}|${selector}`;
}

function getFromCache(key) {
  const cached = cache.get(key);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }
  cache.delete(key);
  return null;
}

function setToCache(key, data) {
  cache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  // Clean up old cache entries periodically
  if (cache.size > 100) { // Limit cache size
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
}

// Content extraction by selector
function extractBySelector(document, selector) {
  if (!selector) return document.body.innerHTML;
  
  try {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) {
      throw new Error(`No elements found for selector: ${selector}`);
    }
    
    return Array.from(elements).map(el => el.outerHTML).join('\n');
  } catch (error) {
    throw new Error(`Selector error: ${error.message}`);
  }
}

export default {
  async fetch(request) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    try {
      const url = new URL(request.url);
      const outputFormat = url.searchParams.get("format") || "markdown";
      const mode = url.searchParams.get("mode") || "readability";
      const selector = url.searchParams.get("selector") || "";
      const nocache = url.searchParams.has("nocache");

      let target = url.pathname.slice(1);
      if (!target || target === '') {
        target = url.searchParams.get("url");
      }

      if (!target && request.method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await request.json();
          target = body.url;
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
          const formData = await request.formData();
          target = formData.get('url');
        }
      }

      if (!target) {
        return new Response(
          JSON.stringify({ 
            error: "Missing URL parameter",
            usage: {
              'jina_style': 'GET /https://example.com',
              'query_param': 'GET /?url=https://example.com',
              'post_json': 'POST with {"url": "https://example.com"}',
              'parameters': {
                'format': 'markdown|json|html (default: markdown)',
                'mode': 'readability|full (default: readability)',
                'selector': 'CSS selector for specific content',
                'nocache': 'skip cache'
              }
            }
          }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Security: URL validation and normalization
      try {
        target = validateUrl(target);
      } catch (error) {
        return new Response(
          JSON.stringify({ error: error.message }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Check cache
      const cacheKey = getCacheKey(target, mode, selector);
      let cachedResult = null;
      
      if (!nocache) {
        cachedResult = getFromCache(cacheKey);
      }
      
      if (cachedResult) {
        console.log('Serving from cache:', target);
        
        if (outputFormat === 'json') {
          return new Response(JSON.stringify(cachedResult), {
            headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" }
          });
        } else if (outputFormat === 'html') {
          return new Response(cachedResult.htmlContent, {
            headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" }
          });
        } else {
          const output = `Title: ${cachedResult.title}
Source: ${target}

=======

Markdown Content:
${cachedResult.markdown}

=======`;
          return new Response(output, {
            headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" }
          });
        }
      }

      // Fetch HTML with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const res = await fetch(target, {
        headers: { 
          "user-agent": "Mozilla/5.0 (compatible; rJina-Worker/1.0)",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch URL: ${res.status} ${res.statusText}` }),
          { status: res.status, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      const html = await res.text();

      // Parse HTML dengan base URL
      const htmlWithBase = `<!DOCTYPE html><html><head><base href="${target}"></head><body>${html}</body></html>`;
      const { document } = parseHTML(htmlWithBase);

      // Remove unwanted elements
      const removeSelectors = [
        "nav", "header", "footer", "aside", "script", "style", "noscript",
        "iframe", "embed", ".ad", ".ads", ".advertisement", ".chat-widget",
        ".sidebar", ".navbar", ".menu", ".modal", ".popup"
      ];

      removeSelectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => el.remove());
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Extract content based on mode and selector
      let title = "";
      let htmlContent = "";

      if (selector) {
        // Custom selector mode
        htmlContent = extractBySelector(document, selector);
        title = document.title || "Untitled";
      } else if (mode === "readability") {
        // Readability mode
        const reader = new Readability(document);
        const article = reader.parse();

        if (!article) {
          return new Response(
            JSON.stringify({ error: "Could not extract content" }),
            { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
          );
        }

        title = article.title || "Untitled";
        htmlContent = article.content;
      } else if (mode === "full") {
        // Full page mode
        title = document.title || "Untitled";
        htmlContent = document.body.innerHTML;
      }

      const markdown = htmlToMarkdown(htmlContent, { title, url: target });

      // Prepare result for cache and response
      const result = {
        title,
        url: target,
        htmlContent,
        markdown,
        extractedAt: new Date().toISOString()
      };

      // Cache the result
      if (!nocache) {
        setToCache(cacheKey, result);
      }

      // Return based on requested format
      if (outputFormat === 'json') {
        return new Response(JSON.stringify(result, null, 2), {
          headers: { ...corsHeaders, "content-type": "application/json; charset=utf-8" }
        });
      } else if (outputFormat === 'html') {
        return new Response(htmlContent, {
          headers: { ...corsHeaders, "content-type": "text/html; charset=utf-8" }
        });
      } else {
        const output = `Title: ${title}
Source: ${target}

=======

Markdown Content:
${markdown}

=======`;
        return new Response(output, {
          headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" }
        });
      }

    } catch (err) {
      console.error('Error:', err);

      let status = 500;
      let errorMessage = err.toString();

      if (err.name === 'AbortError') {
        status = 408;
        errorMessage = 'Request timeout';
      }

      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }
  }
}