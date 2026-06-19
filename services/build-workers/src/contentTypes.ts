export function contentTypeFor(fileName: string): string {
  if (fileName.endsWith(".msi")) return "application/x-msi";
  if (fileName.endsWith(".exe")) return "application/vnd.microsoft.portable-executable";
  if (fileName.endsWith(".dmg")) return "application/x-apple-diskimage";
  if (fileName.endsWith(".AppImage")) return "application/vnd.appimage";
  if (fileName.endsWith(".deb")) return "application/vnd.debian.binary-package";
  if (fileName.endsWith(".rpm")) return "application/x-rpm";
  if (fileName.endsWith(".tar.gz")) return "application/gzip";
  return "application/octet-stream";
}
