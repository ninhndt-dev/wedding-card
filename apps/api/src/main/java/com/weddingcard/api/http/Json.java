package com.weddingcard.api.http;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;
import org.springframework.stereotype.Component;
import tools.jackson.databind.json.JsonMapper;

@Component
public class Json {
  private final JsonMapper mapper;

  public Json(JsonMapper mapper) {
    this.mapper = mapper;
  }

  public Object parse(String value) {
    return mapper.readValue(value, Object.class);
  }

  public String write(Object value) {
    return mapper.writeValueAsString(value);
  }

  public Map<String, Object> resource(String name) {
    try (var in = getClass().getResourceAsStream("/shared/" + name)) {
      return map(
          parse(new String(Objects.requireNonNull(in).readAllBytes(), StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  @SuppressWarnings("unchecked")
  public static Map<String, Object> map(Object v) {
    if (!(v instanceof Map)) throw ApiError.bad();
    return (Map<String, Object>) v;
  }

  @SuppressWarnings("unchecked")
  public static List<Object> list(Object v) {
    if (!(v instanceof List)) throw ApiError.bad();
    return (List<Object>) v;
  }

  public static String str(Map<String, Object> b, String k, int max, boolean required) {
    Object v = b.getOrDefault(k, "");
    if (!(v instanceof String s) || s.length() > max || (required && s.isBlank()))
      throw ApiError.bad();
    return ((String) v).trim();
  }

  public static long number(Object v, long min, long max) {
    if (!(v instanceof Number n)
        || !Double.isFinite(n.doubleValue())
        || n.doubleValue() != n.longValue()
        || n.longValue() < min
        || n.longValue() > max) throw ApiError.bad();
    return n.longValue();
  }

  public static String hash(String s) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }
}
