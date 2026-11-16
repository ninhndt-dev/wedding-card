package com.weddingcard.api.content.service;

import static com.weddingcard.api.http.Json.*;
import java.net.URI;
import java.util.*;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@Service
public class InvitationMetadataService {
  private final String origin;
  private static final Pattern OLD_META = Pattern.compile("<meta\\b[^>]*(?:property|name)=[\"'](?:og:[^\"']+|twitter:[^\"']+|description)[\"'][^>]*>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
  private static final Pattern OLD_CANONICAL = Pattern.compile("<link\\b[^>]*rel=[\"']canonical[\"'][^>]*>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
  private static final Pattern OLD_TITLE = Pattern.compile("<title>.*?</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
  private static final Pattern HEAD = Pattern.compile("<head>", Pattern.CASE_INSENSITIVE);
  public record Template(String prefix, String body) {}
  private record Details(Map<String,Object> document, String title, String description, String canonical, String image) {}
  private volatile Details details;

  public InvitationMetadataService(@Value("${app.origin}") String origin) {
    this.origin = origin.replaceAll("/+$", "");
  }

  public String render(String template, Map<String,Object> doc, String token) {
    return render(prepare(template), doc, token);
  }

  public Template prepare(String source) {
    String clean = OLD_TITLE.matcher(OLD_CANONICAL.matcher(OLD_META.matcher(source).replaceAll("")).replaceAll("")).replaceAll("");
    var head = HEAD.matcher(clean);
    if (!head.find()) throw new IllegalArgumentException("Invitation template has no head");
    return new Template(clean.substring(0, head.end()), clean.substring(head.end()));
  }

  private Details details(Map<String,Object> doc) {
    var current = details;
    if (current != null && current.document() == doc) return current;
    var settings = map(doc.get("settings"));
    String title = (settings.get("groom") + " & " + settings.get("bride") + " WEDDING").toUpperCase(Locale.forLanguageTag("vi"));
    String description = "Trân trọng kính mời Quý Khách đến dự và chung vui cùng gia đình chúng tôi!";
    String canonical = origin + "/i/" + map(doc.get("site")).get("slug");
    String photo = "";
    if (doc.get("album") instanceof List<?> album && !album.isEmpty())
      photo = Objects.toString(map(album.getFirst()).get("src"), "").trim();
    if (photo.isEmpty()) photo = Objects.toString(settings.get("photo"), "").trim();
    if (photo.isEmpty()) photo = "/thiep-01/1793892037600-HIU_7932.webp";
    if (photo.matches("/media/[a-f0-9-]{36}\\.(jpg|png)")) photo += "?preview=1440";
    if (photo.startsWith("./")) photo = "/thiep-01/" + photo.substring(2);
    String image = URI.create(origin + "/").resolve(photo).toString();
    var result = new Details(doc, title, description, canonical, image);
    details = result;
    return result;
  }

  public String render(Template template, Map<String,Object> doc, String token) {
    var data = details(doc);
    String title = data.title(), description = data.description(), image = data.image();
    String canonical = data.canonical() + (token == null || token.isBlank() ? "" : "/" + token);
    String tags = "<title>" + escape(title) + "</title>\n<base href=\"/thiep-01/\">\n<link rel=\"canonical\" href=\"" + escape(canonical) + "\">\n"
        + meta("property", "og:type", "website") + meta("property", "og:locale", "vi_VN")
        + meta("property", "og:site_name", "Thiệp cưới") + meta("property", "og:url", canonical)
        + meta("property", "og:title", title) + meta("property", "og:description", description)
        + meta("property", "og:image", image) + meta("property", "og:image:alt", title)
        + (image.startsWith("https:") ? meta("property", "og:image:secure_url", image) : "")
        + meta("name", "description", description) + meta("name", "twitter:card", "summary_large_image")
        + meta("name", "twitter:title", title) + meta("name", "twitter:description", description)
        + meta("name", "twitter:image", image);
    return template.prefix() + "\n" + tags + template.body();
  }

  private static String meta(String attribute, String key, String value) {
    return "<meta " + attribute + "=\"" + key + "\" content=\"" + escape(value) + "\">\n";
  }

  static String escape(String value) {
    return value.replace("&", "&amp;").replace("\"", "&quot;").replace("<", "&lt;").replace(">", "&gt;").replace("'", "&#39;");
  }
}
