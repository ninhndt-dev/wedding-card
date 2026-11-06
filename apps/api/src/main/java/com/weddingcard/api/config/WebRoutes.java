package com.weddingcard.api.config;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
public class WebRoutes {
  @GetMapping({"/admin", "/admin/invitations", "/admin/editor", "/admin/preview"})
  public String app() {
    return "forward:/index.html";
  }
}
