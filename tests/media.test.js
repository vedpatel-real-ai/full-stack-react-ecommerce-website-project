import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { imageBytes } from "../server/media.js";
test("catalog images decode, resize and strip metadata before persistence", async () => {
  const source = await sharp({
    create: { width: 1200, height: 150, channels: 3, background: "#224466" },
  })
    .png()
    .withMetadata()
    .toBuffer();
  const info = await sharp(await imageBytes(source)).metadata();
  assert.equal(info.format, "webp");
  assert.equal(info.width, 800);
  assert.equal(info.exif, undefined);
  for (const input of [
    Buffer.alloc(2097153),
    Buffer.from("pretend this is an image"),
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>',
    ),
  ])
    await assert.rejects(imageBytes(input));
});
