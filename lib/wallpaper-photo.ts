export type SavedPhoto = { blob: Blob; name: string };
export type LoadedPhoto = SavedPhoto & { image: HTMLImageElement; url: string };
const MAX_BYTES = 20 * 1024 * 1024;

export function isRasterPhoto(bytes: Uint8Array) {
  const signature = (offset: number, values: number[]) => values.every((value, index) => bytes[offset + index] === value);
  return signature(0, [0xff, 0xd8, 0xff]) || signature(0, [137, 80, 78, 71, 13, 10, 26, 10]) ||
    (signature(0, [82, 73, 70, 70]) && signature(8, [87, 69, 66, 80]));
}

export async function loadPhoto(saved: SavedPhoto): Promise<LoadedPhoto> {
  if (saved.blob.size > MAX_BYTES) throw new Error('底圖請小於 20 MB。');
  if (!isRasterPhoto(new Uint8Array(await saved.blob.slice(0, 12).arrayBuffer()))) throw new Error('請選擇 JPG、PNG 或 WebP 原始照片。');
  const url = URL.createObjectURL(saved.blob);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16_000_000 || Math.max(image.naturalWidth, image.naturalHeight) > 8192) throw new Error('底圖請使用 1,600 萬像素以下、邊長不超過 8,192 px 的圖片。');
    return { ...saved, image, url };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error instanceof Error && error.name !== 'EncodingError' ? error : new Error('無法讀取照片，請改用 JPG、PNG 或 WebP。');
  }
}

function openPhotoStorage(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('glance.photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('照片儲存空間暫時無法使用。'));
  });
}

export async function readSavedPhoto(): Promise<SavedPhoto | null> {
  const db = await openPhotoStorage();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('photos', 'readonly');
    const request = transaction.objectStore('photos').get('background');
    transaction.oncomplete = () => { db.close(); resolve(request.result ?? null); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function savePhoto(photo: SavedPhoto | null) {
  const db = await openPhotoStorage();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction('photos', 'readwrite');
    const store = transaction.objectStore('photos');
    if (photo) store.put({ blob: photo.blob, name: photo.name }, 'background');
    else store.delete('background');
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}
