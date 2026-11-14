package com.weddingcard.api.content.controller;

import com.weddingcard.api.content.service.InvitationMetadataService;
import com.weddingcard.api.editor.repository.EditorRepository;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import org.springframework.core.io.ClassPathResource;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
public class InvitationPageController {
  private final EditorRepository editor;
  private final InvitationMetadataService metadata;

  public InvitationPageController(EditorRepository editor, InvitationMetadataService metadata) {
    this.editor = editor;
    this.metadata = metadata;
  }

  @GetMapping(value={"/", "/thiep-01/index.html"}, produces="text/html;charset=UTF-8")
  public Object page(@RequestParam(required=false) String invite) throws Exception {
    var doc = editor.published();
    var resource = new ClassPathResource("static/thiep-01/index.html");
    String template;
    if (resource.exists()) {
      try (var input = resource.getInputStream()) { template = new String(input.readAllBytes(), StandardCharsets.UTF_8); }
    } else {
      // Vite serves the assets during development; the API renders their metadata.
      Path file = Path.of("../../apps/web/public/thiep-01/index.html");
      if (!Files.isRegularFile(file)) file = Path.of("apps/web/public/thiep-01/index.html");
      template = Files.readString(file);
    }
    return ResponseEntity.ok().header("Cache-Control", "no-store")
        .contentType(MediaType.parseMediaType("text/html;charset=UTF-8"))
        .body(metadata.render(template, doc, invite != null && invite.matches("[A-Za-z0-9_-]{20,48}") ? invite : null));
  }
}
