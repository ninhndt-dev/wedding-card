package com.weddingcard.api.media.service;

import com.weddingcard.api.http.ApiError;
import com.weddingcard.api.http.Sql;
import java.io.*;
import java.nio.file.Files;
import java.util.*;
import javax.imageio.ImageIO;
import net.coobird.thumbnailator.Thumbnails;
import org.springframework.stereotype.Service;

@Service
public class MediaPreviewService {
  public record Preview(byte[] content, String mime) {}
  private final MediaService media;
  private final Sql sql;
  private final Map<String, Preview> cache = new LinkedHashMap<>(32, 0.75f, true);
  private long cachedBytes;
  private static final long CACHE_LIMIT = 32L * 1024 * 1024;

  public MediaPreviewService(MediaService media, Sql sql) { this.media = media; this.sql = sql; }

  // Bound concurrent decoding as well as memory retained by cached display images.
  public synchronized Preview get(String filename, int size) throws IOException {
    if (!Set.of(480, 960, 1440).contains(size))
      throw new ApiError(400, "Kích thước ảnh không hợp lệ.");
    String key = filename + ":" + size;
    Preview cached = cache.get(key);
    if (cached != null) return cached;
    var stored = sql.one("SELECT mime,content FROM media_previews WHERE filename=? AND size=?", filename, size);
    if (stored != null) {
      var result = new Preview((byte[]) stored.get("content"), stored.get("mime").toString());
      remember(key, result);
      return result;
    }
    byte[] original = media.content(filename);
    if (original == null) {
      var file = media.directory().resolve(filename);
      if (!Files.isRegularFile(file)) throw new ApiError(404, "Không tìm thấy file.");
      original = Files.readAllBytes(file);
    }
    String ext = filename.substring(filename.lastIndexOf('.') + 1);
    Preview result = create(original, ext, size);
    if (result.content().length <= 2 * 1024 * 1024)
      sql.update("INSERT IGNORE INTO media_previews(filename,size,mime,content) SELECT filename,?,?,? FROM media_assets WHERE filename=?",
          size, result.mime(), result.content(), filename);
    remember(key, result);
    return result;
  }

  private void remember(String key, Preview result) {
    if (result.content().length <= 2 * 1024 * 1024) {
      cache.put(key, result);
      cachedBytes += result.content().length;
      var it = cache.entrySet().iterator();
      while (cachedBytes > CACHE_LIMIT && it.hasNext()) {
        cachedBytes -= it.next().getValue().content().length;
        it.remove();
      }
    }
  }

  public synchronized void clear() { cache.clear(); cachedBytes = 0; }

  static Preview create(byte[] original, String ext, int size) throws IOException {
    String mime = MediaService.TYPES.get(ext);
    if (!Set.of("jpg", "png").contains(ext) || original.length <= 256 * 1024)
      return new Preview(original, mime);
    try (var input = ImageIO.createImageInputStream(new ByteArrayInputStream(original))) {
      var readers = ImageIO.getImageReaders(input);
      if (!readers.hasNext()) return new Preview(original, mime);
      var reader = readers.next();
      int bound;
      try {
        reader.setInput(input);
        bound = Math.min(size, Math.max(reader.getWidth(0), reader.getHeight(0)));
      } finally { reader.dispose(); }
      var output = new ByteArrayOutputStream();
      Thumbnails.of(new ByteArrayInputStream(original)).size(bound, bound)
          .useExifOrientation(true).outputFormat(ext).outputQuality(0.9).toOutputStream(output);
      byte[] display = output.toByteArray();
      return new Preview(display.length < original.length ? display : original, mime);
    } catch (IOException | RuntimeException unsupported) {
      // Unsupported color profiles must not prevent access to the original photo.
      return new Preview(original, mime);
    }
  }
}
