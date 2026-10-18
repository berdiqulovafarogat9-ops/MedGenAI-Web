// Fixed-origin API proxy for Cloudflare Pages Direct Upload.
const BACKEND = 'https://medgenai-web-1.onrender.com';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/v1/')) {
      if (url.pathname.startsWith('/api/')) return new Response('Not found', {status:404});
      return env.ASSETS.fetch(request);
    }
    const upstream = new URL(BACKEND);
    upstream.pathname = url.pathname;
    upstream.search = url.search;
    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('cookie');
    headers.delete('origin');
    headers.delete('referer');
    try {
      const response = await fetch(upstream.toString(), {
        method: request.method, headers,
        body: ['GET','HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'manual'
      });
      const resultHeaders = new Headers(response.headers);
      resultHeaders.set('Cache-Control','no-store');
      resultHeaders.set('X-Content-Type-Options','nosniff');
      return new Response(response.body, {status:response.status, statusText:response.statusText, headers:resultHeaders});
    } catch (_) {
      return Response.json({detail:'Backendga ulanish amalga oshmadi. Birozdan keyin qayta urinib ko‘ring.'}, {status:502,headers:{'Cache-Control':'no-store'}});
    }
  }
};
