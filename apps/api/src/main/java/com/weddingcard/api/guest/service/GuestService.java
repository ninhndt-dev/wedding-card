package com.weddingcard.api.guest.service;

import static com.weddingcard.api.http.Json.*;

import com.weddingcard.api.editor.repository.EditorRepository;
import com.weddingcard.api.guest.repository.GuestRepository;
import com.weddingcard.api.http.*;
import java.util.*;
import org.springframework.stereotype.Service;

@Service
public class GuestService {
  private final GuestRepository repo;
  private final EditorRepository editor;
  private final Json json;

  public GuestService(GuestRepository repo, EditorRepository editor, Json json) {
    this.repo = repo;
    this.editor = editor;
    this.json = json;
  }

  public List<Object> events() {
    return list(map(map(editor.published().get("forms")).get("rsvp")).get("events"));
  }

  public Map<String, Object> rsvp(Map<String, Object> b) {
    String name = str(b, "guestName", 100, true),
        message = str(b, "message", 2000, false),
        side = str(b, "eventType", 20, true),
        event = str(b, "eventName", 100, false);
    if (!(b.get("willAttend") instanceof Boolean attend)
        || !List.of("nhatrai", "nhagai").contains(side)) throw ApiError.bad();
    if ((attend || !event.isEmpty()) && !events().contains(event)) throw ApiError.bad();
    long count = attend ? number(b.get("numberOfGuests"), 1, 50) : 0;
    if (!attend) event = "";
    String key = key(b);
    var data = new LinkedHashMap<String, Object>();
    data.put("name", name);
    data.put("message", message);
    data.put("side", side);
    data.put("event", event);
    data.put("attending", attend ? "yes" : "no");
    data.put("count", count);
    String hash = hash(json.write(data));
    return repo.store(
        "guests",
        key,
        hash,
        "INSERT INTO"
            + " guests(name,attending,count,side,event,message,wish,submission_key,payload_hash)"
            + " VALUES(?,?,?,?,?,?,'',?,?)",
        name,
        attend ? "yes" : "no",
        count,
        side,
        event,
        message,
        key,
        hash);
  }

  public Map<String, Object> wish(Map<String, Object> b) {
    String name = str(b, "name", 100, true),
        wish = str(b, "wish", 2000, true),
        key = "wish-" + key(b),
        hash = hash(json.write(Map.of("name", name, "wish", wish)));
    return repo.store(
        "guests",
        key,
        hash,
        "INSERT INTO guests(name,attending,count,wish,message,submission_key,payload_hash,kind)"
            + " VALUES(?,'maybe',0,?,'',?,?,'wish')",
        name,
        wish,
        key,
        hash);
  }

  public Map<String, Object> legacy(Map<String, Object> b) {
    if (!str(b, "website", 2000, false).isEmpty()) return Map.of("ok", true, "created", false);
    String name = str(b, "name", 100, true),
        phone = str(b, "phone", 30, false),
        wish = str(b, "wish", 2000, false),
        attending = str(b, "attending", 10, true);
    long count = number(b.get("count"), 0, 20);
    if (!List.of("yes", "no", "maybe").contains(attending)
        || (attending.equals("yes") && count < 1)) throw ApiError.bad();
    if (repo.sql()
            .one(
                "SELECT id FROM guests WHERE name=? AND phone=? AND"
                    + " created>DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1 MINUTE)",
                name,
                phone)
        != null) throw new ApiError(429, "Bạn vừa gửi phản hồi. Vui lòng chờ một phút.");
    repo.sql()
        .update(
            "INSERT INTO guests(name,phone,attending,count,wish,message) VALUES(?,?,?,?,?,'')",
            name,
            phone,
            attending,
            attending.equals("no") ? 0 : count,
            wish);
    return Map.of("ok", true, "created", true);
  }

  public Map<String, Object> submission(Map<String, Object> b) {
    String id = str(b, "widgetId", 90, true);
    Map<String, Object> widget = null;
    for (Object v : list(editor.published().get("additions"))) {
      var n = map(v);
      if (id.equals(n.get("id"))
          && !Boolean.TRUE.equals(n.get("hidden"))
          && List.of("registration", "order").contains(n.get("type"))) widget = n;
    }
    if (widget == null) throw new ApiError(400, "Biểu mẫu chưa được áp dụng hoặc đã bị ẩn.");
    String name = str(b, "name", 100, true),
        phone = str(b, "phone", 30, false),
        email = str(b, "email", 200, false),
        note = str(b, "note", 2000, false),
        key = key(b),
        kind = (String) widget.get("type");
    if (!email.isEmpty() && !email.matches("[^\\s@]+@[^\\s@]+\\.[^\\s@]+")) throw ApiError.bad();
    var props = map(widget.getOrDefault("props", Map.of()));
    long quantity = kind.equals("order") ? number(b.get("quantity"), 1, 100) : 0;
    long price = number(props.getOrDefault("unitPrice", 0), 0, 1000000000);
    String product = kind.equals("order") ? str(props, "product", 1000, false) : "";
    long total = quantity * price;
    var data = new LinkedHashMap<String, Object>();
    data.put("widgetId", id);
    data.put("kind", kind);
    data.put("name", name);
    data.put("phone", phone);
    data.put("email", email);
    data.put("note", note);
    data.put("quantity", quantity);
    data.put("product", product);
    data.put("total", total);
    String hash = hash(json.write(data));
    return repo.store(
        "widget_submissions",
        key,
        hash,
        "INSERT INTO"
            + " widget_submissions(widget_id,kind,name,phone,email,note,product,quantity,total,submission_key,payload_hash)"
            + " VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        id,
        kind,
        name,
        phone,
        email,
        note,
        product,
        quantity,
        total,
        key,
        hash);
  }

  private String key(Map<String, Object> b) {
    String key = str(b, "submissionId", 80, true);
    if (!key.matches("[a-zA-Z0-9_-]{16,80}")) throw ApiError.bad();
    return key;
  }
}
