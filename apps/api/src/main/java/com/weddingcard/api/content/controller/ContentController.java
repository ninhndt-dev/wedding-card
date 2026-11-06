package com.weddingcard.api.content.controller;

import com.weddingcard.api.editor.repository.EditorRepository;
import com.weddingcard.api.http.*;
import java.time.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class ContentController {
  private final EditorRepository editor;
  private final Sql sql;
  private final String secret;

  public ContentController(
      EditorRepository editor, Sql sql, @Value("${app.session-secret}") String secret) {
    this.editor = editor;
    this.sql = sql;
    this.secret = secret;
  }

  @GetMapping("/api/health")
  public Object health() {
    sql.jdbc().queryForObject("SELECT 1", Integer.class);
    return Map.of("status", "UP", "database", "mysql");
  }

  @GetMapping("/api/content")
  public Object content() {
    var row = editor.row(false);
    var doc = editor.published();
    var result = new LinkedHashMap<>(Json.map(doc.get("settings")));
    result.put("site", doc.get("site"));
    result.put("editor", row.get("published") == null ? null : doc);
    return result;
  }

  @GetMapping("/i/{slug}")
  public Object invitation(
      @PathVariable String slug, @RequestParam(required = false) String guest) {
    if (!slug.equals(Json.map(editor.published().get("site")).get("slug")))
      throw new ApiError(404, "Không tìm thấy thiệp.");
    String location =
        "/thiep-01/index.html"
            + (guest == null
                ? ""
                : "?guest="
                    + java.net.URLEncoder.encode(guest, java.nio.charset.StandardCharsets.UTF_8));
    return ResponseEntity.status(307).header("Location", location).build();
  }

  @PostMapping("/api/visits")
  public Object visit(@RequestBody Map<String, Object> b) {
    String visitor = Json.str(b, "visitor", 100, true);
    sql.update(
        "INSERT INTO visit_events(visitor_hash,day) VALUES(?,?)",
        Json.hash(secret + visitor),
        LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")));
    return ResponseEntity.noContent().build();
  }
}
