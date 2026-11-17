'use strict';

function adaptNetlifyHandler(handler) {
  return async function vercelHandler(req, res) {
    try {
      let bodyStr = null;
      if (req.body !== undefined && req.body !== null) {
        bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      } else if (req.method !== 'GET' && req.method !== 'HEAD') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        if (chunks.length) bodyStr = Buffer.concat(chunks).toString('utf8');
      }

      const event = {
        httpMethod: req.method,
        headers: req.headers || {},
        queryStringParameters: req.query || {},
        body: bodyStr
      };

      const result = await handler(event);
      const headers = result?.headers || {};
      Object.entries(headers).forEach(([k, v]) => {
        if (v !== undefined) res.setHeader(k, v);
      });

      res.status(result?.statusCode || 200).send(result?.body || '');
    } catch (err) {
      res.status(500).json({
        error: 'VERCEL_ADAPTER_ERROR',
        message: err.message || 'Sunucu hatası'
      });
    }
  };
}

module.exports = { adaptNetlifyHandler };
