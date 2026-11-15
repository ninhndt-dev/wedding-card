package com.weddingcard.api.editor.repository;

import com.weddingcard.api.http.*;
import java.util.*;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Repository
public class EditorRepository {
  private final Sql sql;
  private final Json json;
  private record Publication(String source, Map<String,Object> document) {}
  private volatile Publication publication;

  public Sql sql() {
    return sql;
  }

  public Json json() {
    return json;
  }

  public EditorRepository(Sql sql, Json json) {
    this.sql = sql;
    this.json = json;
  }

  public Map<String, Object> row(boolean lock) {
    return sql.one(
        "SELECT draft,published,revision,updated FROM editor_documents WHERE id=1"
            + (lock ? " FOR UPDATE" : ""));
  }

  public Map<String, Object> document(Object raw) {
    var base = json.resource("default-document.json");
    if (raw == null) return base;
    var value = Json.map(json.parse(raw.toString()));
    var site = Json.map(base.get("site"));
    var theme = Json.map(base.get("theme"));
    base.putAll(value);
    site.putAll(Json.map(value.getOrDefault("site", Map.of())));
    base.put("site", site);
    theme.putAll(Json.map(value.getOrDefault("theme", Map.of())));
    base.put("theme", theme);
    return base;
  }

  public Map<String, Object> published() {
    return publishedDocument(sql.one("SELECT published FROM editor_documents WHERE id=1").get("published"));
  }

  public Map<String,Object> publishedDocument(Object raw) {
    // Always read the current SQL value. Cached parsing cannot hide a publish
    // made by another instance, or expose an uncommitted editor transaction.
    if (TransactionSynchronizationManager.isActualTransactionActive()) return json.immutable(document(raw));
    String source = raw == null ? null : raw.toString();
    var cached = publication;
    if (cached != null && Objects.equals(source, cached.source())) return cached.document();
    synchronized (this) {
      cached = publication;
      if (cached == null || !Objects.equals(source, cached.source()))
        publication = cached = new Publication(source, json.immutable(document(raw)));
      return cached.document();
    }
  }

  public void invalidatePublished() {
    publication = null;
  }

  public Map<String, Object> state() {
    var r = row(false);
    var out = new LinkedHashMap<String, Object>();
    out.put("document", document(r.get("draft")));
    out.put("published", r.get("published") == null ? null : publishedDocument(r.get("published")));
    out.put("revision", r.get("revision"));
    out.put("updated", r.get("updated"));
    out.put(
        "versions", sql.rows("SELECT id,created FROM editor_versions ORDER BY id DESC LIMIT 30"));
    return out;
  }

  public List<Map<String, Object>> presets() {
    return sql.rows("SELECT id,name,created FROM editor_presets ORDER BY id DESC");
  }

  public String references() {
    var strings = new ArrayList<String>();
    for (var r : sql.rows("SELECT draft,published FROM editor_documents"))
      for (var v : r.values()) if (v != null) strings.add(v.toString());
    for (var r :
        sql.rows(
            "SELECT document FROM editor_versions UNION ALL SELECT document FROM editor_presets"))
      strings.add(r.get("document").toString());
    return String.join("\n", strings);
  }
}
