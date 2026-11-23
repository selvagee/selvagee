import amqp from 'amqplib';
import mysql from 'mysql2/promise';
import { createClient } from 'redis';
import { assertTopology, retryCount, retryProperties } from './retry.js';
import { metrics, startMetrics } from './metrics.js';
const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://127.0.0.1');
const channel = await connection.createConfirmChannel();
const db = await mysql.createPool({ uri: process.env.MYSQL_URL || 'mysql://iot:iot@127.0.0.1:3306/iot', connectionLimit: 5 });
const cache = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
await cache.connect();
await assertTopology(channel);
const metricsServer = startMetrics();
channel.prefetch(10);
await channel.consume('iot.telemetry',async msg=>{
  if (!msg) return;
  try {
    const event=JSON.parse(msg.content.toString());
    if (!event.deviceId || !event.eventId || !event.hash) throw new Error('invalid event');
    await db.execute('INSERT INTO telemetry (event_hash,device_id,event_id,temperature,alarm,received_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE event_hash=event_hash', [event.hash,event.deviceId,event.eventId,event.temperature,event.alarm,event.receivedAt]);
    try { await cache.set(`iot:last:${event.deviceId}`,JSON.stringify(event),{EX:3600}); } catch(err) { console.error('cache error:',err.message); }
    metrics.stored++;
    channel.ack(msg);
  } catch(err) {
    console.error('worker error:',err.message);
    const attempt = retryCount(msg) + 1;
    try {
      if (attempt <= 3) {
        await new Promise((resolve,reject)=>channel.sendToQueue('iot.retry',msg.content,retryProperties(msg,attempt),(err)=>err?reject(err):resolve()));
        metrics.retried++;
      } else {
        await new Promise((resolve,reject)=>channel.publish('iot.dead','',msg.content,retryProperties(msg,attempt),(err)=>err?reject(err):resolve()));
        metrics.dead++;
      }
      channel.ack(msg);
    } catch (publishError) {
      console.error('retry routing failed:',publishError.message);
      channel.nack(msg,false,true);
    }
  }
},{noAck:false});
console.log('worker consuming iot.telemetry');
async function shutdown(){ metricsServer.close(); await channel.close();await connection.close();await db.end();await cache.quit(); }
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>shutdown().then(()=>process.exit(0)).catch(()=>process.exit(1)));
