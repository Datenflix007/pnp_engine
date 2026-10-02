import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from '../src/App.js';

describe('presentation app', () => {
  it('shows the lobby screen with the session name and join URL', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Das Geheimnis von Ravenhill' })).toBeTruthy();
    expect(screen.getByText('Public View')).toBeTruthy();
    expect(screen.getByText('Session-Code: RAVEN01')).toBeTruthy();
    expect(screen.getByText('http://192.168.178.42:3000/join/RAVEN01')).toBeTruthy();
  });
});
