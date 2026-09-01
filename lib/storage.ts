import { randomUUID } from "node:crypto";
import { getAdminStorage } from "./firebase/admin";

export async function uploadRoomImage(
  collectionId: string,
  imageBase64: string,
  mimeType: string
): Promise<string> {
  const extension = mimeType.split("/")[1] ?? "jpg";
  const path = `collections/${collectionId}/room-photos/${randomUUID()}.${extension}`;
  const bucket = getAdminStorage().bucket();
  const file = bucket.file(path);

  const buffer = Buffer.from(imageBase64, "base64");
  await file.save(buffer, { metadata: { contentType: mimeType } });
  await file.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/${path}`;
}
