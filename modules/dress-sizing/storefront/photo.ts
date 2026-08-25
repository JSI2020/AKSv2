const LOCAL = /^\/uploads\/dress-sizing\/[a-z0-9-]+\.(png|jpe?g|gif|webp)$/i;
export const isLocalPhoto = (url: string | null | undefined) => Boolean(url && LOCAL.test(url));
export const ghostPhotoUrl = (url: string | null | undefined): string | null => {
  void url;
  return null;
};
export const dressedPhotoUrl = (url: string | null | undefined): string | null => {
  void url;
  return null;
};
