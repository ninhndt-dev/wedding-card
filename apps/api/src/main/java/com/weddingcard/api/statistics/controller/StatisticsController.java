package com.weddingcard.api.statistics.controller;

import static com.weddingcard.api.http.Json.*;

import com.weddingcard.api.http.*;
import java.util.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/editor/stats")
public class StatisticsController {
  private final Sql sql;

  public StatisticsController(Sql sql) {
    this.sql = sql;
  }

  @GetMapping
  public Object get() {
    return Map.of(
        "visits",
        sql.one(
            "SELECT COUNT(*) AS views,COUNT(DISTINCT visitor_hash) AS visitors FROM visit_events"),
        "daily",
        sql.rows(
            "SELECT day,COUNT(*) AS views FROM visit_events WHERE"
                + " day>=DATE_SUB(DATE(UTC_TIMESTAMP()+INTERVAL 7 HOUR),INTERVAL 13 DAY) GROUP BY"
                + " day ORDER BY day"),
        "rsvp",
        sql.one(
            "SELECT COUNT(*) AS replies,COALESCE(SUM(CASE WHEN attending='yes' THEN count ELSE 0"
                + " END),0) AS guests FROM guests WHERE kind!='wish'"),
        "wishes",
        sql.one(
            "SELECT COUNT(*) AS total,COALESCE(SUM(approved=0),0) AS pending FROM guests WHERE"
                + " wish!=''"),
        "forms",
        sql.rows("SELECT kind,COUNT(*) AS total FROM widget_submissions GROUP BY kind"),
        "submissions",
        sql.rows("SELECT * FROM widget_submissions ORDER BY id DESC LIMIT 500"));
  }

  @PostMapping
  public Object action(@RequestBody Map<String, Object> b) {
    long id = number(b.get("id"), 1, Long.MAX_VALUE);
    String action = str(b, "action", 20, true);
    if (action.equals("delete")) sql.update("DELETE FROM widget_submissions WHERE id=?", id);
    else if (action.equals("status")) {
      String status = str(b, "status", 20, true);
      if (!List.of("new", "confirmed", "cancelled").contains(status)) throw ApiError.bad();
      sql.update("UPDATE widget_submissions SET status=? WHERE id=?", status, id);
    } else throw ApiError.bad();
    return Map.of("ok", true);
  }
}
