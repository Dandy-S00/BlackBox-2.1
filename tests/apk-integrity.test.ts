import { describe, expect, it } from "vitest";
import { checksumCommand, formatChecksum, hasPublishedChecksum, hasVerifiedApkDownload, verifiedApkQrUrl } from "../lib/apk-integrity";

describe("APK integrity helpers", () => {
  it("accepts only a complete SHA-256 checksum as published integrity metadata", () => {
    expect(hasPublishedChecksum({ assetName: "BlackBox.apk", algorithm: "SHA-256", sha256: "a".repeat(64), signingCertificateSha256: null, verifiedDownloadUrl: null })).toBe(true);
    expect(hasPublishedChecksum({ assetName: "BlackBox.apk", algorithm: "SHA-256", sha256: "not-a-checksum", signingCertificateSha256: null, verifiedDownloadUrl: null })).toBe(false);
    expect(hasPublishedChecksum({ assetName: "BlackBox.apk", algorithm: "SHA-256", sha256: null, signingCertificateSha256: null, verifiedDownloadUrl: null })).toBe(false);
  });

  it("formats a checksum for readable comparison and emits a portable verification command", () => {
    expect(formatChecksum("a".repeat(64))).toBe("aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa aaaa");
    expect(checksumCommand("BlackBox-1.1.0.apk")).toBe("sha256sum BlackBox-1.1.0.apk");
  });

  it("gates QR download links on both a valid checksum and a public HTTPS APK URL", () => {
    const base = { assetName: "BlackBox-1.1.0.apk", algorithm: "SHA-256" as const, sha256: "a".repeat(64), signingCertificateSha256: null };
    expect(hasVerifiedApkDownload({ ...base, verifiedDownloadUrl: "https://downloads.example.com/BlackBox-1.1.0.apk" })).toBe(true);
    expect(hasVerifiedApkDownload({ ...base, verifiedDownloadUrl: "http://downloads.example.com/BlackBox-1.1.0.apk" })).toBe(false);
    expect(hasVerifiedApkDownload({ ...base, verifiedDownloadUrl: "https://downloads.example.com/readme.txt" })).toBe(false);
    expect(verifiedApkQrUrl("https://downloads.example.com/BlackBox-1.1.0.apk")).toContain(encodeURIComponent("https://downloads.example.com/BlackBox-1.1.0.apk"));
  });
});
