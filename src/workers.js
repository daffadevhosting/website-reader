import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

// Manual HTML to Markdown converter (no DOM dependency)
function htmlToMarkdown(html) {
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

    // Block containers
    .replace(/<div[^>]*>(.*?)<\/div>/gis, '\n$1\n')
    .replace(/<section[^>]*>(.*?)<\/section>/gis, '\n$1\n')
    .replace(/<article[^>]*>(.*?)<\/article>/gis, '\n$1\n')
    .replace(/<main[^>]*>(.*?)<\/main>/gis, '\n$1\n')
    .replace(/<footer[^>]*>(.*?)<\/footer>/gis, '\n$1\n')

    // Line breaks
    .replace(/<br[^>]*>/gi, '\n')

    // Strip remaining tags
    .replace(/<[^>]+>/g, '')

    // Normalize whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n +/g, '\n')
    .trim();

  // RETURN with DIVIDER
  return `====

${markdown}

====`;
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
const mode = url.searchParams.get("mode") || "readability";

let title = "";
let htmlContent = "";

// MODE 1: readability (default)
if (mode === "readability") {
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

// MODE 2: full-page like r.jina
} else if (mode === "full") {
  // use cleaned body directly
  title = document.title || "Untitled";
  htmlContent = document.body.innerHTML;
}

const markdown = htmlToMarkdown(htmlContent);

// final output
const output = `
Title: ${title}
Source: ${target}

Markdown Content:
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