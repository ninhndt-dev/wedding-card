package com.weddingcard.api.editor.controller;

import com.weddingcard.api.editor.service.EditorService;
import com.weddingcard.api.http.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/editor")
public class EditorController {
  private final EditorService service;

  public EditorController(EditorService service) {
    this.service = service;
  }

  @GetMapping
  public Object get() {
    return service.get();
  }

  @PostMapping
  public Object save(@RequestBody Map<String, Object> b) {
    return service.save(b);
  }

  @GetMapping("/presets")
  public Object presets(@RequestParam(required = false) Long id) {
    if (id == null) return Map.of("presets", service.repo().presets());
    var r = service.repo().sql().one("SELECT * FROM editor_presets WHERE id=?", id);
    if (r == null) throw new ApiError(404, "Không tìm thấy preset.");
    r.put("document", service.repo().document(r.get("document")));
    return Map.of("preset", r);
  }

  @PostMapping("/presets")
  public Object preset(@RequestBody Map<String, Object> b) {
    return ResponseEntity.status("save".equals(b.get("action")) ? 201 : 200)
        .body(service.preset(b));
  }
}
