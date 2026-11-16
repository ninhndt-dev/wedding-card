package com.weddingcard.api.content.controller;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.weddingcard.api.content.service.InvitationMetadataService;
import com.weddingcard.api.editor.repository.EditorRepository;
import com.weddingcard.api.http.ApiError;
import com.weddingcard.api.http.Sql;
import com.weddingcard.api.invitation.service.InvitationService;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

class InvitationSharePageTest {
  @Test void allInvitationRoutesReturnTheConfiguredImageWithoutRedirecting() throws Exception {
    var editor = mock(EditorRepository.class);
    var invitations = mock(InvitationService.class);
    var doc = new HashMap<String,Object>(Map.of(
        "site", Map.of("slug", "our-wedding"),
        "settings", Map.of("groom", "Ninh", "bride", "Ngọc", "photo", "/selected.jpg"),
        "album", List.of(Map.of("src", "/album.jpg"))));
    when(editor.published()).thenReturn(doc);
    var pages = new InvitationPageController(editor, new InvitationMetadataService("https://invite.example"));
    var content = new ContentController(editor, mock(Sql.class), invitations, pages, "test-secret");
    String token = "abcdefghijklmnopqrstuvwx";
    when(invitations.byToken(token)).thenReturn(Map.of("name", "Anh Long </script>' & Ngọc"));
    for (Object result : List.of(pages.page(null), content.invitation("our-wedding", null),
        content.personalInvitation("our-wedding", token))) {
      var response = (ResponseEntity<?>) result;
      assertEquals(200, response.getStatusCode().value());
      assertNull(response.getHeaders().getLocation());
      assertEquals("no-store", response.getHeaders().getCacheControl());
      assertTrue(response.getBody().toString().contains("property=\"og:image\" content=\"https://invite.example/selected.jpg\""));
    }
    var personal = (ResponseEntity<?>) content.personalInvitation("our-wedding", token);
    String html = personal.getBody().toString();
    assertTrue(html.contains("/i/our-wedding/" + token));
    assertTrue(html.contains("invite=" + token));
    assertTrue(html.contains("guest=Anh+Long+%3C%2Fscript%3E%27+%26+Ng%E1%BB%8Dc"));
    assertFalse(html.contains("Anh Long </script>"));
    assertTrue(html.indexOf("history.replaceState") < html.indexOf("var guestParams"));
    var updated = new HashMap<String,Object>(doc);
    updated.put("settings", Map.of("groom", "Ninh", "bride", "Ngọc", "photo", "/updated.jpg"));
    when(editor.published()).thenReturn(updated);
    assertTrue(((ResponseEntity<?>) content.personalInvitation("our-wedding", token)).getBody().toString().contains("https://invite.example/updated.jpg"));
  }

  @Test void invalidSlugsAndTokensStillReturnNotFound() throws Exception {
    var editor = mock(EditorRepository.class);
    when(editor.published()).thenReturn(Map.of("site", Map.of("slug", "our-wedding")));
    var invitations = mock(InvitationService.class);
    when(invitations.byToken("invalid")).thenThrow(new ApiError(404, "Not found"));
    var content = new ContentController(editor, mock(Sql.class), invitations,
        mock(InvitationPageController.class), "test-secret");
    assertThrows(ApiError.class, () -> content.invitation("wrong", null));
    assertThrows(ApiError.class, () -> content.personalInvitation("our-wedding", "invalid"));
  }
}
