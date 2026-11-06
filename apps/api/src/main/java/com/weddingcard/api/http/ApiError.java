package com.weddingcard.api.http;

public class ApiError extends RuntimeException {
  public final int status;

  public ApiError(int status, String message) {
    super(message);
    this.status = status;
  }

  public static ApiError bad() {
    return new ApiError(400, "Dữ liệu không hợp lệ.");
  }
}
