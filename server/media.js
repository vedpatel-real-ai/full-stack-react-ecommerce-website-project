import sharp from "sharp";
export async function imageBytes(input) {
  if (
    !Buffer.isBuffer(input) ||
    input.length > 2 * 1024 * 1024 ||
    input.length < 16
  )
    throw Error("Invalid upload");
  const image = sharp(input, { limitInputPixels: 10000000, failOn: "warning" });
  const info = await image.metadata();
  if (!["png", "jpeg", "webp"].includes(info.format) || info.pages > 1)
    throw Error("Static raster required");
  const bytes = await image
    .rotate()
    .resize({
      width: 800,
      height: 800,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 78 })
    .toBuffer();
  if (bytes.length > 262144) throw Error("Image too large");
  return bytes;
}
