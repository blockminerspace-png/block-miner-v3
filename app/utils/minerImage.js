const path = require("path");

const MINER_IMAGE_ALLOWED_TYPES = new Map([
  ["image/png", ".png"],
  ["image/x-png", ".png"],
  ["image/jpeg", ".jpg"],
  ["image/jpg", ".jpg"],
  ["image/pjpeg", ".jpg"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["application/octet-stream", null],
  ["", null]
]);

function getMinerImageExtFromName(fileName) {
  const normalizedName = String(fileName || "").trim().toLowerCase();
  if (!normalizedName) return null;
  if (normalizedName.endsWith(".png")) return ".png";
  if (normalizedName.endsWith(".jpg") || normalizedName.endsWith(".jpeg")) return ".jpg";
  if (normalizedName.endsWith(".webp")) return ".webp";
  if (normalizedName.endsWith(".gif")) return ".gif";
  return null;
}

function resolveMinerImageExtension(contentType, originalName) {
  const normalizedType = String(contentType || "").split(";")[0].trim().toLowerCase();
  const direct = MINER_IMAGE_ALLOWED_TYPES.get(normalizedType);
  if (typeof direct === "string" && direct) {
    return direct;
  }

  const inferred = getMinerImageExtFromName(originalName);
  return inferred || null;
}

function sanitizeMinerImageBaseName(fileName) {
  return (
    path
      .basename(String(fileName || "miner-image"))
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 50) || "miner-image"
  );
}

module.exports = {
  resolveMinerImageExtension,
  sanitizeMinerImageBaseName
};
