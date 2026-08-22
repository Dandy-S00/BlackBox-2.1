export interface ApkIntegrityMetadata {
  assetName: string;
  algorithm: "SHA-256";
  sha256: string | null;
  signingCertificateSha256: string | null;
  verifiedDownloadUrl: string | null;
}

const SHA256_PATTERN = /^[a-fA-F0-9]{64}$/;

export function hasPublishedChecksum(integrity: ApkIntegrityMetadata): integrity is ApkIntegrityMetadata & { sha256: string } {
  return Boolean(integrity.sha256 && SHA256_PATTERN.test(integrity.sha256));
}

export function formatChecksum(checksum: string): string {
  return checksum.match(/.{1,4}/g)?.join(" ") ?? checksum;
}

export function checksumCommand(assetName: string): string {
  return `sha256sum ${assetName}`;
}

export function hasVerifiedApkDownload(integrity: ApkIntegrityMetadata): integrity is ApkIntegrityMetadata & { sha256: string; verifiedDownloadUrl: string } {
  if (!hasPublishedChecksum(integrity) || !integrity.verifiedDownloadUrl) return false;
  try {
    const url = new URL(integrity.verifiedDownloadUrl);
    return url.protocol === "https:" && /\.apk(?:$|[?#])/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

/** The QR service receives only a public, verified HTTPS APK URL, never secrets or local data. */
export function verifiedApkQrUrl(downloadUrl: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?format=png&size=256x256&data=${encodeURIComponent(downloadUrl)}`;
}
