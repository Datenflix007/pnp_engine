import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { App } from '../src/App.js';

describe('player app join flow', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders the join screen for a valid invite code and highlights invalid input', async () => {
    window.history.pushState({}, '', '/join/RAVEN01');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            session: {
              id: 'ravenhill',
              name: 'Das Geheimnis von Ravenhill',
              lobbyState: 'OPEN',
              playerCount: 2,
            },
          }),
        ),
      ),
    );

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Das Geheimnis von Ravenhill' })).toBeTruthy();

    const input = screen.getByLabelText('Dein Name');
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'A' } });

    const error = screen.getByRole('alert');
    expect(error.textContent).toContain('2 bis 40 sichtbaren Zeichen');
    expect(screen.getByRole('button', { name: 'Beitreten' }).getAttribute('disabled')).not.toBeNull();
  });

  it('shows a clear error state for malformed invitation links', () => {
    window.history.pushState({}, '', '/join/not-valid');

    render(<App />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('ungültig');
  });
});
