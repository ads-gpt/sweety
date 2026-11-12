import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { CSP, SECURITY_HEADERS } from '../security-headers.js';

const nginx = fs.readFileSync(path.join(import.meta.dirname, '..', 'nginx.conf'), 'utf8');
const indexHtml = fs.readFileSync(path.join(import.meta.dirname, '..', 'index.html'), 'utf8');

describe('content security policy', () => {
  it('forbids inline scripts, objects, framing and foreign form targets', () => {
    expect(CSP).toContain("script-src 'self'");
    expect(CSP).not.toMatch(/script-src[^;]*unsafe/);
    expect(CSP).toContain("object-src 'none'");
    expect(CSP).toContain("frame-ancestors 'none'");
    expect(CSP).toContain("form-action 'self'");
    expect(CSP).toContain("base-uri 'self'");
  });

  it('is identical in nginx.conf and security-headers.js (so what we test is what we ship)', () => {
    expect(nginx).toContain(`Content-Security-Policy "${CSP}"`);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(nginx, name).toContain(`add_header ${name} "${value}"`);
    }
  });

  it('index.html has no inline <script> (it would be blocked by the policy)', () => {
    const inline = [...indexHtml.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/g)];
    expect(inline).toEqual([]);
  });
});
