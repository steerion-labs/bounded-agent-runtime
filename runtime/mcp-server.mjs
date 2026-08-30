import readline from 'node:readline';
import { doctorReport } from './doctor.mjs';
import { publicStatus, publicEvidence } from './dashboard.mjs';

export const MCP_PROTOCOL_VERSION = '2026-07-28';
export const MCP_LEGACY_VERSION = '2025-11-25';
const PROTOCOL_META = 'io.modelcontextprotocol/protocolVersion';

const tools = [
  { name: 'bounded_status', description: 'Read sanitized controller-derived runtime status. Never mutates runtime state.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'bounded_evidence', description: 'Read sanitized evidence metadata. Never exposes approval signatures or controller secrets.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'bounded_doctor', description: 'Inspect prerequisites, runtime mode, and installed agent adapters.', inputSchema: { type: 'object', properties: {}, additionalProperties: false } }
];

function modernRequest(request) {
  return request?.method === 'server/discover' || request?.params?._meta?.[PROTOCOL_META] === MCP_PROTOCOL_VERSION;
}
function stamp(value, modern) { return modern ? { resultType: 'complete', ...value } : value; }
function cached(value, modern, ttlMs = 0) { return modern ? stamp({ ...value, ttlMs, cacheScope: 'private' }, true) : value; }
function result(id, value) { return { jsonrpc: '2.0', id, result: value }; }
function error(id, code, message) { return { jsonrpc: '2.0', id, error: { code, message } }; }
function toolResult(value, modern) {
  return stamp({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value, isError: false }, modern);
}
export function handleMcpRequest(request) {
  const { id = null, method, params = {} } = request || {};
  const modern = modernRequest(request);
  if (method === 'server/discover') return result(id, cached({
    protocolVersions: [MCP_PROTOCOL_VERSION, MCP_LEGACY_VERSION],
    serverInfo: { name: 'bounded-agent-runtime', version: '0.3.0' },
    capabilities: { tools: {} }
  }, true, 3000));
  if (method === 'initialize') return result(id, {
    protocolVersion: MCP_LEGACY_VERSION,
    serverInfo: { name: 'bounded-agent-runtime', version: '0.3.0' },
    capabilities: { tools: {} }
  });
  if (method === 'notifications/initialized') return null;
  if (method === 'tools/list') return result(id, cached({ tools }, modern, 3000));
  if (method === 'tools/call') {
    const name = params.name;
    if (name === 'bounded_status') return result(id, toolResult(publicStatus(), modern));
    if (name === 'bounded_evidence') return result(id, toolResult(publicEvidence(), modern));
    if (name === 'bounded_doctor') return result(id, toolResult(doctorReport(), modern));
    return error(id, -32602, `UNKNOWN_TOOL:${name}`);
  }
  return error(id, -32601, `METHOD_NOT_FOUND:${method}`);
}
export function startStdioMcp() {
  const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', line => {
    if (!line.trim()) return;
    let request;
    try { request = JSON.parse(line); }
    catch { process.stdout.write(JSON.stringify(error(null, -32700, 'PARSE_ERROR')) + '\n'); return; }
    try {
      const response = handleMcpRequest(request);
      if (response) process.stdout.write(JSON.stringify(response) + '\n');
    } catch (cause) {
      process.stdout.write(JSON.stringify(error(request?.id ?? null, -32603, cause instanceof Error ? cause.message : String(cause))) + '\n');
    }
  });
}

if (process.argv[1] && process.argv[1].replaceAll('\\','/').endsWith('/runtime/mcp-server.mjs')) startStdioMcp();
