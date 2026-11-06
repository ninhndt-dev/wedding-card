package com.weddingcard.api.migration;

import com.weddingcard.api.http.*;
import java.nio.file.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Component
public class LegacyImporter implements ApplicationRunner {
  private final Sql sql;
  private final Json json;
  private final TransactionTemplate tx;
  private final String filename;

  public LegacyImporter(
      Sql sql,
      Json json,
      PlatformTransactionManager manager,
      @Value("${app.migration-file:}") String filename) {
    this.sql = sql;
    this.json = json;
    this.tx = new TransactionTemplate(manager);
    this.filename = filename;
  }

  public void run(ApplicationArguments args) throws Exception {
    if (filename.isBlank()) {
      sql.update(
          "UPDATE editor_documents SET draft=? WHERE id=1 AND revision=0 AND JSON_LENGTH(draft)=0",
          json.write(json.resource("default-document.json")));
      return;
    }
    var export = Json.map(json.parse(Files.readString(Path.of(filename))));
    String hash = Json.str(export, "sourceHash", 64, true);
    var tables = Json.map(export.get("tables"));
    if (!hash.equals(Json.hash(json.write(tables))))
      throw new IllegalStateException("Migration checksum mismatch");
    tx.executeWithoutResult(
        status -> {
          if (sql.one("SELECT source_hash FROM legacy_imports WHERE source_hash=?", hash) != null)
            return;
          var columns = new LinkedHashMap<String, String>();
          columns.put(
              "guests",
              "id,name,phone,attending,count,wish,approved,created,kind,side,event,message,submission_key,payload_hash");
          columns.put("settings", "id,value");
          columns.put("editor_documents", "id,draft,published,revision,updated");
          columns.put("editor_versions", "id,document,created");
          columns.put("media_assets", "id,filename,original_name,mime,bytes,created");
          columns.put("editor_presets", "id,name,document,created");
          columns.put("visit_events", "id,visitor_hash,day,created");
          columns.put(
              "widget_submissions",
              "id,widget_id,kind,name,phone,email,note,product,quantity,total,status,submission_key,payload_hash,created");
          for (String table : columns.keySet()) {
            long count = sql.jdbc().queryForObject("SELECT COUNT(*) FROM " + table, Long.class);
            if (table.equals("editor_documents")) {
              var row = sql.one("SELECT revision FROM editor_documents WHERE id=1");
              if (count != 1 || ((Number) row.get("revision")).longValue() != 0)
                throw new IllegalStateException("Destination is not empty");
            } else if (count != 0) throw new IllegalStateException("Destination is not empty");
          }
          sql.update("DELETE FROM editor_documents");
          for (var entry : columns.entrySet()) {
            String[] names = entry.getValue().split(",");
            for (Object value : Json.list(tables.getOrDefault(entry.getKey(), List.of()))) {
              var row = Json.map(value);
              Object[] values = Arrays.stream(names).map(row::get).toArray();
              sql.update(
                  "INSERT INTO "
                      + entry.getKey()
                      + "("
                      + entry.getValue()
                      + ") VALUES("
                      + String.join(",", Collections.nCopies(names.length, "?"))
                      + ")",
                  values);
            }
          }
          sql.update("INSERT INTO legacy_imports(source_hash) VALUES(?)", hash);
        });
    System.out.println("Legacy import verified and completed.");
  }
}
