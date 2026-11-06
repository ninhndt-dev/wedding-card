package com.weddingcard.api.guest.repository;

import com.weddingcard.api.http.*;
import java.util.*;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

@Repository
public class GuestRepository {
  private final Sql sql;

  public Sql sql() {
    return sql;
  }

  private final TransactionTemplate transaction;

  public GuestRepository(Sql sql, PlatformTransactionManager manager) {
    this.sql = sql;
    this.transaction = new TransactionTemplate(manager);
  }

  public Map<String, Object> store(
      String table, String key, String hash, String insert, Object... args) {
    try {
      return transaction.execute(
          status -> {
            var old =
                sql.one("SELECT id,payload_hash FROM " + table + " WHERE submission_key=?", key);
            if (old != null) return existing(old, hash);
            if (sql.one(
                    "SELECT id FROM "
                        + table
                        + " WHERE payload_hash=? AND created>DATE_SUB(CURRENT_TIMESTAMP,INTERVAL 1"
                        + " MINUTE)",
                    hash)
                != null)
              throw new ApiError(429, "Phản hồi này vừa được lưu. Vui lòng chờ một phút.");
            sql.update(insert, args);
            return Map.of("ok", true, "id", sql.id(), "created", true);
          });
    } catch (DuplicateKeyException e) {
      var old = sql.one("SELECT id,payload_hash FROM " + table + " WHERE submission_key=?", key);
      if (old == null) throw e;
      return existing(old, hash);
    }
  }

  private Map<String, Object> existing(Map<String, Object> old, String hash) {
    if (!hash.equals(old.get("payload_hash")))
      throw new ApiError(409, "Mã gửi đã được dùng với nội dung khác. Vui lòng tải lại trang.");
    return Map.of("ok", true, "id", old.get("id"), "created", false);
  }
}
