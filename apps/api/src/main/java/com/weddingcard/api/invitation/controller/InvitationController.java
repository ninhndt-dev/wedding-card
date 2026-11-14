package com.weddingcard.api.invitation.controller;

import com.weddingcard.api.http.*;
import com.weddingcard.api.invitation.service.InvitationService;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/invitations")
public class InvitationController {
  private final InvitationService service;

  public InvitationController(InvitationService service) {
    this.service = service;
  }

  @GetMapping
  public Object all() {
    return Map.of("invitations", service.all());
  }

  @PostMapping("/import")
  public Object importRows(@RequestBody Map<String, Object> body) {
    return service.importRows(body);
  }

  @PutMapping("/{id}")
  public Object update(@PathVariable long id, @RequestBody Map<String, Object> body) {
    service.update(id, body);
    return Map.of("ok", true);
  }

  @DeleteMapping("/{id}")
  public Object delete(@PathVariable long id) {
    service.delete(id);
    return Map.of("ok", true);
  }

  @DeleteMapping
  public Object deleteAll() {
    return Map.of("ok", true, "deleted", service.deleteAll());
  }
}
