package com.weddingcard.api.editor.model;

import static org.junit.jupiter.api.Assertions.*;

import com.weddingcard.api.http.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class DocumentValidatorTest {
  final Json json = new Json(JsonMapper.builder().build());
  final DocumentValidator validator = new DocumentValidator(json);

  @Test
  void initialDocumentIsValid() {
    assertEquals(1, validator.validate(json.resource("default-document.json")).get("schema"));
  }

  @Test
  void refusesScriptAndNetworkRelativeUrls() {
    assertThrows(ApiError.class, () -> DocumentValidator.url("javascript:alert(1)"));
    assertThrows(ApiError.class, () -> DocumentValidator.url("//example.com"));
    assertThrows(ApiError.class, () -> DocumentValidator.url("/media/%2e%2e/secret"));
  }

  @Test
  void rejectsUnknownLayerAndUnsafeStyle() {
    var doc = json.resource("default-document.json");
    Json.map(doc.get("nodes")).put("missing", java.util.Map.of("text", "fake"));
    assertThrows(ApiError.class, () -> validator.validate(doc));
    var valid = json.resource("default-document.json");
    var id =
        Json.map(Json.list(json.resource("editor-manifest.json").get("nodes")).getFirst())
            .get("id")
            .toString();
    Json.map(valid.get("nodes"))
        .put(
            id,
            java.util.Map.of(
                "style", java.util.Map.of("backgroundColor", "url(https://example.com)")));
    assertThrows(ApiError.class, () -> validator.validate(valid));
  }
}
