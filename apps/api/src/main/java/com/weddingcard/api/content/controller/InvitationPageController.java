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
  private final Path developmentFile;
  private volatile InvitationMetadataService.Template template;
  private long modified;

  public InvitationPageController(EditorRepository editor, InvitationMetadataService metadata) throws Exception {
    this.editor = editor;
    this.metadata = metadata;
    var resource = new ClassPathResource("static/thiep-01/index.html");
    if (resource.exists()) {
      developmentFile = null;
      try (var input = resource.getInputStream()) {
        template = metadata.prepare(new String(input.readAllBytes(), StandardCharsets.UTF_8));
      }
    } else {
      Path file = Path.of("../../apps/web/public/thiep-01/index.html");
      if (!Files.isRegularFile(file)) file = Path.of("apps/web/public/thiep-01/index.html");
      developmentFile = file;
      refreshDevelopmentTemplate();
    }
  }

  private synchronized void refreshDevelopmentTemplate() throws Exception {
    if (developmentFile == null) return;
    long current = Files.getLastModifiedTime(developmentFile).toMillis();
    if (template == null || current != modified) {
      template = metadata.prepare(Files.readString(developmentFile));
      modified = current;
    }
  }

  @GetMapping(value={"/", "/thiep-01/", "/thiep-01/index.html"}, produces="text/html;charset=UTF-8")
  public Object page(@RequestParam(required=false) String invite) throws Exception {
    var doc = editor.published();
    if (developmentFile != null) refreshDevelopmentTemplate();
    return ResponseEntity.ok().header("Cache-Control", "no-store")
        .contentType(MediaType.parseMediaType("text/html;charset=UTF-8"))
        .body(metadata.render(template, doc, invite != null && invite.matches("[A-Za-z0-9_-]{20,48}") ? invite : null));
  }
  // Return metadata in the first response for crawlers, while keeping the existing
  // invitation runtime's query parameters available before its scripts execute.
  public ResponseEntity<String> invitation(String token, String guest) throws Exception {
    if (developmentFile != null) refreshDevelopmentTemplate();
    var params = new java.util.ArrayList<String>();
    if (token != null) params.add("invite=" + java.net.URLEncoder.encode(token, StandardCharsets.UTF_8));
    if (guest != null) params.add("guest=" + java.net.URLEncoder.encode(guest, StandardCharsets.UTF_8));
    String bootstrap = "";
    if (!params.isEmpty()) {
      String query = String.join("&", params);
      bootstrap = "<script>(function(){var u=new URL(location.href);"
          + "new URLSearchParams('" + query + "').forEach(function(v,k){u.searchParams.set(k,v)});"
          + "history.replaceState(null,'',u.pathname+u.search+u.hash);})();</script>\n";
    }
    var current = template;
    var personalized = new InvitationMetadataService.Template(current.prefix(), bootstrap + current.body());
    return ResponseEntity.ok().header("Cache-Control", "no-store")
        .contentType(MediaType.parseMediaType("text/html;charset=UTF-8"))
        .body(metadata.render(personalized, editor.published(), token));
  }

}
