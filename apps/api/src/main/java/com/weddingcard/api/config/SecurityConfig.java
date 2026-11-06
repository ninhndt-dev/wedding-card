package com.weddingcard.api.config;

import com.weddingcard.api.auth.service.AuthService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.filter.OncePerRequestFilter;

@Configuration
public class SecurityConfig {
  @Bean
  org.springframework.security.core.userdetails.UserDetailsService users() {
    return username -> {
      throw new org.springframework.security.core.userdetails.UsernameNotFoundException(username);
    };
  }

  @Bean
  SecurityFilterChain security(
      HttpSecurity http, AuthService auth, @Value("${app.origin}") String origin) throws Exception {
    var guard =
        new OncePerRequestFilter() {
          protected void doFilterInternal(
              HttpServletRequest req, HttpServletResponse res, FilterChain chain)
              throws ServletException, IOException {
            String path = req.getRequestURI();
            res.setHeader("X-Content-Type-Options", "nosniff");
            if (path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
            boolean write = !req.getMethod().equals("GET") && !req.getMethod().equals("HEAD");
            if (write && path.startsWith("/api/") && !origin.equals(req.getHeader("Origin"))) {
              reject(res, 403, "Nguồn gửi không hợp lệ.");
              return;
            }
            if (path.startsWith("/api/editor") || (path.equals("/api/admin") && !write)) {
              if (!auth.authenticated(req)) {
                reject(res, 401, "Vui lòng đăng nhập quản trị.");
                return;
              }
            }
            if (write
                && path.startsWith("/api/")
                && req.getContentType() != null
                && req.getContentType().contains("application/json")) {
              int limit = path.startsWith("/api/editor") ? 1048576 : 16384;
              byte[] body = req.getInputStream().readNBytes(limit + 1);
              if (body.length > limit) {
                reject(res, 413, "Nội dung quá dài.");
                return;
              }
              var wrapped =
                  new HttpServletRequestWrapper(req) {
                    public ServletInputStream getInputStream() {
                      var input = new java.io.ByteArrayInputStream(body);
                      return new ServletInputStream() {
                        public int read() {
                          return input.read();
                        }

                        public boolean isFinished() {
                          return input.available() == 0;
                        }

                        public boolean isReady() {
                          return true;
                        }

                        public void setReadListener(ReadListener r) {
                          throw new UnsupportedOperationException();
                        }
                      };
                    }

                    public int getContentLength() {
                      return body.length;
                    }

                    public long getContentLengthLong() {
                      return body.length;
                    }
                  };
              chain.doFilter(wrapped, res);
              return;
            }
            chain.doFilter(req, res);
          }
        };
    return http.csrf(c -> c.disable())
        .formLogin(c -> c.disable())
        .httpBasic(c -> c.disable())
        .logout(c -> c.disable())
        .sessionManagement(
            c ->
                c.sessionCreationPolicy(
                    org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(c -> c.anyRequest().permitAll())
        .addFilterBefore(guard, UsernamePasswordAuthenticationFilter.class)
        .headers(h -> h.frameOptions(f -> f.sameOrigin()))
        .build();
  }

  private static void reject(HttpServletResponse res, int status, String message)
      throws IOException {
    res.setStatus(status);
    res.setContentType("application/json;charset=UTF-8");
    res.getWriter().write("{\"error\":\"" + message + "\"}");
  }
}
