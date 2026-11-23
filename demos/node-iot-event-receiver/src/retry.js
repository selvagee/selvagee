// Shared broker topology. TTL queue routes expired messages back to telemetry.
export async function assertTopology(channel) {
  await channel.assertExchange('iot.events', 'direct', { durable: true });
  await channel.assertExchange('iot.dead', 'fanout', { durable: true });
  await channel.assertQueue('iot.telemetry', { durable: true, arguments: { 'x-dead-letter-exchange': 'iot.dead' } });
  await channel.bindQueue('iot.telemetry', 'iot.events', 'telemetry');
  await channel.assertQueue('iot.retry', { durable: true, arguments: {
    'x-message-ttl': 10000,
    'x-dead-letter-exchange': 'iot.events',
    'x-dead-letter-routing-key': 'telemetry'
  }});
  await channel.assertQueue('iot.dead.messages', { durable: true });
  await channel.bindQueue('iot.dead.messages', 'iot.dead', '');
}
export function retryCount(message) {
  const n = Number(message.properties.headers?.['x-demo-retry'] ?? 0);
  return Number.isSafeInteger(n) && n >= 0 ? n : 0;
}
export function retryProperties(message, attempt) {
  return { persistent: true, contentType: 'application/json',
    messageId: message.properties.messageId,
    headers: { ...message.properties.headers, 'x-demo-retry': attempt } };
}
