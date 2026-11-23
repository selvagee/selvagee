#!/usr/bin/env bash
set -Eeuo pipefail
cd "$(dirname "$0")/.."
for cmd in docker node npm; do command -v "$cmd" >/dev/null || { echo "Missing $cmd" >&2; exit 2; }; done
docker compose up -d
npm install
npm test
node src/server.js &
SERVER=$!
node src/worker.js &
WORKER=$!
trap 'kill "$SERVER" "$WORKER" 2>/dev/null || true' EXIT
node --input-type=module <<'JS'
import net from 'node:net';
import mysql from 'mysql2/promise';
const wait = ms => new Promise(r=>setTimeout(r,ms));
let ack = '';
for (let attempt=0;attempt<30;attempt++) {
  try {
    ack = await new Promise((resolve,reject)=>{
      const socket=net.connect(7070,'127.0.0.1');
      socket.setTimeout(2000,()=>socket.destroy(new Error('timeout')));
      socket.on('connect',()=>socket.write('@,demo01,smoke01,25.5,1,#\n'));
      socket.on('data',data=>{resolve(data.toString());socket.end()});
      socket.on('error',reject);
    });
    if (ack.includes('ACK,smoke01')) break;
  } catch {}
  await wait(1000);
}
if (!ack.includes('ACK,smoke01')) throw new Error('no broker-confirmed ACK');
const db = await mysql.createConnection(process.env.MYSQL_URL || 'mysql://iot:iot@127.0.0.1:3306/iot');
let found=false;
for (let i=0;i<30;i++) {
  const [rows]=await db.query("SELECT COUNT(*) AS n FROM telemetry WHERE device_id='demo01' AND event_id='smoke01'");
  if (rows[0].n === 1) {found=true;break}
  await wait(1000);
}
await db.end();
if (!found) throw new Error('event not stored exactly once');
console.log('PASS: confirmed ACK and idempotent MySQL persistence');
JS
