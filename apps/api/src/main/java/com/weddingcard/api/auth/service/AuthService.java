package com.weddingcard.api.auth.service;

import com.weddingcard.api.http.*;
import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
  private final Sql sql;
  private final String password;
  private final boolean secure;
  private long window = 0;
  private int attempts = 0;

  public AuthService(
      Sql sql,
      @Value("${app.admin-password}") String password,
      @Value("${app.session-secret}") String secret,
      @Value("${app.cookie-secure}") boolean secure) {
    if (password.length() < 12 || secret.length() < 32)
      throw new IllegalStateException("ADMIN_PASSWORD >=12 and SESSION_SECRET >=32 are required");
    this.sql = sql;
    this.password = password;
    this.secure = secure;
  }

  private String token(HttpServletRequest request) {
    if (request.getCookies() != null)
      for (var c : request.getCookies())
        if (c.getName().equals("wedding_admin")) return c.getValue();
    return "";
  }

  public boolean authenticated(HttpServletRequest request) {
    String t = token(request);
    return t.matches("[a-f0-9]{64}")
        && sql.one(
                "SELECT token_hash FROM admin_sessions WHERE token_hash=? AND"
                    + " expires>CURRENT_TIMESTAMP",
                Json.hash(t))
            != null;
  }

  public synchronized void login(String input, HttpServletResponse response) {
    long now = System.currentTimeMillis();
    if (now - window > 60000) {
      attempts = 0;
      window = now;
    }
    if (++attempts > 10) throw new ApiError(429, "Thử lại sau một phút.");
    if (!MessageDigest.isEqual(
        password.getBytes(StandardCharsets.UTF_8), input.getBytes(StandardCharsets.UTF_8)))
      throw new ApiError(401, "Mật khẩu không đúng.");
    byte[] bytes = new byte[32];
    new SecureRandom().nextBytes(bytes);
    String token = HexFormat.of().formatHex(bytes);
    sql.update("DELETE FROM admin_sessions WHERE expires<=CURRENT_TIMESTAMP");
    sql.update(
        "INSERT INTO admin_sessions(token_hash,expires)"
            + " VALUES(?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 8 HOUR))",
        Json.hash(token));
    cookie(response, token, 28800);
  }

  public void logout(HttpServletRequest request, HttpServletResponse response) {
    sql.update("DELETE FROM admin_sessions WHERE token_hash=?", Json.hash(token(request)));
    cookie(response, "", 0);
  }

  private void cookie(HttpServletResponse response, String value, long age) {
    response.addHeader(
        "Set-Cookie",
        ResponseCookie.from("wedding_admin", value)
            .httpOnly(true)
            .secure(secure)
            .sameSite("Strict")
            .path("/")
            .maxAge(age)
            .build()
            .toString());
  }
}
