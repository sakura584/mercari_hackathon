import { describe, expect, it } from "vitest";
import { uploadRoomImage } from "./storage";

const ONE_PX_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

describe("uploadRoomImage", () => {
  it("uploads a base64 image and returns a public URL", async () => {
    const url = await uploadRoomImage("collection_test", ONE_PX_PNG_BASE64, "image/png");
    expect(url).toMatch(/^https?:\/\//);
  });

  it("stores different uploads under different paths", async () => {
    const first = await uploadRoomImage("collection_test", ONE_PX_PNG_BASE64, "image/png");
    const second = await uploadRoomImage("collection_test", ONE_PX_PNG_BASE64, "image/png");
    expect(first).not.toBe(second);
  });
});
