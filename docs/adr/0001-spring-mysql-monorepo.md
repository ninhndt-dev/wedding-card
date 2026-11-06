# 0001 · Spring Boot, React TypeScript và MySQL

Ngày: 2026-11-06. Trạng thái: đã thực hiện.

Dự án chuyển từ Next.js Route Handlers + SQLite sang Spring Boot + MySQL theo yêu cầu. Bố cục theo capmony: `apps/api`, `apps/web`, `infra`, `docs`; backend chia theo feature, frontend theo feature.

API dùng Java 25, Spring Boot 4.1, Spring Security, Spring JDBC, Flyway và MySQL Connector. JDBC phù hợp với các truy vấn dashboard và tài liệu JSON của editor; schema quản lý bằng migration thay vì tự sửa lúc xử lý request. Transaction khóa dòng editor khi lưu, áp dụng, preset và dọn media. Idempotency dùng unique key trong MySQL và xử lý trường hợp hai request đồng thời.

Web dùng React + TypeScript + Vite. Model tài liệu, guest và editor state có type chung. Các panel của editor cũ tiếp tục có một số prop động (`any`) và chưa bật TypeScript strict toàn bộ; không dùng `ts-nocheck`. Vite proxy giữ nguyên API contract và URL thiệp, tránh thay runtime mẫu 01 trong lần chuyển backend.

Tài liệu mẫu/manifest/catalog nằm ở `shared`, đóng vào JAR khi build và được web import. Ảnh/font/nhạc mẫu nằm ở `apps/web/public`; upload mới do Spring phục vụ từ thư mục bền vững riêng. Database và upload không được commit.

Migration SQLite là công cụ offline, có checksum, transaction và ledger, chỉ nhập vào database trống. SQLite được giữ làm bản sao, không còn là database runtime. Kiểm thử tích hợp dùng MySQL thực trong schema riêng.
