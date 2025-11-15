import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// Manual HTML to Markdown converter (no DOM dependency)
function htmlToMarkdown(html) {
  if (!html) return '';
  
  // Simple conversion rules
  return html
    // Headers
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n')
    .replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n')
    .replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n')
    
    // Bold and Italic
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    
    // Links
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, '[$2]($1)')
    
    // Images
    .replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*>/gi, '![$2]($1)')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*src="([^"]*)"[^>]*>/gi, '![$1]($2)')
    
    // Code blocks
    .replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```')
    .replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`')
    
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<ul[^>]*>(.*?)<\/ul>/gis, '$1\n')
    .replace(/<ol[^>]*>(.*?)<\/ol>/gis, '$1\n')
    
    // Paragraphs and line breaks
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<div[^>]*>(.*?)<\/div>/gis, '$1\n')
    
    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')
    
    // Clean up whitespace
    .replace(/\n\s+\n/g, '\n\n')
    .replace(/^\s+|\s+$/gm, '')
    .trim();
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
      
      let target = url.pathname.slice(1);
      if (!target || target === '') {
        target = url.searchParams.get("url");
      }
      
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
            }
          }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // URL normalization
      if (!target.startsWith('http')) {
        target = 'https://' + target;
      }

      try {
        new URL(target);
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid URL format" }),
          { status: 400, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Fetch HTML
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

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

      // Extract readable article
      const reader = new Readability(document);
      const article = reader.parse();

      if (!article) {
        return new Response(
          JSON.stringify({ error: "Could not extract content from page" }),
          { status: 500, headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Convert to Markdown
      const markdown = htmlToMarkdown(article.content);

      // Format output
      const format = url.searchParams.get('format') || 'text';

      if (format === 'json') {
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              url: target,
              title: article.title,
              byline: article.byline,
              excerpt: article.excerpt,
              content: markdown,
              length: article.length,
              siteName: article.siteName
            }
          }, null, 2),
          { headers: { ...corsHeaders, "content-type": "application/json" } }
        );
      }

      // Plain text/markdown output
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