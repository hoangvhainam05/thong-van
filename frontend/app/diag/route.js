export const dynamic = 'force-dynamic';

export async function GET() {
  const backendUrl = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || null;
  let backendHealth = null;
  let backendError = null;

  if (backendUrl) {
    try {
      const normalizedBase = backendUrl.endsWith('/') ? backendUrl : `${backendUrl}/`;
      const url = new URL('api/health', normalizedBase).toString();
      const res = await fetch(url, { cache: 'no-store' });
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch {}

      backendHealth = {
        targetUrl: url,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        data: json || text,
      };
    } catch (err) {
      backendError = {
        name: err.name,
        message: err.message,
        stack: err.stack,
      };
    }
  }

  return Response.json({
    timestamp: new Date().toISOString(),
    frontendEnv: {
      hasBackendUrl: Boolean(process.env.BACKEND_URL),
      backendUrl: process.env.BACKEND_URL || null,
      hasPublicApiUrl: Boolean(process.env.NEXT_PUBLIC_API_URL),
      publicApiUrl: process.env.NEXT_PUBLIC_API_URL || null,
    },
    backendHealth,
    backendError,
  });
}
