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
- Danh sách thiệp khách mời: http://127.0.0.1:3100/admin/invitations

Đăng nhập bằng `ADMIN_PASSWORD` trong `.env.local`. MySQL mở local ở `127.0.0.1:3308`. API và frontend dùng chung origin qua Vite proxy; truy cập đúng `APP_ORIGIN` đã cấu hình.

Chạy riêng: `npm run db:up`, `npm run dev:api`, `npm run dev:web`. Dừng MySQL: `npm run db:down` (giữ volume).

## Chức năng

Giữ mẫu thiệp 01 và hiệu ứng mở thiệp, chỉnh sửa nội dung/ảnh/nhạc/font, 27 loại thành phần, kéo thả, undo/redo, album, quà mừng và QR, nền/hiệu ứng, link cá nhân hóa khách mời, xem trước mobile/desktop. Bản nháp tách khỏi bản công khai; áp dụng tạo lịch sử; revision ngăn ghi đè giữa nhiều cửa sổ.

RSVP xác nhận tham dự bằng nút bấm, giữ tên và số người tham dự; bên gia đình lấy theo thiệp, không yêu cầu chọn lễ hay nhập lời nhắn. Lời chúc chờ admin duyệt. Dashboard tìm/lọc, duyệt/ẩn, xóa, xuất CSV; thống kê lượt xem và biểu mẫu. Đăng ký/đặt hàng lưu MySQL; giá lấy từ cấu hình đã áp dụng. Chưa tích hợp thanh toán. QR quà mừng có thể thêm sau trong editor.

Session admin là token ngẫu nhiên, chỉ lưu hash trong MySQL; cookie HttpOnly, SameSite Strict, 8 giờ. Kiểm tra Origin cho mọi API ghi. File được kiểm tra signature và dung lượng; giữ file đang được dùng trong nháp hoặc bản công khai. Xóa file chỉ còn trong lịch sử/preset sẽ gỡ khỏi Media và giữ bản gốc để khôi phục; khôi phục phiên bản sẽ đưa file trở lại Media. File hoàn toàn không được tham chiếu sẽ bị xóa cùng các bản ảnh xem. Lời nhắn RSVP không xuất hiện ở API công khai.

## Thiệp riêng cho khách mời

Đăng nhập quản trị rồi mở **Danh sách thiệp khách mời**. Tải file CSV hoặc Excel `.xlsx` có hàng tiêu đề và cột tên khách (ví dụ `Tên khách / đại diện gia đình`). Các cột tùy chọn gồm điện thoại, bên mời, sự kiện, số người được mời và ghi chú. Mỗi dòng tạo một thiệp riêng, kể cả trùng tên và trùng bên mời. Nhập thêm file sẽ thêm thiệp mới; dùng Xóa danh sách thiệp để làm lại từ đầu. Có thể thêm khách, sửa thông tin, sao chép link và xuất danh sách CSV.

Mỗi link có mã riêng để gắn lượt xem, RSVP, lời chúc và biểu mẫu đăng ký/đặt hàng với đúng thiệp. Danh sách hiển thị phản hồi mới nhất và giữ lịch sử các lần gửi. Link `?guest=` cũ vẫn hoạt động nhưng không gắn phản hồi vào một thiệp riêng.

Nếu đặt **Số người được mời** lớn hơn 0 cho một thiệp, biểu mẫu RSVP sẽ hiển thị giới hạn đó và API từ chối số người tham dự vượt giới hạn. Giá trị 0 nghĩa là chưa đặt giới hạn riêng.

## Kiểm tra

Editor local và Docker Compose giữ nguyên file ảnh tải lên, không nén hoặc giảm kích thước; hỗ trợ ảnh tối đa 32 MiB. Giới hạn upload trên Vercel vẫn là 4 MiB theo cấu hình container bên dưới.

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

### Vercel (một container, gói miễn phí)

`Dockerfile.vercel` đóng frontend Vite và Spring Boot vào cùng một container. Vercel chạy container theo request; không dùng volume bền vững. Ảnh tải lên qua editor được lưu trong cột `media_assets.content` của MySQL (Flyway V3). Ảnh mẫu vẫn được đóng trong frontend. Đây là lựa chọn cho thiệp cá nhân ít lượt xem; tổng ảnh upload và dữ liệu phải nằm trong giới hạn của MySQL Free.

Cần một MySQL 8 online hỗ trợ TLS, ví dụ Aiven MySQL Free (1 GB). Tạo database trước, sao lưu và nhập dữ liệu `wedding_card` hiện tại nếu muốn giữ nội dung/khách mời/phản hồi. Không dùng `.env.local` làm cấu hình production. Trong Vercel, đặt riêng các biến `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `APP_ORIGIN`, `ADMIN_PASSWORD`, `SESSION_SECRET`. `APP_ORIGIN` là URL HTTPS production chính xác; `SESSION_SECRET` tối thiểu 32 ký tự. Container đã đặt `COOKIE_SECURE=true`, `DB_SSL_MODE=REQUIRED` (TLS bắt buộc theo ví dụ JDBC của Aiven), giới hạn upload 4 MiB và pool MySQL tối đa bốn kết nối mỗi instance. Nếu dùng `VERIFY_IDENTITY`, cần cấu hình thêm CA của Aiven vào Java truststore. Không đưa mật khẩu vào Git hay chat.

Sau khi deploy, kiểm tra `/api/health`, `/thiep-01/index.html`, `/admin`, một link `/i/{slug}/{token}`, RSVP và ảnh upload. Ảnh lớn hơn 4 MiB không upload được trên Vercel. Gói Hobby có hạn mức; khi chạm hạn mức dịch vụ có thể ngừng phục vụ đến chu kỳ tiếp theo, không tự chuyển sang gói trả phí. Không bật Pro hoặc tài nguyên trả phí nếu cần giữ chi phí bằng 0.

### Docker Compose

`npm run build` tạo frontend `apps/web/dist` và JAR `apps/api/target/wedding-api-1.0.0-SNAPSHOT.jar`. Có thể chạy JAR qua `node infra/scripts/api.mjs --jar`, phục vụ frontend bằng nginx, proxy `/api`, `/media`, `/i/` tới Spring.

Hoặc dùng file Compose production (Docker Compose V2):

```sh
docker compose --env-file .env.local -f infra/compose.yaml -f infra/compose.production.yaml up -d --build
```

Đặt `APP_ORIGIN` thành URL HTTPS thật và `COOKIE_SECURE=true` khi đặt sau HTTPS reverse proxy. Thư mục upload và MySQL dùng volume bền vững; sao lưu cả hai. Bật TLS cho kết nối MySQL từ xa. Không đưa `.env`, export hoặc dữ liệu khách mời lên Git. Giới hạn đăng nhập hiện nằm trong bộ nhớ một API instance; triển khai nhiều instance cần rate limit chung tại proxy.

### Bữa cơm thân mật và bên mời

Trong editor, mục **Cài đặt → Lịch & sự kiện** cho chỉnh ngày bữa cơm, giờ và địa điểm riêng của nhà trai/nhà gái. Để trống địa điểm hoặc địa chỉ bữa cơm sẽ dùng thông tin lễ cưới của bên tương ứng. Bộ chọn **Thiệp nhà trai / Thiệp nhà gái** phía trên khung xem trước giúp kiểm tra hai cách hiển thị.

File tải để import chỉ gồm hai cột, các thông tin khác bổ sung sau trong trang quản trị. Trong danh sách thiệp khách mời, nhập CSV/XLSX có cột **Tên khách** và **Bên mời** (`Nhà trai` hoặc `Nhà gái`); có nút **Tải CSV để import** (tải danh sách hiện tại để chỉnh sửa; nếu chưa có khách thì dùng dòng mẫu) và mẫu tại `docs/examples/khach-moi.csv`. Bên mời được lưu theo từng khách, không lấy từ tên khách hoặc từ một tham số công khai. Các dòng trùng tên được giữ riêng với link khác nhau. Muốn đổi thông tin một thiệp, dùng nút Sửa trên đúng dòng đó; muốn nhập lại từ đầu thì xóa danh sách cũ trước. Thiệp cũ chưa có bên mời mặc định dùng nhà trai. Không nhập dữ liệu khách thật vào Git.
