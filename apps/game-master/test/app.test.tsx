import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../src/App.js';

describe('game-master app shell', () => {
  it('shows the lobby overview and player controls', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Game Master' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Das Geheimnis von Ravenhill' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lobby öffnen' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lobby schließen' })).toBeTruthy();
    expect(screen.getByText('Anna')).toBeTruthy();
  });
});
