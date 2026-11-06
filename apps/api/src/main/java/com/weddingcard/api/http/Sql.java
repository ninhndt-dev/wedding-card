package com.weddingcard.api.http;

import java.sql.*;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class Sql {
  private final JdbcTemplate jdbc;

  public JdbcTemplate jdbc() {
    return jdbc;
  }

  public Sql(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  public List<Map<String, Object>> rows(String query, Object... args) {
    return jdbc.query(
        query,
        (rs, n) -> {
          Map<String, Object> row = new LinkedHashMap<>();
          var meta = rs.getMetaData();
          for (int i = 1; i <= meta.getColumnCount(); i++) {
            Object v = rs.getObject(i);
            if (v instanceof Timestamp t)
              v =
                  t.toInstant()
                      .atOffset(java.time.ZoneOffset.UTC)
                      .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"));
            if (v instanceof java.sql.Date d) v = d.toString();
            if (v instanceof Boolean b) v = b ? 1 : 0;
            row.put(meta.getColumnLabel(i), v);
          }
          return row;
        },
        args);
  }

  public Map<String, Object> one(String query, Object... args) {
    var rows = rows(query, args);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  public int update(String query, Object... args) {
    return jdbc.update(query, args);
  }

  public long id() {
    return jdbc.queryForObject("SELECT LAST_INSERT_ID()", Long.class);
  }
}
