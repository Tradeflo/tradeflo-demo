export function compressImage(
  file: File,
  callback: (b64: string, mime: string) => void,
): void {
  const reader = new FileReader();
  reader.onload = (e) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const MAX = 1024;
      let w = image.width;
      let h = image.height;
      if (w > h) {
        if (w > MAX) {
          h = Math.round((h * MAX) / w);
          w = MAX;
        }
      } else if (h > MAX) {
        w = Math.round((w * MAX) / h);
        h = MAX;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(image, 0, 0, w, h);
      const compressed = canvas.toDataURL("image/jpeg", 0.75);
      callback(compressed.split(",")[1] ?? "", "image/jpeg");
    };
    image.src = e.target?.result as string;
  };
  reader.readAsDataURL(file);
}
