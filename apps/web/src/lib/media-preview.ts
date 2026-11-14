export function mediaPreview(source: string, size: 480 | 960 | 1440 = 480) {
  return /^\/media\/[a-f0-9-]+\.(jpg|png)$/.test(source)
    ? source + "?preview=" + size
    : source;
}
