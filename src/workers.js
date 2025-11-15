import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";

export default {
  async fetch(request) {
    // CORS headers
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
      
      // Multiple URL extraction methods
      let target = url.pathname.slice(1); // Jina-style: /https://example.com
      if (!target || target === '') {
        target = url.searchParams.get("url"); // Query param: ?url=
      }
      
      // POST body support
      if (!target && request.method === 'POST') {
        const contentType = request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const body = await request.json();
          target = body.url;
        }
      }

      if (!target) {
        return new Response(
          JSON.stringify({ 
            error: "Missing URL parameter",
            usage: {
              'jina_style': 'GET /https://example.com',
              'query_param': 'GET /?url=https://example.com', 
              'post_json': 'POST / with {"url":"https://example.com"}'
            }
          }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // URL normalization
      if (!target.startsWith('http')) {
        target = 'https://' + target;
      }

      // Validate URL
      try {
        new URL(target);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid URL format" }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Fetch HTML dengan timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(target, {
        headers: { 
          "user-agent": "Mozilla/5.0 (compatible; rJina-Worker/1.0; +https://github.com/your-repo)",
          "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
          "accept-language": "en-US,en;q=0.5"
        },
        signal: controller.signal,
        cf: {
          cacheTtl: 3600, // Cache for 1 hour
          cacheEverything: false,
        }
      });
      clearTimeout(timeout);

      if (!res.ok) {
        return new Response(
          JSON.stringify({ error: `Failed to fetch URL: ${res.status} ${res.statusText}` }),
          { status: res.status, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      const html = await res.text();
      const contentType = res.headers.get('content-type') || '';

      // Check if response is HTML
      if (!contentType.includes('text/html')) {
        return new Response(
          JSON.stringify({ error: "Content is not HTML", contentType }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Parse HTML dengan base URL support
      const htmlWithBase = `<!DOCTYPE html><html><head><base href="${target}"></head><body>${html}</body></html>`;
      const { document } = parseHTML(htmlWithBase);

      // Enhanced element removal
      const removeSelectors = [
        // Structural
        "nav", "header", "footer", "aside", "menu", "dialog",
        // Scripts & Styles
        "script", "style", "noscript", "template",  
        // Embeds
        "iframe", "embed", "object", "canvas",
        // Ads & Trackers
        ".ad", ".ads", ".advertisement", ".ad-container", 
        "[class*='ad-']", "[id*='ad-']", ".tracker", ".analytics",
        // Social & Chat
        ".chat-widget", ".ai-box", ".chatbot", ".social-widget",
        ".share-buttons", ".comments-section",
        // Navigation
        ".sidebar", ".navbar", ".menu", ".navigation", ".breadcrumb",
        // UI Elements
        ".modal", ".popup", ".notification", ".banner", ".cookie-consent",
        // Specific patterns
        "[role='navigation']", "[role='banner']", "[role='complementary']",
        ".hidden", "[aria-hidden='true']"
      ];

      removeSelectors.forEach(sel => {
        try {
          document.querySelectorAll(sel).forEach(el => el.remove());
        } catch (e) {
          // Ignore selector errors
        }
      });

      // Extract readable article
      const reader = new Readability(document, {
        debug: false,
        maxElemsToParse: 100000,
        nbTopCandidates: 5,
        charThreshold: 500
      });
      
      const article = reader.parse();

      if (!article) {
        return new Response(
          JSON.stringify({ error: "Could not extract content from page" }),
          { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Enhanced Turndown configuration
      const td = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        emDelimiter: "*",
        strongDelimiter: "**",
        bulletListMarker: "-",
        linkStyle: "inlined",
        linkReferenceStyle: "full"
      });

      // Custom rules for better markdown conversion
      td.addRule('images', {
        filter: 'img',
        replacement: function (content, node) {
          const alt = node.alt || '';
          const src = node.src || '';
          const title = node.title || '';
          const titlePart = title ? ` "${title}"` : '';
          return src ? `![${alt}](${src}${titlePart})` : '';
        }
      });

      td.addRule('lineBreaks', {
        filter: ['br', 'hr'],
        replacement: function () {
          return '\n\n';
        }
      });

      const markdown = td.turndown(article.content);

      // Format output based on request type
      const acceptHeader = request.headers.get('accept') || '';
      const format = url.searchParams.get('format') || 'text';

      if (format === 'json' || acceptHeader.includes('application/json')) {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              url: target,
              title: article.title,
              byline: article.byline,
              excerpt: article.excerpt,
              content: markdown,
              textContent: article.textContent,
              length: article.length,
              siteName: article.siteName
            }
          }, null, 2),
          { headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Plain text/markdown output (default)
      const output = `
Title: ${article.title || 'No title'}
Source: ${target}
${article.byline ? `Author: ${article.byline}\n` : ''}
${markdown}
      `.trim();

      return new Response(output, {
        headers: { ...corsHeaders, "content-type": "text/plain; charset=utf-8" }
      });

    } catch (err) {
      console.error('Error:', err);
      
      // Handle specific errors
      let status = 500;
      let errorMessage = err.toString();
      
      if (err.name === 'AbortError') {
        status = 408;
        errorMessage = 'Request timeout';
      } else if (err.message?.includes('Failed to fetch')) {
        status = 502;
        errorMessage = 'Failed to fetch target URL';
      }

      return new Response(
        JSON.stringify({ 
          error: errorMessage,
          ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
        }),
        { status, headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }
  }
}