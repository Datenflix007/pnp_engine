/**
 * Kennzeichnet das gemeinsame, framework-unabhängige Domänenpaket.
 *
 * Fachliche Typen bleiben frei von Datenbank-, Server- und UI-Abhängigkeiten.
 */
export const SHARED_PACKAGE_NAME = '@pnp-engine/shared' as const;

export * from './domain.js';
export * from './hello.js';
export * from './projections.js';
