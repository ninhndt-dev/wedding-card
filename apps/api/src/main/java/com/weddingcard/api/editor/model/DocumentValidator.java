package com.weddingcard.api.editor.model;

import static com.weddingcard.api.http.Json.*;

import com.weddingcard.api.http.*;
import java.time.LocalDateTime;
import java.util.*;
import org.springframework.stereotype.Component;

@Component
public class DocumentValidator {
  private final Set<String> ids = new HashSet<>(),
      types = new HashSet<>(),
      styles = new HashSet<>();

  public DocumentValidator(Json json) {
    for (Object v : list(json.resource("editor-manifest.json").get("nodes")))
      ids.add((String) map(v).get("id"));
    for (Object t : list(json.resource("widget-catalog.json").get("WIDGET_TYPES")))
      types.add((String) t);
    for (Object t : list(json.resource("widget-catalog.json").get("STYLE_KEYS")))
      styles.add((String) t);
  }

  public Map<String, Object> validate(Object value) {
    var d = map(value);
    if (number(d.get("schema"), 1, 1) != 1) throw ApiError.bad();
    var s = map(d.get("settings"));
    for (String k : List.of("bride", "groom", "date", "venue", "address", "story", "photo"))
      str(s, k, 3000, k.equals("bride") || k.equals("groom"));
    date(s.get("date"));
    url(s.get("photo"));
    var nodes = map(d.get("nodes"));
    if (nodes.size() > 300) throw ApiError.bad();
    for (var e : nodes.entrySet()) {
      if (!ids.contains(e.getKey())) throw ApiError.bad();
      node(map(e.getValue()), false);
    }
    var additions = list(d.get("additions"));
    if (additions.size() > 100) throw ApiError.bad();
    Set<String> seen = new HashSet<>();
    for (Object v : additions) {
      var n = map(v);
      String id = str(n, "id", 90, true);
      if (!id.matches("custom_[a-zA-Z0-9_-]{8,80}")
          || !seen.add(id)
          || !types.contains(n.get("type"))) throw ApiError.bad();
      node(n, true);
    }
    var album = list(d.get("album"));
    if (album.size() > 100) throw ApiError.bad();
    for (Object a : album) {
      url(map(a).get("src"));
      str(map(a), "caption", 300, false);
    }
    for (String side : List.of("groom", "bride")) {
      var e = map(map(d.get("events")).get(side));
      date(e.get("date"));
      for (String k : List.of("venue", "address", "lunar")) str(e, k, 1000, false);
      url(e.get("mapUrl"));
      var g = map(map(d.get("gifts")).get(side));
      url(g.get("qr"));
      for (String k : List.of("bank", "holder", "account")) str(g, k, 200, false);
    }
    url(map(d.get("music")).get("src"));
    var theme = map(d.get("theme"));
    number(theme.get("canvasHeight"), 1000, 40000);
    color(theme.get("primary"));
    color(theme.get("background"));
    str(theme, "fontFamily", 200, false);
    str(theme, "effectSymbols", 100, false);
    url(theme.get("fontUrl"));
    url(theme.get("backgroundImage"));
    for (String key : List.of("rsvp", "wishes")) {
      var f = map(map(d.get("forms")).get(key));
      for (String k :
          List.of("title", "subtitle", "button", "namePlaceholder", "messagePlaceholder"))
        str(f, k, 1000, false);
      if (key.equals("rsvp")) {
        var events = list(f.get("events"));
        if (events.isEmpty() || events.size() > 20) throw ApiError.bad();
        for (Object e : events)
          if (!(e instanceof String t) || t.isBlank() || t.length() > 100) throw ApiError.bad();
      }
    }
    var opening = map(d.get("opening"));
    color(opening.get("background"));
    for (String k : List.of("title", "invite", "button")) str(opening, k, 1000, false);
    for (Object u : map(opening.get("images")).values()) url(u);
    var site = map(d.get("site"));
    String slug = str(site, "slug", 80, true);
    if (!slug.matches("[a-z][a-z0-9]*(?:-[a-z0-9]+)*")
        || List.of("admin", "api", "media", "thiep-01", "i").contains(slug)) throw ApiError.bad();
    str(site, "guestName", 100, false);
    scan(d, 0);
    return d;
  }

  private void node(Map<String, Object> n, boolean added) {
    if (n.containsKey("text")) str(n, "text", 5000, false);
    for (String k : List.of("src", "href")) if (n.containsKey(k)) url(n.get(k));
    if (n.containsKey("hidden") && !(n.get("hidden") instanceof Boolean)) throw ApiError.bad();
    var style = map(n.getOrDefault("style", Map.of()));
    for (var e : style.entrySet()) {
      if (!styles.contains(e.getKey())
          || !(e.getValue() instanceof String s)
          || s.length() > 300
          || s.toLowerCase().matches("(?s).*(url\\s*\\(|expression|@import|[<>]).*"))
        throw ApiError.bad();
    }
    if (added) {
      var p = map(n.getOrDefault("props", Map.of()));
      for (String key :
          List.of(
              "body",
              "address",
              "phone",
              "description",
              "button",
              "product",
              "heading",
              "side",
              "date")) {
        if (p.containsKey(key)) str(p, key, key.equals("body") ? 10000 : 1000, false);
      }
      if (p.containsKey("side") && !List.of("", "groom", "bride").contains(p.get("side")))
        throw ApiError.bad();
      if (p.containsKey("heading")
          && !List.of("", "h1", "h2", "h3", "p").contains(p.get("heading"))) throw ApiError.bad();

      if (p.containsKey("unitPrice")) number(p.get("unitPrice"), 0, 1000000000);
      for (String k : List.of("url", "poster")) if (p.containsKey(k)) url(p.get(k));
      if (p.containsKey("date") && !p.get("date").equals("")) date(p.get("date"));
      if (p.containsKey("images")) {
        var images = list(p.get("images"));
        if (images.size() > 100) throw ApiError.bad();
        images.forEach(DocumentValidator::url);
      }
      for (String k : List.of("links", "items"))
        if (p.containsKey(k)) {
          var values = list(p.get(k));
          if (values.size() > 30) throw ApiError.bad();
          for (Object v : values) if (k.equals("links")) url(map(v).get("url"));
        }
    }
  }

  private void scan(Object v, int depth) {
    if (depth > 16) throw ApiError.bad();
    if (v instanceof Map<?, ?> m) {
      if (m.size() > 400) throw ApiError.bad();
      for (Object item : m.values()) scan(item, depth + 1);
    } else if (v instanceof List<?> l) {
      if (l.size() > 300) throw ApiError.bad();
      for (Object item : l) scan(item, depth + 1);
    } else if (v instanceof String s && s.length() > 10000) throw ApiError.bad();
  }

  private static void color(Object v) {
    if (!(v instanceof String s) || !s.matches("#[0-9a-fA-F]{6}")) throw ApiError.bad();
  }

  private static void date(Object v) {
    try {
      String s = (String) v;
      if (!s.matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}")) throw ApiError.bad();
      LocalDateTime.parse(s);
    } catch (Exception e) {
      throw ApiError.bad();
    }
  }

  public static void url(Object v) {
    if (v == null) return;
    if (!(v instanceof String s) || s.length() > 2048) throw ApiError.bad();
    if (s.isEmpty()) return;
    if (s.startsWith("/") && !s.startsWith("//")) {
      try {
        String decoded = java.net.URLDecoder.decode(s, java.nio.charset.StandardCharsets.UTF_8);
        if (!decoded.contains("..") && decoded.matches("/[a-zA-Z0-9_./()-]+")) return;
      } catch (IllegalArgumentException ignored) {
      }
      throw ApiError.bad();
    }
    try {
      var u = java.net.URI.create(s);
      if ("https".equals(u.getScheme()) && u.getHost() != null && u.getUserInfo() == null) return;
    } catch (Exception ignored) {
    }
    throw new ApiError(400, "Dùng file đã tải lên hoặc đường dẫn HTTPS.");
  }
}
