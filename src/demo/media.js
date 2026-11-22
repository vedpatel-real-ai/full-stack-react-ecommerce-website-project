export async function localRaster(file) {
  if (
    !file ||
    file.size > 2097152 ||
    !["image/png", "image/jpeg", "image/webp"].includes(file.type)
  )
    throw Error("Use a raster image under 2 MB.");
  const bitmap = await createImageBitmap(file);
  try {
    if (bitmap.width * bitmap.height > 10000000)
      throw Error("Image dimensions are too large.");
    const ratio = Math.min(1, 800 / bitmap.width, 800 / bitmap.height),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
    canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    canvas
      .getContext("2d")
      .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/webp", 0.78);
    if (!url.startsWith("data:image/webp;base64,") || url.length > 349550)
      throw Error("Image too large.");
    return url.split(",")[1];
  } finally {
    bitmap.close();
  }
}
