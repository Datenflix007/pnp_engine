import { describe, expect, it } from 'vitest';

import { detectLocalIpv4 } from '../src/network.js';

describe('local IPv4 detection', () => {
  it('selects a private LAN address and explains rejected interfaces', () => {
    const result = detectLocalIpv4({
      Loopback: [
        { address: '127.0.0.1', family: 'IPv4', internal: true },
        { address: '::1', family: 'IPv6', internal: true },
      ],
      'vEthernet (WSL)': [{ address: '172.28.64.1', family: 'IPv4', internal: false }],
      Ethernet: [{ address: '169.254.15.22', family: 'IPv4', internal: false }],
      WiFi: [{ address: '192.168.178.42', family: 'IPv4', internal: false }],
    });

    expect(result.selected).toEqual({
      interfaceName: 'WiFi',
      address: '192.168.178.42',
    });
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { interfaceName: 'Loopback', address: '127.0.0.1', reason: 'LOOPBACK' },
        { interfaceName: 'Loopback', address: '::1', reason: 'NOT_IPV4' },
        {
          interfaceName: 'vEthernet (WSL)',
          address: '172.28.64.1',
          reason: 'VIRTUAL_INTERFACE',
        },
        { interfaceName: 'Ethernet', address: '169.254.15.22', reason: 'LINK_LOCAL' },
      ]),
    );
  });

  it('does not select public, malformed or virtual-only addresses', () => {
    const result = detectLocalIpv4({
      Ethernet: [
        { address: '203.0.113.7', family: 'IPv4', internal: false },
        { address: 'not-an-ip', family: 'IPv4', internal: false },
      ],
      DockerNAT: [{ address: '172.17.0.1', family: 4, internal: false }],
    });

    expect(result.selected).toBeUndefined();
    expect(result.candidates).toEqual([]);
    expect(result.rejected).toEqual(
      expect.arrayContaining([
        { interfaceName: 'Ethernet', address: '203.0.113.7', reason: 'NOT_PRIVATE' },
        { interfaceName: 'Ethernet', address: 'not-an-ip', reason: 'INVALID_IPV4' },
        { interfaceName: 'DockerNAT', address: '172.17.0.1', reason: 'VIRTUAL_INTERFACE' },
      ]),
    );
  });

  it('orders multiple usable candidates deterministically', () => {
    const result = detectLocalIpv4({
      WiFi: [{ address: '192.168.178.42', family: 'IPv4', internal: false }],
      Ethernet: [{ address: '10.0.0.5', family: 'IPv4', internal: false }],
    });

    expect(result.candidates).toEqual([
      { interfaceName: 'Ethernet', address: '10.0.0.5' },
      { interfaceName: 'WiFi', address: '192.168.178.42' },
    ]);
    expect(result.selected).toEqual({ interfaceName: 'Ethernet', address: '10.0.0.5' });
  });
});
