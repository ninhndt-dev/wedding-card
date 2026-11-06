package com.weddingcard.api.editor.service;

import static com.weddingcard.api.http.Json.*;

import com.weddingcard.api.editor.model.DocumentValidator;
import com.weddingcard.api.editor.repository.EditorRepository;
import com.weddingcard.api.http.*;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class EditorService {
  private final EditorRepository repo;

  public EditorRepository repo() {
    return repo;
  }

  private final DocumentValidator validator;

  public EditorService(EditorRepository repo, DocumentValidator validator) {
    this.repo = repo;
    this.validator = validator;
  }

  public Map<String, Object> get() {
    var out = repo.state();
    out.put("manifest", repo.json().resource("editor-manifest.json"));
    out.put(
        "assets", repo.sql().rows("SELECT * FROM media_assets ORDER BY created DESC LIMIT 500"));
    out.put("presets", repo.presets());
    return out;
  }

  public Map<String, Object> validate(Object d) {
    var doc = validator.validate(d);
    var files =
        Pattern.compile("/media/([a-f0-9-]{36}\\.[a-z0-9]+)").matcher(repo.json().write(doc));
    while (files.find())
      if (repo.sql().one("SELECT id FROM media_assets WHERE filename=?", files.group(1)) == null)
        throw new ApiError(400, "Có file không còn tồn tại. Vui lòng chọn lại trong Media.");
    return doc;
  }

  @Transactional
  public Map<String, Object> save(Map<String, Object> b) {
    String action = str(b, "action", 20, true);
    if (!List.of("save", "publish", "restore").contains(action)) throw ApiError.bad();
    long revision = number(b.get("revision"), 0, Long.MAX_VALUE);
    var row = repo.row(true);
    if (revision != ((Number) row.get("revision")).longValue())
      throw new ApiError(409, "Thiệp đã được chỉnh ở cửa sổ khác. Vui lòng tải lại trước khi lưu.");
    Object input = b.get("document");
    if (action.equals("restore")) {
      var v =
          repo.sql()
              .one(
                  "SELECT document FROM editor_versions WHERE id=?",
                  number(b.get("versionId"), 1, Long.MAX_VALUE));
      if (v == null) throw new ApiError(404, "Không tìm thấy phiên bản.");
      input = repo.document(v.get("document"));
    }
    String serialized = repo.json().write(validate(input));
    repo.sql()
        .update(
            "UPDATE editor_documents SET"
                + " draft=?,published=?,revision=revision+1,updated=CURRENT_TIMESTAMP WHERE id=1",
            serialized,
            action.equals("publish") ? serialized : row.get("published"));
    if (action.equals("publish"))
      repo.sql().update("INSERT INTO editor_versions(document) VALUES(?)", serialized);
    return repo.state();
  }

  @Transactional
  public Map<String, Object> preset(Map<String, Object> b) {
    repo.row(true);
    String action = str(b, "action", 20, true);
    if (action.equals("delete")) {
      repo.sql()
          .update("DELETE FROM editor_presets WHERE id=?", number(b.get("id"), 1, Long.MAX_VALUE));
      return Map.of("ok", true);
    }
    if (!action.equals("save")) throw ApiError.bad();
    String name = str(b, "name", 100, true);
    String doc = repo.json().write(validate(b.get("document")));
    repo.sql().update("INSERT INTO editor_presets(name,document) VALUES(?,?)", name, doc);
    return Map.of("ok", true, "id", repo.sql().id());
  }
}
