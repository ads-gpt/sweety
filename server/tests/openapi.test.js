import { describe, it, expect } from 'vitest';
import { app, api } from './helpers.js';
import { openapi } from '../src/openapi.js';

/** Every (METHOD path) pair Express has registered, with paths normalised to the spec's form. */
function registeredRoutes() {
  const out = new Set();
  const norm = (p) => p.replace(/^\/api/, '').replace(/:([A-Za-z]+)/g, '{$1}') || '/';
  const walk = (stack) => {
    for (const layer of stack) {
      if (layer.route) {
        for (const m of Object.keys(layer.route.methods)) out.add(`${m.toUpperCase()} ${norm(layer.route.path)}`);
      } else if (layer.handle?.stack) walk(layer.handle.stack);
    }
  };
  walk((app.router ?? app._router).stack);
  out.delete('GET /openapi.json'); // the docs route itself
  return out;
}

const documentedRoutes = () => {
  const out = new Set();
  for (const [path, item] of Object.entries(openapi.paths)) {
    for (const method of Object.keys(item)) out.add(`${method.toUpperCase()} ${path}`);
  }
  return out;
};

describe('OpenAPI spec', () => {
  it('documents every route the server registers, and nothing that does not exist', () => {
    const real = registeredRoutes();
    const docs = documentedRoutes();
    expect([...real].filter((r) => !docs.has(r)).sort(), 'routes missing from the spec').toEqual([]);
    expect([...docs].filter((r) => !real.has(r)).sort(), 'spec entries with no route').toEqual([]);
    expect(real.size).toBeGreaterThan(30);
  });

  it('is structurally sound: every $ref resolves, path params are declared, operations have responses', () => {
    const json = JSON.stringify(openapi);
    for (const [, name] of json.matchAll(/#\/components\/schemas\/([A-Za-z]+)/g)) {
      expect(openapi.components.schemas[name], `schema ${name}`).toBeDefined();
    }
    for (const [path, item] of Object.entries(openapi.paths)) {
      const declared = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
      for (const [method, operation] of Object.entries(item)) {
        const label = `${method.toUpperCase()} ${path}`;
        expect(operation.tags?.length, `${label} tags`).toBeGreaterThan(0);
        expect(Object.keys(operation.responses ?? {}).length, `${label} responses`).toBeGreaterThan(0);
        for (const name of declared) {
          expect(operation.parameters?.some((p) => p.in === 'path' && p.name === name), `${label} path param ${name}`).toBe(true);
        }
      }
    }
  });

  it('is served as JSON and as a Swagger UI page', async () => {
    const spec = await api().get('/api/docs/openapi.json');
    expect(spec.status).toBe(200);
    expect(spec.body.openapi).toMatch(/^3\./);
    expect(spec.body.info.title).toBe('Sweety API');

    const ui = await api().get('/api/docs/');
    expect(ui.status).toBe(200);
    expect(ui.headers['content-type']).toMatch(/html/);
    expect(ui.text).toMatch(/swagger/i);
  });
});
