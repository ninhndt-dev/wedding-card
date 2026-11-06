package com.weddingcard.api.invitation.service;

import static com.weddingcard.api.http.Json.*;

import com.weddingcard.api.http.*;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.util.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class InvitationService {
  private final Sql sql;
  private final SecureRandom random = new SecureRandom();

  public InvitationService(Sql sql) {
    this.sql = sql;
  }

  public Map<String, Object> byToken(String token) {
    if (!token.matches("[A-Za-z0-9_-]{20,48}")) throw new ApiError(404, "Không tìm thấy thiệp.");
    var row = sql.one("SELECT id,name,invited_count FROM personal_invitations WHERE token=?", token);
    if (row == null) throw new ApiError(404, "Không tìm thấy thiệp.");
    return row;
  }

  public Long idFromBody(Map<String, Object> body) {
    String token = str(body, "invitationToken", 48, false);
    return token.isEmpty() ? null : ((Number) byToken(token).get("id")).longValue();
  }

  public List<Map<String, Object>> all() {
    var invitations = sql.rows("SELECT * FROM personal_invitations ORDER BY source_order,id");
    var byId = new HashMap<Long, Map<String, Object>>();
    for (var row : invitations) {
      row.put("rsvp", new ArrayList<Map<String, Object>>());
      row.put("wishes", new ArrayList<Map<String, Object>>());
      row.put("submissions", new ArrayList<Map<String, Object>>());
      row.put("visits", 0);
      byId.put(((Number) row.get("id")).longValue(), row);
    }
    for (var response : sql.rows("SELECT * FROM guests WHERE invitation_id IS NOT NULL ORDER BY id DESC")) {
      var invite = byId.get(((Number) response.get("invitation_id")).longValue());
      if (invite != null) {
        String key = "wish".equals(response.get("kind")) ? "wishes" : "rsvp";
        @SuppressWarnings("unchecked")
        var history = (List<Map<String, Object>>) invite.get(key);
        history.add(response);
      }
    }
    for (var response : sql.rows("SELECT * FROM widget_submissions WHERE invitation_id IS NOT NULL ORDER BY id DESC")) {
      var invite = byId.get(((Number) response.get("invitation_id")).longValue());
      if (invite != null) {
        @SuppressWarnings("unchecked")
        var history = (List<Map<String, Object>>) invite.get("submissions");
        history.add(response);
      }
    }
    for (var visit : sql.rows("SELECT invitation_id,COUNT(*) visits,MAX(created) last_viewed FROM visit_events WHERE invitation_id IS NOT NULL GROUP BY invitation_id")) {
      var invite = byId.get(((Number) visit.get("invitation_id")).longValue());
      if (invite != null) {
        invite.put("visits", visit.get("visits"));
        invite.put("lastViewed", visit.get("last_viewed"));
      }
    }
    return invitations;
  }

  @Transactional
  public Map<String, Object> importRows(Map<String, Object> body) {
    var raw = list(body.get("rows"));
    if (raw.isEmpty() || raw.size() > 5000) throw ApiError.bad();
    var unique = new LinkedHashMap<String, Map<String, Object>>();
    for (Object item : raw) {
      var row = map(item);
      String name = str(row, "name", 100, true).replaceAll("\\s+", " ");
      String key = key(name);
      var clean = new LinkedHashMap<String, Object>();
      clean.put("name", name);
      clean.put("nameKey", key);
      clean.put("phone", row.containsKey("phone") ? str(row, "phone", 30, false) : null);
      clean.put("side", row.containsKey("side") ? str(row, "side", 20, false) : null);
      clean.put("event", row.containsKey("event") ? str(row, "event", 100, false) : null);
      clean.put("note", row.containsKey("note") ? str(row, "note", 1000, false) : null);
      clean.put("invitedCount", row.containsKey("invitedCount") ? number(row.get("invitedCount"), 0, 50) : null);
      unique.remove(key);
      unique.put(key, clean);
    }
    int order = 0;
    for (var row : unique.values()) {
      byte[] bytes = new byte[24];
      random.nextBytes(bytes);
      String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
      var old = sql.one("SELECT id FROM personal_invitations WHERE name_key=?", row.get("nameKey"));
      if (old == null)
        sql.update(
            "INSERT INTO personal_invitations(token,name,name_key,phone,side,event,invited_count,note,source_order) VALUES(?,?,?,?,?,?,?,?,?)",
            token, row.get("name"), row.get("nameKey"), Objects.requireNonNullElse(row.get("phone"), ""),
            Objects.requireNonNullElse(row.get("side"), ""), Objects.requireNonNullElse(row.get("event"), ""),
            Objects.requireNonNullElse(row.get("invitedCount"), 0), Objects.requireNonNullElse(row.get("note"), ""), ++order);
      else
        sql.update(
            "UPDATE personal_invitations SET name=?,phone=COALESCE(?,phone),side=COALESCE(?,side),event=COALESCE(?,event),invited_count=COALESCE(?,invited_count),note=COALESCE(?,note),source_order=? WHERE id=?",
            row.get("name"), row.get("phone"), row.get("side"), row.get("event"), row.get("invitedCount"),
            row.get("note"), ++order, old.get("id"));
    }
    return Map.of("ok", true, "imported", unique.size(), "duplicates", raw.size() - unique.size());
  }

  public void update(long id, Map<String, Object> body) {
    String name = str(body, "name", 100, true).replaceAll("\\s+", " ");
    if (sql.one("SELECT id FROM personal_invitations WHERE name_key=? AND id<>?", key(name), id) != null)
      throw new ApiError(409, "Tên khách đã có trong danh sách.");
    if (sql.update("UPDATE personal_invitations SET name=?,name_key=?,phone=?,side=?,event=?,invited_count=?,note=? WHERE id=?",
        name, key(name), str(body, "phone", 30, false), str(body, "side", 20, false),
        str(body, "event", 100, false), number(body.getOrDefault("invitedCount", 0), 0, 50),
        str(body, "note", 1000, false), id) == 0)
      throw new ApiError(404, "Không tìm thấy thiệp.");
  }

  public void delete(long id) {
    sql.update("DELETE FROM personal_invitations WHERE id=?", id);
  }

  private String key(String name) {
    return Normalizer.normalize(name, Normalizer.Form.NFC).toLowerCase(Locale.ROOT);
  }
}
