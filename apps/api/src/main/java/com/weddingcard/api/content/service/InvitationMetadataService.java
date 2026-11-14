package com.weddingcard.api.content.service;

import static com.weddingcard.api.http.Json.*;
import java.net.URI;
import java.util.*;
import java.util.regex.Matcher;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class InvitationMetadataService {
  private final String origin;

  public InvitationMetadataService(@Value("${app.origin}") String origin) {
    this.origin = origin.replaceAll("/+$", "");
  }

  public String render(String template, Map<String,Object> doc, String token) {
    var settings = map(doc.get("settings"));
    String title = "Thiệp cưới - " + settings.get("groom") + " & " + settings.get("bride");
    String description = "Trân trọng kính mời tới dự lễ cưới của " + settings.get("groom") + " & " + settings.get("bride") + ".";
    String canonical = origin + "/i/" + map(doc.get("site")).get("slug") + (token == null || token.isBlank() ? "" : "/" + token);
    String photo = Objects.toString(settings.get("photo"), "").trim();
    if (photo.isEmpty() && doc.get("album") instanceof List<?> album && !album.isEmpty())
      photo = Objects.toString(map(album.getFirst()).get("src"), "");
    if (photo.isEmpty()) photo = "/thiep-01/1793892037600-HIU_7932.webp";
    if (photo.matches("/media/[a-f0-9-]{36}\\.(jpg|png)")) photo += "?preview=1440";
    if (photo.startsWith("./")) photo = "/thiep-01/" + photo.substring(2);
    String image = URI.create(origin + "/").resolve(photo).toString();
    String tags = "<base href=\"/thiep-01/\">\n<link rel=\"canonical\" href=\"" + escape(canonical) + "\">\n"
        + meta("property", "og:type", "website") + meta("property", "og:locale", "vi_VN")
        + meta("property", "og:site_name", "Thiệp cưới") + meta("property", "og:url", canonical)
        + meta("property", "og:title", title) + meta("property", "og:description", description)
        + meta("property", "og:image", image) + meta("property", "og:image:alt", title)
        + (image.startsWith("https:") ? meta("property", "og:image:secure_url", image) : "")
        + meta("name", "description", description) + meta("name", "twitter:card", "summary_large_image")
        + meta("name", "twitter:title", title) + meta("name", "twitter:description", description)
        + meta("name", "twitter:image", image);
    return template
        .replaceAll("(?is)<meta\\b[^>]*(?:property|name)=[\"'](?:og:[^\"']+|twitter:[^\"']+|description)[\"'][^>]*>", "")
        .replaceAll("(?is)<link\\b[^>]*rel=[\"']canonical[\"'][^>]*>", "")
        .replaceAll("(?is)<title>.*?</title>", Matcher.quoteReplacement("<title>" + escape(title) + "</title>"))
        .replace("<head>", "<head>\n" + tags);
  }

  private static String meta(String attribute, String key, String value) {
    return "<meta " + attribute + "=\"" + key + "\" content=\"" + escape(value) + "\">\n";
  }

  static String escape(String value) {
    return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;");
  }
}
