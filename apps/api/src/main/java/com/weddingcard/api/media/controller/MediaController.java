package com.weddingcard.api.media.controller;

import com.weddingcard.api.http.ApiError;
import com.weddingcard.api.media.service.MediaService;
import com.weddingcard.api.media.service.MediaPreviewService;
import java.nio.file.Files;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class MediaController {
  private final MediaService service;
  private final MediaPreviewService previews;

  public MediaController(MediaService service, MediaPreviewService previews) {
    this.service = service;
    this.previews = previews;
  }

  @PostMapping("/api/editor/assets")
  public Object upload(@RequestParam MultipartFile file) throws Exception {
    return ResponseEntity.status(201).body(service.upload(file));
  }

  @DeleteMapping("/api/editor/assets")
  public Object delete(@RequestBody Map<String, Object> b) {
    var result = service.delete(b);
    previews.clear();
    return result;
  }

  @GetMapping("/media/{filename}")
  public Object file(@PathVariable String filename, @RequestParam(required = false) Integer preview) throws Exception {
    if (!filename.matches("[a-f0-9-]{36}\\.[a-z0-9]+"))
      throw new ApiError(404, "Không tìm thấy file.");
    String ext = filename.substring(filename.lastIndexOf('.') + 1),
        mime = MediaService.TYPES.get(ext);
    if (mime == null) throw new ApiError(404, "Không tìm thấy file.");
    if (preview != null) {
      var display = previews.get(filename, preview);
      return ResponseEntity.ok()
          .header("Cache-Control", "public,max-age=31536000,immutable")
          .header("Vercel-CDN-Cache-Control", "public,max-age=31536000,immutable")
          .contentType(MediaType.parseMediaType(display.mime()))
          .body(new ByteArrayResource(display.content()));
    }
    byte[] content = service.content(filename);
    if (content != null)
      return ResponseEntity.ok()
          .header("Cache-Control", "public,max-age=31536000,immutable")
          .header("Vercel-CDN-Cache-Control", "public,max-age=31536000,immutable")
          .contentType(MediaType.parseMediaType(mime))
          .body(new ByteArrayResource(content));
    var path = service.directory().resolve(filename);
    if (!Files.isRegularFile(path)) throw new ApiError(404, "Không tìm thấy file.");
    return ResponseEntity.ok()
        .header("Cache-Control", "public,max-age=31536000,immutable")
        .header("Vercel-CDN-Cache-Control", "public,max-age=31536000,immutable")
        .contentType(MediaType.parseMediaType(mime))
        .body(new FileSystemResource(path));
  }
}
