import amqp from 'amqplib';
import mysql from 'mysql2/promise';
import { createClient } from 'redis';
const connection = await amqp.connect(process.env.RABBITMQ_URL || 'amqp://127.0.0.1');
const channel = await connection.createChannel();
const db = await mysql.createPool({ uri: process.env.MYSQL_URL || 'mysql://iot:iot@127.0.0.1:3306/iot', connectionLimit: 5 });
const cache = createClient({ url: process.env.REDIS_URL || 'redis://127.0.0.1:6379' });
await cache.connect();
await channel.assertExchange('iot.dead','fanout',{durable:true});
await channel.assertQueue('iot.dead.messages',{durable:true});
await channel.bindQueue('iot.dead.messages','iot.dead','');
await channel.assertQueue('iot.telemetry',{durable:true,arguments:{'x-dead-letter-exchange':'iot.dead'}});
channel.prefetch(10);
await channel.consume('iot.telemetry',async msg=>{
  if (!msg) return;
  try {
    const event=JSON.parse(msg.content.toString());
    if (!event.deviceId || !event.eventId || !event.hash) throw new Error('invalid event');
    await db.execute('INSERT INTO telemetry (event_hash,device_id,event_id,temperature,alarm,received_at) VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE event_hash=event_hash', [event.hash,event.deviceId,event.eventId,event.temperature,event.alarm,event.receivedAt]);
    try { await cache.set(`iot:last:${event.deviceId}`,JSON.stringify(event),{EX:3600}); } catch(err) { console.error('cache error:',err.message); }
    channel.ack(msg);
  } catch(err) {
    console.error('worker error:',err.message);
    channel.nack(msg,false,false);
  }
},{noAck:false});
console.log('worker consuming iot.telemetry');
async function shutdown(){ await channel.close();await connection.close();await db.end();await cache.quit(); }
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>shutdown().then(()=>process.exit(0)).catch(()=>process.exit(1)));
