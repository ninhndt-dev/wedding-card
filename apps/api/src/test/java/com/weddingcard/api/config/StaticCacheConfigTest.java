package com.weddingcard.api.config;

import static org.junit.jupiter.api.Assertions.*;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.*;
import org.springframework.web.servlet.resource.ResourceHttpRequestHandler;

class StaticCacheConfigTest {
  private final String version = "0123456789abcdef";
  private final StaticCacheConfig.StaticCacheHeaders headers = new StaticCacheConfig.StaticCacheHeaders(version,
      Set.of("/thiep-01/opening-motion.js", "/audio/music.mp3", "/api/admin", "/thiep-01/index.html"));

  @Test void cachesOnlyKnownVersionedStaticResources() throws Exception {
    var request = new MockHttpServletRequest("GET", "/thiep-01/opening-motion.js");
    request.setParameter("v", version);
    var response = new MockHttpServletResponse();
    headers.preHandle(request, response, new ResourceHttpRequestHandler());
    assertEquals("public,max-age=31536000,immutable", response.getHeader("Cache-Control"));
    assertEquals("public,max-age=31536000,immutable", response.getHeader("Vercel-CDN-Cache-Control"));
  }

  @Test void neverCachesHtmlApiOrUnknownAssetVersions() throws Exception {
    for (String path : Set.of("/api/admin", "/thiep-01/index.html", "/missing.js")) {
      var request = new MockHttpServletRequest("GET", path);
      request.setParameter("v", version);
      var response = new MockHttpServletResponse();
      headers.preHandle(request, response, new ResourceHttpRequestHandler());
      assertNull(response.getHeader("Cache-Control"));
    }
    var request = new MockHttpServletRequest("GET", "/audio/music.mp3");
    request.setParameter("v", "old-version");
    var response = new MockHttpServletResponse();
    headers.preHandle(request, response, new ResourceHttpRequestHandler());
    assertNull(response.getHeader("Cache-Control"));
    request.setParameter("v", version);
    headers.preHandle(request, response, new Object());
    assertNull(response.getHeader("Cache-Control"));
  }
}
