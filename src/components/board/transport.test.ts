import { describe, expect, test } from 'vitest';
import { MODE_HINT, mockTransport } from './transport';

describe('mode-aware transport', () => {
  test('vai fallback stays the honest portfolio line', async () => {
    await expect(mockTransport.send('anything', 'vai')).resolves.toMatch(/VAI is still waking up/);
  });

  test('gai fallback admits no model is wired yet', async () => {
    await expect(mockTransport.send('anything', 'gai')).resolves.toMatch(/not wired up/);
  });

  test('mode hints expand both agent names', () => {
    expect(MODE_HINT.vai).toContain('VladislavAI');
    expect(MODE_HINT.gai).toContain('GlobalAI');
  });
});
