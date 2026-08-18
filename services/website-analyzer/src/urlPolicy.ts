import { lookup } from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTS = new Set(["localhost", "metadata.google.internal"]);
const BLOCKED_CIDRS = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "224.0.0.0/4",
  "240.0.0.0/4"
] as const;

export function parsePublicHttpUrl(input: string): URL {
  const url = new URL(input);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https URLs are supported");
  }
  if (!url.hostname || BLOCKED_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error("URL host is not allowed");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed");
  }
  return url;
}

export async function assertPublicResolvable(url: URL): Promise<void> {
  const records = await lookup(url.hostname, { all: true, verbatim: true });
  if (records.length === 0) {
    throw new Error("URL host could not be resolved");
  }

  for (const record of records) {
    if (!isPublicIp(record.address)) {
      throw new Error("URL resolves to a private or reserved network");
    }
  }
}

export function isPublicIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 0) return false;
  if (family === 6) {
    const normalized = address.toLowerCase();
    return !(
      normalized === "::1" ||
      normalized.startsWith("fc") ||
      normalized.startsWith("fd") ||
      normalized.startsWith("fe80:")
    );
  }

  const numeric = ipv4ToNumber(address);
  return !BLOCKED_CIDRS.some((cidr) => ipv4InCidr(numeric, cidr));
}

function ipv4ToNumber(address: string): number {
  return address
    .split(".")
    .map((part) => Number.parseInt(part, 10))
    .reduce((acc, part) => ((acc << 8) + part) >>> 0, 0);
}

function ipv4InCidr(address: number, cidr: string): boolean {
  const [base = "0.0.0.0", bits = "32"] = cidr.split("/");
  const maskBits = Number.parseInt(bits, 10);
  const mask = maskBits === 0 ? 0 : (0xffffffff << (32 - maskBits)) >>> 0;
  return (address & mask) === (ipv4ToNumber(base) & mask);
}
