package com.weddingcard.api.guest.controller;

import com.weddingcard.api.guest.service.GuestService;
import com.weddingcard.api.http.*;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
public class GuestController {
  private final GuestService service;
  private final Sql sql;

  public GuestController(GuestService service, Sql sql) {
    this.service = service;
    this.sql = sql;
  }

  @PostMapping("/api/rsvp")
  public Object rsvp(@RequestBody Map<String, Object> b) {
    return response(service.rsvp(b));
  }

  @PostMapping("/api/wishes")
  public Object wish(@RequestBody Map<String, Object> b) {
    return response(service.wish(b));
  }

  @GetMapping("/api/wishes")
  public Object wishes() {
    return Map.of(
        "wishes",
        sql.rows(
            "SELECT id,name,wish,created FROM guests WHERE approved=1 AND wish!='' ORDER BY id DESC"
                + " LIMIT 200"));
  }

  @GetMapping("/api/guest")
  public Object guest() {
    return sql.rows(
        "SELECT name,wish,created FROM guests WHERE approved=1 AND wish!='' ORDER BY id DESC LIMIT"
            + " 50");
  }

  @PostMapping("/api/guest")
  public Object legacy(@RequestBody Map<String, Object> b) {
    return response(service.legacy(b));
  }

  @PostMapping("/api/submissions")
  public Object submission(@RequestBody Map<String, Object> b) {
    return response(service.submission(b));
  }

  private Object response(Map<String, Object> result) {
    boolean created = Boolean.TRUE.equals(result.get("created"));
    var body = new LinkedHashMap<>(result);
    body.remove("created");
    return ResponseEntity.status(created ? 201 : 200).body(body);
  }
}
