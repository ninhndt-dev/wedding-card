package com.weddingcard.api.http;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class JsonCacheTest {
  static class CountingJson extends Json {
    int parses;
    CountingJson() { super(JsonMapper.builder().build()); }
    @Override public Object parse(String value) { parses++; return super.parse(value); }
  }
  @Test void parsesResourcesOnceButReturnsIndependentMutableDocuments() {
    var json = new CountingJson();
    var first = json.resource("default-document.json");
    var expected = Json.map(first.get("site")).get("guestName");
    Json.map(first.get("site")).put("guestName", "Changed");
    Json.list(first.get("album")).add("Changed");
    var second = json.resource("default-document.json");
    assertEquals(1, json.parses);
    assertEquals(expected, Json.map(second.get("site")).get("guestName"));
    assertFalse(Json.list(second.get("album")).contains("Changed"));
  }
}
