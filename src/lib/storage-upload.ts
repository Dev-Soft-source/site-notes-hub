import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFirebaseStorageClient } from "@/integrations/firebase/client";

export async function uploadVoiceBytes(path: string, blob: Blob): Promise<void> {
  const storage = getFirebaseStorageClient();
  await uploadBytes(ref(storage, path), blob, { contentType: blob.type || "audio/webm" });
}

export async function uploadDrawingBytes(path: string, file: File): Promise<void> {
  const storage = getFirebaseStorageClient();
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
}

export async function getDrawingDownloadURL(storagePath: string): Promise<string> {
  const storage = getFirebaseStorageClient();
  return getDownloadURL(ref(storage, storagePath));
}
