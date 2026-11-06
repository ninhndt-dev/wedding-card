# Wedding Card · Thiệp cưới online

Backend **Java 25 / Spring Boot 4.1**, frontend **React / TypeScript / Vite**, database **MySQL 8.4**. Cấu trúc theo dự án capmony.

```text
apps/
  api/                 # Spring Boot, Maven
    src/main/java/com/weddingcard/api/
      admin/           # Quản lý khách mời
      auth/service/    # Phiên đăng nhập admin
      editor/          # controller, service, repository, model
      guest/           # RSVP, lời chúc, đăng ký, đặt hàng
      media/           # Upload, đọc và dọn file
      statistics/      # Thống kê
      content/         # Thiệp công khai và link chia sẻ
      config/          # Security, Origin
      http/            # JSON, SQL, xử lý lỗi chung
      migration/       # Nhập dữ liệu SQLite cũ
    src/main/resources/db/migration/
    src/test/
  web/
    src/features/      # admin, editor, preview
    src/lib/           # Model TypeScript, catalog
    public/            # Mẫu thiệp 01, ảnh, nhạc, font
shared/                # Mẫu mặc định, manifest, catalog dùng chung
infra/
  compose.yaml         # MySQL local
  compose.production.yaml
  nginx.conf
  scripts/             # Chạy, kiểm thử, chuyển dữ liệu
docs/                  # Quyết định kiến trúc và yêu cầu
 tests/                 # Playwright + kiểm tra MySQL thực
```

## Chạy local

Cần Node.js >=22.13, JDK 25, Maven 3.9, Docker hoặc Colima đã bật.

```sh
npm ci
cp .env.example .env.local
# Đổi ADMIN_PASSWORD, SESSION_SECRET, DB_PASSWORD, MYSQL_ROOT_PASSWORD.
# ADMIN_PASSWORD >=12 ký tự; SESSION_SECRET >=32 ký tự.
npm run dev
```

`npm run dev` khởi động MySQL, Spring ở `8086`, Vite ở `3100`. Script hỗ trợ cả `docker compose` và `docker-compose`; tự nhận socket Colima khi có.

- Thiệp: http://127.0.0.1:3100/thiep-01/index.html
- Admin: http://127.0.0.1:3100/admin
- Chỉnh sửa: http://127.0.0.1:3100/admin/editor
- Health: http://127.0.0.1:3100/api/health

Đăng nhập bằng `ADMIN_PASSWORD` trong `.env.local`. MySQL mở local ở `127.0.0.1:3308`. API và frontend dùng chung origin qua Vite proxy; truy cập đúng `APP_ORIGIN` đã cấu hình.

Chạy riêng: `npm run db:up`, `npm run dev:api`, `npm run dev:web`. Dừng MySQL: `npm run db:down` (giữ volume).

## Chức năng

Giữ mẫu thiệp 01 và hiệu ứng mở thiệp, chỉnh sửa nội dung/ảnh/nhạc/font, 27 loại thành phần, kéo thả, undo/redo, album, quà mừng và QR, nền/hiệu ứng, link cá nhân hóa khách mời, xem trước mobile/desktop. Bản nháp tách khỏi bản công khai; áp dụng tạo lịch sử; revision ngăn ghi đè giữa nhiều cửa sổ.

RSVP lưu có/không dự, số khách, bên gia đình, sự kiện và lời nhắn riêng. Lời chúc chờ admin duyệt. Dashboard tìm/lọc, duyệt/ẩn, xóa, xuất CSV; thống kê lượt xem và biểu mẫu. Đăng ký/đặt hàng lưu MySQL; giá lấy từ cấu hình đã áp dụng. Chưa tích hợp thanh toán. QR quà mừng có thể thêm sau trong editor.

Session admin là token ngẫu nhiên, chỉ lưu hash trong MySQL; cookie HttpOnly, SameSite Strict, 8 giờ. Kiểm tra Origin cho mọi API ghi. File được kiểm tra signature và dung lượng; giữ file đang được dùng trong nháp, bản công khai, lịch sử hoặc preset. Lời nhắn RSVP không xuất hiện ở API công khai.

## Kiểm tra

```sh
npx playwright install chromium
npm run typecheck
npm run build
npm test
```

`npm test` tạo và reset **chỉ** schema `wedding_card_test`, chạy Spring `8087` và Vite `3101`, kiểm tra bằng Playwright và truy vấn MySQL thực. Dữ liệu thiệp thật trong `wedding_card` không bị sửa. Kết quả và ảnh kiểm tra nằm trong `.local/`.

## Chuyển dữ liệu cũ từ SQLite

Thực hiện một lần vào database MySQL trống. Giữ bản sao SQLite và export ở nơi riêng tư.

```sh
node infra/scripts/export-sqlite.mjs data/wedding.sqlite /absolute/private/export.json
node infra/scripts/import-legacy.mjs /absolute/private/export.json
# Khi thấy Legacy import verified and completed: dừng tiến trình rồi npm run dev.
```

Importer xác minh checksum, chạy transaction, giữ ID, kiểm tra database đích trống và ghi ledger để chạy lại cùng export không nhập trùng. Không có endpoint nhập dữ liệu công khai. Upload cũ giữ trong `data/uploads`.

## Production

`npm run build` tạo frontend `apps/web/dist` và JAR `apps/api/target/wedding-api-1.0.0-SNAPSHOT.jar`. Có thể chạy JAR qua `node infra/scripts/api.mjs --jar`, phục vụ frontend bằng nginx, proxy `/api`, `/media`, `/i/` tới Spring.

Hoặc dùng file Compose production (Docker Compose V2):

```sh
docker compose --env-file .env.local -f infra/compose.yaml -f infra/compose.production.yaml up -d --build
```

Đặt `APP_ORIGIN` thành URL HTTPS thật và `COOKIE_SECURE=true` khi đặt sau HTTPS reverse proxy. Thư mục upload và MySQL dùng volume bền vững; sao lưu cả hai. Bật TLS cho kết nối MySQL từ xa. Không đưa `.env`, export hoặc dữ liệu khách mời lên Git. Giới hạn đăng nhập hiện nằm trong bộ nhớ một API instance; triển khai nhiều instance cần rate limit chung tại proxy.
