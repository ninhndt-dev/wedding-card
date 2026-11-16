package com.weddingcard.api.content.service;

import static org.junit.jupiter.api.Assertions.*;
import java.util.*;
import org.junit.jupiter.api.Test;

class InvitationMetadataServiceTest {
  private final InvitationMetadataService metadata = new InvitationMetadataService("https://invite.example");
  private Map<String,Object> document(String photo) {
    return Map.of("site", Map.of("slug", "our-wedding"),
        "settings", Map.of("groom", "Ninh <&", "bride", "Ngọc", "photo", photo),
        "album", List.of(Map.of("src", "/media/12345678-1234-1234-1234-123456789abc.jpg")));
  }
  @Test void usesConfiguredSharePhotoAndEscapesMetadata() {
    var html = metadata.render("<html><head><title>Old</title><meta property=\"og:image\" content=\"https://old.example/a.jpg\"><meta property=\"og:image:width\" content=\"1200\"></head></html>", document("/media/87654321-1234-1234-1234-123456789abc.jpg"), "test-token");
    assertTrue(html.contains("https://invite.example/media/87654321-1234-1234-1234-123456789abc.jpg?preview=1440"));
    assertTrue(html.contains("https://invite.example/i/our-wedding/test-token"));
    assertTrue(html.contains("NINH &lt;&amp; &amp; NGỌC WEDDING"));
    assertTrue(html.contains("Trân trọng kính mời Quý Khách đến dự và chung vui cùng gia đình chúng tôi!"));
    assertFalse(html.contains("12345678-1234-1234-1234-123456789abc"));
    assertFalse(html.contains("old.example"));
    assertFalse(html.contains("og:image:width"));
  }
  @Test void usesAlbumWithoutAConfiguredPhoto() {
    var html = metadata.render("<html><head></head></html>", document(""), null);
    assertTrue(html.contains("https://invite.example/media/12345678-1234-1234-1234-123456789abc.jpg?preview=1440"));
    assertTrue(html.contains("name=\"twitter:image\""));
  }

  @Test void preparedTemplateDoesNotMixRecipientsOrKeepOldPublicationMetadata() {
    var template = metadata.prepare("<html><head><title>Old</title></head><body>Same invitation</body></html>");
    var doc = document("");
    var first = metadata.render(template, doc, "first-guest");
    var second = metadata.render(template, doc, "second-guest");
    assertTrue(first.contains("/our-wedding/first-guest"));
    assertFalse(second.contains("first-guest"));
    assertTrue(second.contains("/our-wedding/second-guest"));
    var updated = new HashMap<String,Object>(document("/new-photo.jpg"));
    updated.put("album", List.of(Map.of("src", "/new-album-photo.jpg")));
    assertTrue(metadata.render(template, updated, "second-guest").contains("https://invite.example/new-photo.jpg"));
  }
  @Test void fallsBackToConfiguredPhotoWhenAlbumIsEmpty() {
    var doc = new HashMap<String,Object>(document("/fallback.jpg"));
    doc.put("album", List.of());
    assertTrue(metadata.render("<html><head></head></html>", doc, null)
        .contains("https://invite.example/fallback.jpg"));
  }
  @Test void fallsBackToConfiguredPhotoWhenFirstAlbumSourceIsBlank() {
    var doc = new HashMap<String,Object>(document("/fallback.jpg"));
    doc.put("album", List.of(Map.of("src", "  ")));
    assertTrue(metadata.render("<html><head></head></html>", doc, null)
        .contains("https://invite.example/fallback.jpg"));
  }

}
