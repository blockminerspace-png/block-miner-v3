function startsWithBytes(buffer, bytes) {
  if (!Buffer.isBuffer(buffer) || buffer.length < bytes.length) {
    return false;
  }

  for (let index = 0; index < bytes.length; index += 1) {
    if (buffer[index] !== bytes[index]) {
      return false;
    }
  }

  return true;
}

function detectImageExtensionFromMagic(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) {
    return null;
  }

  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return ".png";
  }

  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return ".jpg";
  }

  const header = buffer.subarray(0, 6).toString("ascii");
  if (header === "GIF87a" || header === "GIF89a") {
    return ".gif";
  }

  const riff = buffer.subarray(0, 4).toString("ascii");
  const webp = buffer.subarray(8, 12).toString("ascii");
  if (riff === "RIFF" && webp === "WEBP") {
    return ".webp";
  }

  return null;
}

module.exports = {
  detectImageExtensionFromMagic
};
