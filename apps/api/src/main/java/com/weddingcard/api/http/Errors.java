package com.weddingcard.api.http;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestControllerAdvice
public class Errors {
  @ExceptionHandler(ApiError.class)
  ResponseEntity<?> error(ApiError e) {
    return ResponseEntity.status(e.status).body(Map.of("error", e.getMessage()));
  }

  @ExceptionHandler({
    org.springframework.http.converter.HttpMessageNotReadableException.class,
    org.springframework.web.multipart.MaxUploadSizeExceededException.class,
    org.springframework.web.bind.MissingServletRequestParameterException.class
  })
  ResponseEntity<?> invalid(Exception e) {
    return ResponseEntity.badRequest()
        .body(Map.of("error", "Dữ liệu không hợp lệ hoặc file quá lớn."));
  }

  @ExceptionHandler(Exception.class)
  ResponseEntity<?> unavailable(Exception e) {
    org.slf4j.LoggerFactory.getLogger(Errors.class).error("API request failed", e);
    return ResponseEntity.status(503)
        .body(Map.of("error", "Chưa thể xử lý yêu cầu. Vui lòng thử lại."));
  }
}
