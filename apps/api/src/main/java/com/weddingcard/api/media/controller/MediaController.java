package com.weddingcard.api.media.controller;

import com.weddingcard.api.http.ApiError;
import com.weddingcard.api.media.service.MediaService;
import java.nio.file.Files;
import java.util.Map;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
public class MediaController {
  private final MediaService service;

  public MediaController(MediaService service) {
    this.service = service;
  }

  @PostMapping("/api/editor/assets")
  public Object upload(@RequestParam MultipartFile file) throws Exception {
    return ResponseEntity.status(201).body(service.upload(file));
  }

  @DeleteMapping("/api/editor/assets")
  public Object delete(@RequestBody Map<String, Object> b) {
    return service.delete(b);
  }

  @GetMapping("/media/{filename}")
  public Object file(@PathVariable String filename) {
    if (!filename.matches("[a-f0-9-]{36}\\.[a-z0-9]+"))
      throw new ApiError(404, "Không tìm thấy file.");
    String ext = filename.substring(filename.lastIndexOf('.') + 1),
        mime = MediaService.TYPES.get(ext);
    var path = service.directory().resolve(filename);
    if (mime == null || !Files.isRegularFile(path)) throw new ApiError(404, "Không tìm thấy file.");
    return ResponseEntity.ok()
        .header("Cache-Control", "public,max-age=31536000,immutable")
        .contentType(MediaType.parseMediaType(mime))
        .body(new FileSystemResource(path));
  }
}
