package com.weddingcard.api.media.service;

import com.weddingcard.api.editor.repository.EditorRepository;
import com.weddingcard.api.http.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class MediaService {
  private final EditorRepository repo;
  private final Path directory;
  private final int maxBytes;

  public Path directory() {
    return directory;
  }

  public static final Map<String, String> TYPES =
      Map.ofEntries(
          Map.entry("png", "image/png"),
          Map.entry("jpg", "image/jpeg"),
          Map.entry("webp", "image/webp"),
          Map.entry("gif", "image/gif"),
          Map.entry("m4a", "audio/mp4"),
          Map.entry("mp4", "video/mp4"),
          Map.entry("mp3", "audio/mpeg"),
          Map.entry("wav", "audio/wav"),
          Map.entry("ogg", "audio/ogg"),
          Map.entry("woff2", "font/woff2"),
          Map.entry("otf", "font/otf"),
          Map.entry("ttf", "font/ttf"));

  public MediaService(EditorRepository repo, @Value("${app.upload-dir}") String path,
      @Value("${app.media-max-bytes:20971520}") int maxBytes)
      throws Exception {
    this.repo = repo;
    this.maxBytes = maxBytes;
    directory = Path.of(path).toAbsolutePath().normalize();
    Files.createDirectories(directory);
  }

  public Map<String, Object> upload(MultipartFile file) throws Exception {
    byte[] b = file.getBytes();
    String ext = type(b);
    if (ext == null) throw new ApiError(400, "Định dạng file không được hỗ trợ.");
    String mime = TYPES.get(ext);
    int limit = mime.startsWith("font/") ? 3 : mime.startsWith("image/") ? 8 : 20;
    if (b.length > limit * 1024 * 1024 || b.length > maxBytes)
      throw new ApiError(413, "File quá lớn.");
    String id = UUID.randomUUID().toString(), filename = id + "." + ext;
    String name =
        Optional.ofNullable(file.getOriginalFilename())
            .orElse("file")
            .replaceAll("[\\p{Cntrl}]", "");
    if (name.length() > 200) name = name.substring(name.length() - 200);
    repo.sql().update(
        "INSERT INTO media_assets(id,filename,original_name,mime,bytes,content) VALUES(?,?,?,?,?,?)",
        id, filename, name, mime, b.length, b);
    return Map.of(
        "asset",
        Map.of(
            "id",
            id,
            "filename",
            filename,
            "original_name",
            name,
            "mime",
            mime,
            "bytes",
            b.length,
            "url",
            "/media/" + filename));
  }

  public byte[] content(String filename) {
    var row = repo.sql().one("SELECT content FROM media_assets WHERE filename=?", filename);
    return row == null ? null : (byte[]) row.get("content");
  }

  @Transactional
  public Map<String, Object> delete(Map<String, Object> b) {
    repo.row(true);
    String mode = Json.str(b, "mode", 20, true);
    if (!List.of("single", "unused").contains(mode)) throw ApiError.bad();
    String refs = repo.references() + repo.json().write(b.getOrDefault("protectedUrls", List.of()));
    var deleted = new ArrayList<String>();
    var skipped = new ArrayList<String>();
    String requested = Json.str(b, "id", 36, mode.equals("single"));
    for (var row : repo.sql().rows("SELECT id,filename FROM media_assets")) {
      String id = row.get("id").toString(), filename = row.get("filename").toString();
      if (mode.equals("single") && !id.equals(requested)) continue;
      if (refs.contains("/media/" + filename)) {
        skipped.add(id);
        continue;
      }
      repo.sql().update("DELETE FROM media_assets WHERE id=?", id);
      deleted.add(id);
      // Unlink only after commit, so rollback cannot remove a referenced file.
      org.springframework.transaction.support.TransactionSynchronizationManager
          .registerSynchronization(
              new org.springframework.transaction.support.TransactionSynchronization() {
                public void afterCommit() {
                  try {
                    Files.deleteIfExists(directory.resolve(filename));
                  } catch (Exception e) {
                    org.slf4j.LoggerFactory.getLogger(MediaService.class)
                        .warn("Could not unlink unused media {}", id);
                  }
                }
              });
    }
    return Map.of("deleted", deleted, "skipped", skipped);
  }

  public static String type(byte[] b) {
    if (b.length < 12) return null;
    String h = new String(b, 0, 12, StandardCharsets.ISO_8859_1);
    if (Arrays.equals(Arrays.copyOf(b, 8), new byte[] {(byte) 137, 80, 78, 71, 13, 10, 26, 10}))
      return "png";
    if ((b[0] & 255) == 255 && (b[1] & 255) == 216 && (b[2] & 255) == 255) return "jpg";
    if (h.startsWith("RIFF") && h.substring(8).equals("WEBP")) return "webp";
    if (h.startsWith("GIF87a") || h.startsWith("GIF89a")) return "gif";
    if (h.substring(4, 8).equals("ftyp")) {
      String brand = h.substring(8);
      if (List.of("M4A ", "M4B ").contains(brand)) return "m4a";
      if (List.of("isom", "iso2", "mp41", "mp42", "avc1", "dash").contains(brand)) return "mp4";
    }
    if (h.startsWith("ID3") || ((b[0] & 255) == 255 && (b[1] & 224) == 224)) return "mp3";
    if (h.startsWith("RIFF") && h.substring(8).equals("WAVE")) return "wav";
    if (h.startsWith("OggS")) return "ogg";
    if (h.startsWith("wOF2")) return "woff2";
    if (h.startsWith("OTTO")) return "otf";
    if (b[0] == 0 && b[1] == 1 && b[2] == 0 && b[3] == 0) return "ttf";
    return null;
  }
}
