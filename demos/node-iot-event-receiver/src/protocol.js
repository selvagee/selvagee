import { createHash } from 'node:crypto';
const DEVICE = /^[A-Za-z0-9_-]{1,40}$/;
const EVENT = /^[A-Za-z0-9_-]{1,64}$/;
export function parsePacket(input) {
  const line = input.toString('utf8').trim();
  if (line.length > 512 || !line.startsWith('@,') || !line.endsWith(',#')) throw new Error('invalid framing');
  const fields = line.split(',');
  if (fields.length !== 6 || fields[0] !== '@' || fields[5] !== '#') throw new Error('invalid field count');
  const [, deviceId, eventId, temp, alarm] = fields;
  if (!DEVICE.test(deviceId) || !EVENT.test(eventId)) throw new Error('invalid identifier');
  const temperature = Number(temp);
  if (!Number.isFinite(temperature) || temperature < -100 || temperature > 200) throw new Error('invalid temperature');
  if (!['0','1'].includes(alarm)) throw new Error('invalid alarm');
  return { deviceId, eventId, temperature, alarm: alarm === '1', receivedAt: new Date().toISOString(), hash: createHash('sha256').update(`${deviceId}:${eventId}`).digest('hex') };
}
export function ack(eventId) { if (!EVENT.test(eventId)) throw new Error('invalid event id'); return `ACK,${eventId}\n`; }
