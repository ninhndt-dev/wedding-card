package com.weddingcard.api.admin.controller;

import static com.weddingcard.api.http.Json.*;

import com.weddingcard.api.auth.service.AuthService;
import com.weddingcard.api.editor.repository.EditorRepository;
import com.weddingcard.api.guest.service.GuestService;
import com.weddingcard.api.http.*;
import jakarta.servlet.http.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/admin")
public class AdminController {
  private final Sql sql;
  private final Json json;
  private final AuthService auth;
  private final EditorRepository editor;
  private final GuestService guests;

  public AdminController(
      Sql sql, Json json, AuthService auth, EditorRepository editor, GuestService guests) {
    this.sql = sql;
    this.json = json;
    this.auth = auth;
    this.editor = editor;
    this.guests = guests;
  }

  public Map<String, Object> settings() {
    var row = sql.one("SELECT value FROM settings WHERE id=1");
    return row == null
        ? map(json.resource("default-document.json").get("settings"))
        : map(json.parse(row.get("value").toString()));
  }

  @GetMapping
  public Object get() {
    return Map.of(
        "guests",
        sql.rows("SELECT * FROM guests ORDER BY id DESC"),
        "settings",
        settings(),
        "eventNames",
        guests.events());
  }

  @PostMapping
  public Object action(
      @RequestBody Map<String, Object> b, HttpServletRequest req, HttpServletResponse res) {
    String action = str(b, "action", 20, true);
    if (action.equals("login")) {
      auth.login(str(b, "password", 1000, true), res);
      return Map.of("ok", true);
    }
    if (!auth.authenticated(req)) throw new ApiError(401, "Phiên đăng nhập đã hết hạn.");
    switch (action) {
      case "logout" -> auth.logout(req, res);
      case "approve" ->
          sql.update(
              "UPDATE guests SET approved=? WHERE id=?",
              Boolean.TRUE.equals(b.get("approved")) ? 1 : 0,
              number(b.get("id"), 1, Long.MAX_VALUE));
      case "delete" ->
          sql.update("DELETE FROM guests WHERE id=?", number(b.get("id"), 1, Long.MAX_VALUE));
      case "settings" -> {
        var s = map(b.get("settings"));
        for (String k : List.of("bride", "groom", "date", "venue", "address", "story", "photo"))
          str(s, k, 3000, k.equals("bride") || k.equals("groom"));
        sql.update(
            "INSERT INTO settings(id,value) VALUES(1,?) ON DUPLICATE KEY UPDATE"
                + " value=VALUES(value)",
            json.write(s));
      }
      default -> throw ApiError.bad();
    }
    return Map.of("ok", true);
  }
}
