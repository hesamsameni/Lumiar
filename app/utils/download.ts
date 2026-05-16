export async function downloadImageToDevice(imageUrl: string, filename: string) {
  try {
    // Try to fetch the image and use Web Share API (best for mobile/iOS to save to Photos)
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], filename, { type: blob.type });

    // Check if the device is mobile (iOS or Android)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: filename,
      });
      return;
    }
  } catch (err) {
    console.error("Web Share API failed, falling back to download link", err);
  }

  // Fallback to standard download link (best for desktop)
  const a = document.createElement("a");
  a.href = imageUrl;
  a.download = filename;
  a.target = "_blank";
  a.click();
}
