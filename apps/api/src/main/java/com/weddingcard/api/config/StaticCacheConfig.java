package com.weddingcard.api.config;

import com.weddingcard.api.http.Json;
import jakarta.servlet.http.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.*;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;

@Configuration
public class StaticCacheConfig implements WebMvcConfigurer {
  private final StaticCacheHeaders headers;

  public StaticCacheConfig(Json json) {
    String version = "";
    Set<String> paths = Set.of();
    try (var input = getClass().getResourceAsStream("/static/static-asset-manifest.json")) {
      if (input != null) {
        var manifest = Json.map(json.parse(new String(input.readAllBytes(), StandardCharsets.UTF_8)));
        version = manifest.get("version").toString();
        var files = new HashSet<String>();
        for (var file : Json.list(manifest.get("paths"))) files.add(file.toString());
        paths = Set.copyOf(files);
      }
    } catch (Exception e) { throw new IllegalStateException("Cannot read static asset versions", e); }
    headers = new StaticCacheHeaders(version, paths);
  }

  @Override public void addInterceptors(InterceptorRegistry registry) {
    registry.addInterceptor(headers);
  }

  static final class StaticCacheHeaders implements HandlerInterceptor {
    private final String version;
    private final Set<String> paths;
    StaticCacheHeaders(String version, Set<String> paths) { this.version = version; this.paths = paths; }

    @Override public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
      String path = request.getRequestURI();
      if (!(handler instanceof ResourceHttpRequestHandler)
          || !(request.getMethod().equals("GET") || request.getMethod().equals("HEAD"))
          || !version.matches("[a-f0-9]{16}") || !version.equals(request.getParameter("v"))
          || !paths.contains(path) || path.endsWith(".html")
          || path.startsWith("/api/") || path.startsWith("/media/")) return true;
      response.setHeader("Cache-Control", "public,max-age=31536000,immutable");
      return true;
    }
  }
}
