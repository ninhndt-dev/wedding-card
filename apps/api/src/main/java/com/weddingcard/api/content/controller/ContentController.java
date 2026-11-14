package com.weddingcard.api.content.controller;

import com.weddingcard.api.editor.repository.EditorRepository;
import com.weddingcard.api.http.*;
import com.weddingcard.api.invitation.service.InvitationService;
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
  private final InvitationService invitations;

  public ContentController(
      EditorRepository editor, Sql sql, InvitationService invitations, @Value("${app.session-secret}") String secret) {
    this.editor = editor;
    this.sql = sql;
    this.secret = secret;
    this.invitations = invitations;
  }

  @GetMapping("/api/health")
  public Object health() {
    sql.jdbc().queryForObject("SELECT 1", Integer.class);
    return Map.of("status", "UP", "database", "mysql");
  }

  @GetMapping("/api/content")
  public Object content(@RequestParam(required = false) String invite) {
    var row = editor.row(false);
    var doc = editor.document(row.get("published"));
    var result = new LinkedHashMap<>(Json.map(doc.get("settings")));
    result.put("site", doc.get("site"));
    result.put("editor", row.get("published") == null ? null : doc);
    if (invite != null && !invite.isBlank()) {
      var invitation = invitations.byToken(invite);
      result.put("invitation", Map.of("name", invitation.get("name"),
          "side", InvitationService.sideCode(invitation.get("side"))));
    }
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

  @GetMapping("/i/{slug}/{token}")
  public Object personalInvitation(@PathVariable String slug, @PathVariable String token) {
    if (!slug.equals(Json.map(editor.published().get("site")).get("slug")))
      throw new ApiError(404, "Không tìm thấy thiệp.");
    String name = (String) invitations.byToken(token).get("name");
    return ResponseEntity.status(307)
        .header("Location", "/thiep-01/index.html?invite=" + token + "&guest="
            + java.net.URLEncoder.encode(name, java.nio.charset.StandardCharsets.UTF_8))
        .build();
  }

  @GetMapping("/api/invitation/{token}")
  public Object invitationDetails(@PathVariable String token) {
    var invitation = invitations.byToken(token);
    return Map.of("name", invitation.get("name"), "invitedCount", invitation.get("invited_count"),
        "side", InvitationService.sideCode(invitation.get("side")));
  }

  @PostMapping("/api/visits")
  public Object visit(@RequestBody Map<String, Object> b) {
    String visitor = Json.str(b, "visitor", 100, true);
    Long invitationId = invitations.idFromBody(b);
    sql.update(
        "INSERT INTO visit_events(visitor_hash,day,invitation_id) VALUES(?,?,?)",
        Json.hash(secret + visitor),
        LocalDate.now(ZoneId.of("Asia/Ho_Chi_Minh")), invitationId);
    return ResponseEntity.noContent().build();
  }
}
