import { networkInterfaces } from 'node:os';

export interface NetworkAddress {
  readonly address: string;
  readonly family: string | number;
  readonly internal: boolean;
}

export type NetworkInterfaceSnapshot = Readonly<
  Record<string, readonly NetworkAddress[] | undefined>
>;

export type Ipv4RejectionReason =
  | 'NOT_IPV4'
  | 'INVALID_IPV4'
  | 'LOOPBACK'
  | 'VIRTUAL_INTERFACE'
  | 'UNSPECIFIED'
  | 'LINK_LOCAL'
  | 'NOT_PRIVATE';

export interface LocalIpv4Address {
  readonly interfaceName: string;
  readonly address: string;
}

export interface RejectedIpv4Address {
  readonly interfaceName: string;
  readonly address: string;
  readonly reason: Ipv4RejectionReason;
}

export interface LocalIpv4DetectionResult {
  readonly selected?: LocalIpv4Address;
  readonly candidates: readonly LocalIpv4Address[];
  readonly rejected: readonly RejectedIpv4Address[];
}

const VIRTUAL_INTERFACE_NAME =
  /(?:virtual|vmware|vbox|hyper-v|hyperv|vethernet|wsl|docker|loopback|npcap|tailscale|zerotier|hamachi)/i;

/**
 * Detects a LAN-capable private IPv4 address from the operating system's
 * interfaces. The result is intentionally conservative: virtual, loopback,
 * link-local and non-private addresses are reported but never selected.
 */
export function detectLocalIpv4(
  interfaces: NetworkInterfaceSnapshot = networkInterfaces(),
): LocalIpv4DetectionResult {
  const candidates: LocalIpv4Address[] = [];
  const rejected: RejectedIpv4Address[] = [];

  for (const [interfaceName, addresses] of Object.entries(interfaces)) {
    for (const address of addresses ?? []) {
      const reason = getIpv4RejectionReason(interfaceName, address);

      if (reason !== undefined) {
        rejected.push({ interfaceName, address: address.address, reason });
        continue;
      }

      candidates.push({ interfaceName, address: address.address });
    }
  }

  const sortedCandidates = candidates.toSorted(compareLocalIpv4Addresses);

  return {
    ...(sortedCandidates[0] === undefined ? {} : { selected: sortedCandidates[0] }),
    candidates: sortedCandidates,
    rejected,
  };
}

function getIpv4RejectionReason(
  interfaceName: string,
  networkAddress: NetworkAddress,
): Ipv4RejectionReason | undefined {
  if (!isIpv4Family(networkAddress.family)) {
    return 'NOT_IPV4';
  }

  const octets = parseIpv4(networkAddress.address);

  if (octets === undefined) {
    return 'INVALID_IPV4';
  }

  if (networkAddress.internal || octets[0] === 127) {
    return 'LOOPBACK';
  }

  if (VIRTUAL_INTERFACE_NAME.test(interfaceName)) {
    return 'VIRTUAL_INTERFACE';
  }

  if (octets.every((octet) => octet === 0)) {
    return 'UNSPECIFIED';
  }

  if (octets[0] === 169 && octets[1] === 254) {
    return 'LINK_LOCAL';
  }

  if (!isPrivateIpv4(octets)) {
    return 'NOT_PRIVATE';
  }

  return undefined;
}

function isIpv4Family(family: NetworkAddress['family']): boolean {
  return family === 4 || (typeof family === 'string' && family.toUpperCase() === 'IPV4');
}

function parseIpv4(address: string): readonly number[] | undefined {
  const octets = address.split('.');

  if (octets.length !== 4) {
    return undefined;
  }

  const parsedOctets = octets.map((octet) => Number(octet));

  return parsedOctets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? parsedOctets
    : undefined;
}

function isPrivateIpv4(octets: readonly number[]): boolean {
  const [firstOctet, secondOctet] = octets;

  return (
    firstOctet === 10 ||
    (firstOctet === 172 && secondOctet !== undefined && secondOctet >= 16 && secondOctet <= 31) ||
    (firstOctet === 192 && secondOctet === 168)
  );
}

function compareLocalIpv4Addresses(left: LocalIpv4Address, right: LocalIpv4Address): number {
  return (
    left.interfaceName.localeCompare(right.interfaceName) ||
    left.address.localeCompare(right.address)
  );
}
