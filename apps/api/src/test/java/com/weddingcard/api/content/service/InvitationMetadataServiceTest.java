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
  @Test void usesConfiguredPhotoAndEscapesMetadata() {
    var html = metadata.render("<html><head><title>Old</title><meta property=\"og:image\" content=\"https://old.example/a.jpg\"><meta property=\"og:image:width\" content=\"1200\"></head></html>", document("/media/87654321-1234-1234-1234-123456789abc.jpg"), "test-token");
    assertTrue(html.contains("https://invite.example/media/87654321-1234-1234-1234-123456789abc.jpg?preview=1440"));
    assertTrue(html.contains("https://invite.example/i/our-wedding/test-token"));
    assertTrue(html.contains("Ninh &lt;&amp; &amp; Ngọc"));
    assertFalse(html.contains("old.example"));
    assertFalse(html.contains("og:image:width"));
  }
  @Test void fallsBackToAlbumWithoutAConfiguredPhoto() {
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
    assertTrue(metadata.render(template, updated, "second-guest").contains("https://invite.example/new-photo.jpg"));
  }
}
