import { parsePacket } from './protocol.js';

// Synthetic adapters only. Do not copy private device protocols into public demos.
const adapters = new Map([
  ['csv-v1', line => parsePacket(line)],
  ['json-v1', line => {
    const obj = JSON.parse(line);
    if (obj.version !== 1 || typeof obj.deviceId !== 'string' || typeof obj.eventId !== 'string' ||
        typeof obj.temperature !== 'number' || typeof obj.alarm !== 'boolean') throw new Error('invalid json-v1 packet');
    return parsePacket(`@,${obj.deviceId},${obj.eventId},${obj.temperature},${Number(obj.alarm)},#`);
  }]
]);
export function decode(line, adapter = 'csv-v1') {
  const parse = adapters.get(adapter);
  if (!parse) throw new Error('unsupported protocol');
  return parse(line);
}
export function availableAdapters() { return [...adapters.keys()]; }
