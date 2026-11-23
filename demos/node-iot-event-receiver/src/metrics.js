import http from 'node:http';
export const metrics = { received:0, published:0, invalid:0, stored:0, retried:0, dead:0 };
export function startMetrics(port = Number(process.env.METRICS_PORT || 9091)) {
  const server = http.createServer((req,res) => {
    if (req.url === '/healthz') { res.writeHead(200); res.end('ok\n'); return; }
    if (req.url !== '/metrics') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'content-type':'text/plain; version=0.0.4'});
    res.end(Object.entries(metrics).map(([k,v]) => `# TYPE iot_${k}_total counter\niot_${k}_total ${v}\n`).join(''));
  });
  server.listen(port,'127.0.0.1');
  return server;
}
