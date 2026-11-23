import net from 'node:net';
import amqp from 'amqplib';
import { parsePacket, ack } from './protocol.js';
const port = Number(process.env.TCP_PORT || 7070);
const url = process.env.RABBITMQ_URL || 'amqp://127.0.0.1';
const exchange = 'iot.events';
const connection = await amqp.connect(url);
const channel = await connection.createConfirmChannel();
await channel.assertExchange(exchange, 'direct', { durable: true });
await channel.assertQueue('iot.telemetry', { durable: true, arguments: { 'x-dead-letter-exchange': 'iot.dead' } });
await channel.bindQueue('iot.telemetry', exchange, 'telemetry');
const server = net.createServer(socket => {
  socket.setEncoding('utf8'); socket.setTimeout(15000);
  let buffer = '';
  let sequence = Promise.resolve();
  socket.on('data', chunk => {
    buffer += chunk;
    if (buffer.length > 8192) { socket.destroy(); return; }
    while (buffer.includes('\n')) {
      const index = buffer.indexOf('\n'); const line = buffer.slice(0,index); buffer = buffer.slice(index+1);
      sequence = sequence.then(async () => {
        let event;
        try { event = parsePacket(line); } catch { socket.write('NACK,INVALID\n'); return; }
        try {
          await new Promise((resolve,reject) => channel.publish(exchange, 'telemetry', Buffer.from(JSON.stringify(event)), { persistent: true, contentType: 'application/json', messageId: event.hash }, err => err ? reject(err) : resolve()));
          if (!socket.destroyed) socket.write(ack(event.eventId));
        } catch (err) { console.error('publish failed:',err.message); if (!socket.destroyed) socket.write('NACK,RETRY\n'); }
      }).catch(err => console.error('connection processing error',err));
    }
  });
  socket.on('timeout',()=>socket.end());
  socket.on('error',err=>console.error('socket error:',err.message));
});
server.listen(port,'127.0.0.1',()=>console.log(`TCP receiver listening on 127.0.0.1:${port}`));
async function shutdown() { server.close(); await channel.close(); await connection.close(); }
for (const signal of ['SIGINT','SIGTERM']) process.once(signal,()=>shutdown().then(()=>process.exit(0)).catch(()=>process.exit(1)));
