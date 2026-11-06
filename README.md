# Ngày chung đôi — Thiệp cưới online

Frontend Next.js/React, backend Route Handlers, SQLite lưu bền vững. Node.js >=22.13.

## Chạy

```sh
npm install
cp .env.example .env.local
# Đặt ADMIN_PASSWORD tối thiểu 12 ký tự và SESSION_SECRET ngẫu nhiên tối thiểu 32 ký tự.
npm run dev
```

Thiệp: http://localhost:3100 • Dashboard: http://localhost:3100/admin

Tài khoản quản trị dùng mật khẩu trong `.env.local`. Không có mật khẩu mặc định. Có thể tạo khóa phiên bằng `openssl rand -hex 32`. Thiết lập hai biến môi trường tương tự khi chạy production.

## Chức năng

- Thiệp tiếng Việt responsive, đếm ngược theo giờ Việt Nam, đường dẫn bản đồ và tải lịch.
- RSVP có/không/chưa chắc, số người, số điện thoại tùy chọn, lời chúc.
- Lưu SQLite ở `data/wedding.sqlite`, tồn tại sau khởi động lại.
- Dashboard: thống kê, tìm kiếm, lọc, duyệt/ẩn lời chúc, xóa có xác nhận, xuất CSV chống formula injection.
- Chỉnh tên, thời gian, địa điểm, câu chuyện và ảnh qua dashboard.
- Cookie quản trị HttpOnly, SameSite Strict, Secure trong production, hết hạn sau 8 giờ; kiểm tra Origin cho thao tác ghi; SQL tham số hóa; lời chúc chỉ công khai sau duyệt. API công khai không trả số điện thoại hoặc trạng thái tham dự.

## Production

```sh
npm run build
npm start
```

Cần máy chủ Node.js với ổ đĩa bền vững và HTTPS reverse proxy. Nếu dùng Docker, mount volume `/app/data`; đặt ADMIN_PASSWORD, SESSION_SECRET trong secret/env của máy chủ. Cookie Secure cần truy cập HTTPS ở production. Chỉ chạy một instance với SQLite; sao lưu định kỳ bằng SQLite backup API hoặc dừng ứng dụng trước khi copy toàn bộ dữ liệu. Không đưa dữ liệu khách mời, env hay database vào Git. Giới hạn đăng nhập hiện áp dụng trong bộ nhớ một tiến trình; nên cấu hình rate limit tại reverse proxy khi mở public.

Dự án có tên/ngày/địa điểm mẫu cần thay trước khi gửi thiệp. Ảnh là URL HTTPS do quản trị viên cung cấp. Không có upload ảnh hoặc gửi email tự động. Mỗi lần khách gửi sẽ tạo một phản hồi riêng; có thể xóa phản hồi trùng trong dashboard. Chưa cấu hình hosting công khai. SQLite trên đĩa không phù hợp hosting Sites/Workers hoặc serverless với ổ đĩa tạm; cần chuyển database nếu triển khai lên các nền tảng đó.

## RSVP trên bản thiệp đã lưu từ MeliPage

Mở `/` hoặc `/thiep-01/index.html` qua server Next.js (không mở file `file://`). Bản thiệp được sao chép vào `public/thiep-01/`; file gốc trong Documents giữ nguyên. Form RSVP gửi `POST /api/rsvp`, lưu các cột riêng `side`, `event`, `message`; lời nhắn RSVP không phải lời chúc công khai.

Payload: `guestName` (1–100 ký tự), `willAttend` (boolean), `numberOfGuests` (số nguyên 1–50 nếu tham dự), `eventType` (`nhatrai`/`nhagai`), `eventName` (`Lễ nhà trai`/`Lễ nhà gái`/`Tiệc cưới`, bắt buộc nếu tham dự), `message` (tối đa 2.000 ký tự), `submissionId` (mã gửi ngẫu nhiên 16–80 ký tự).

Không tham dự được chuẩn hóa về số người 0 và không có sự kiện. Cùng mã gửi/cùng nội dung trả thành công mà không tạo thêm bản ghi; cùng mã/nội dung khác trả 409. Phản hồi hoàn toàn giống nhau trong một phút trả 429. Schema nâng cấp bằng cách thêm cột, không xóa dữ liệu cũ. Dashboard lọc theo bên khách, sự kiện và xuất CSV gồm các trường mới. Chưa có chức năng tự cập nhật phản hồi cũ khi khách đổi ý; phản hồi mới là bản ghi mới.

Mật khẩu quản trị local lần đầu nằm trong `.local/admin-access.md` (bị Git bỏ qua); biến môi trường ở `.env.local`. Thông tin thiệp được tải từ `/api/content`; chỉnh trong dashboard sẽ cập nhật tên, ngày/giờ lễ nhà trai, địa điểm nhà trai, lời giới thiệu và ảnh chú rể. Hai nút quà mừng đang hiển thị trạng thái chưa cập nhật, chờ chủ thiệp cung cấp QR. Lời chúc đã chuyển sang `/api/wishes` và chỉ công khai sau khi duyệt. Ảnh, font, nhạc và tài nguyên album đã được bổ sung để chạy local. Không thay file gốc trong Documents.

## Kiểm tra tự động

```sh
npm test
npm run build
# Trong terminal khác, khởi động server trước:
npm run dev
# Một lần khi máy chưa có Chromium:
npx playwright install chromium
# Từ terminal kiểm tra:
npm run test:e2e
```

`test:e2e` dùng Playwright, đăng nhập bằng ADMIN_PASSWORD trong `.env.local`, chạy trên `http://127.0.0.1:3100` (có thể đổi E2E_ORIGIN), kiểm tra desktop/mobile, các thao tác UI/API, duyệt/ẩn lời chúc, CSV, thông tin riêng, xử lý lỗi và chỉnh thông tin thiệp. Test tạo dữ liệu mang tiền tố QA-FULL riêng, xóa các dữ liệu đó và khôi phục cấu hình thiệp trong finally. Chỉ chạy với môi trường local/test. Báo cáo nằm ở `.local/full-verification.json`. Trên máy cần executable Chromium khác, đặt PLAYWRIGHT_CHROMIUM_EXECUTABLE.

## Trình chỉnh sửa Thiệp 01

Mở `http://127.0.0.1:3100/admin/editor`, dùng cùng mật khẩu quản trị. Dashboard cũng có nút mở trình chỉnh sửa.

- **Thông tin chung**: tên đôi bạn, lời giới thiệu, ảnh chú rể, tên bố mẹ.
- **Mở thiệp**: bật/tắt, lời mời, người nhận, chữ nút, nền và sáu ảnh trang trí phong bì.
- **Hai lễ cưới**: ngày/giờ UTC+7, địa điểm, địa chỉ, link bản đồ và ngày âm riêng từng bên. Ngày âm là nội dung nhập tay.
- **Thành phần**: bấm trực tiếp hoặc tìm trong 95 thành phần gốc; sửa chữ, ảnh, link, màu, font, cỡ, vị trí, lớp, viền, góc xoay, khoảng cách, hiệu ứng; kéo để di chuyển; ẩn/xóa/khôi phục. Thêm chữ, ảnh, nút hoặc hình mới. Lịch trình chỉnh bằng các ô chữ trong mục này.
- **Ảnh & album**: tải ảnh, thay ảnh, chú thích, thêm/xóa và sắp xếp; album lớn dùng cùng ảnh đã chọn.
- **Biểu mẫu**: tiêu đề, hướng dẫn, chữ nút, placeholder, danh sách sự kiện RSVP; backend chỉ nhận các sự kiện đã áp dụng.
- **Nhạc & quà mừng**: tải nhạc, bật/tắt, QR và thông tin ngân hàng mỗi bên. Có thể chỉ nhập ngân hàng khi chưa có QR.
- **Màu & trang trí**: màu chủ đạo/nền, giữ font gốc hoặc font chung/tải font, chiều cao thiệp.
- **Lịch sử**: xem và khôi phục một lần áp dụng cũ vào nháp. Có hoàn tác/làm lại trong phiên chỉnh sửa.

**Lưu bản nháp** chỉ lưu cho quản trị. **Áp dụng lên thiệp** lưu và đưa bản đó lên đường dẫn thiệp hiện tại; việc này không tạo hosting công khai. Có kiểm tra revision để tránh ghi đè giữa hai cửa sổ. Trước khi rời trang khi còn thay đổi chưa lưu, trình duyệt hiển thị cảnh báo.

SQLite tự thêm bảng `editor_documents` (nháp, bản đang áp dụng, revision), `editor_versions` (lịch sử), `media_assets` (thông tin file). File ở `data/uploads/`, phục vụ qua `/media/<uuid>.<ext>`. Sao lưu cả database và thư mục uploads. Ảnh tối đa 8 MB; nhạc 20 MB; font 3 MB. Hỗ trợ PNG/JPG/WebP/GIF, MP3/M4A/WAV/OGG, TTF/OTF/WOFF2; từ chối SVG/HTML. Không sửa file gốc trong Documents.

Chạy `npm run test:editor` khi server local đang chạy để kiểm tra toàn luồng chỉnh/sửa/tải file/lưu nháp/áp dụng/khôi phục/RSVP tùy chỉnh. Test khôi phục trạng thái database trước đó và xóa tài nguyên thử, trừ khi phát hiện một cửa sổ khác vừa lưu đồng thời. Báo cáo: `.local/editor-verification.json`.

## Hiệu ứng mở thiệp

Chuyển động được điều khiển trong `public/thiep-01/opening-motion.js` và `opening-motion.css`: một luồng mở duy nhất, hai phần phong bì tách theo đường con dấu rồi mờ dần trong khoảng 1,2 giây. Không chờ animationend từ chi tiết con; có thời gian dự phòng để mở khóa cuộn. Hỗ trợ prefers-reduced-motion (chỉ mờ nhanh), Escape khi đang mở, khôi phục cuộn và xem lại trong editor. Không dịch chuyển toàn bộ canvas thiệp dài. Chạy `npm run test:motion` với server local đang bật; báo cáo `.local/opening-verification.json`.

## Studio theo thư viện thành phần

`/admin/editor` có thanh công cụ **Thành phần / Stock / Preset / Nền / Hiệu ứng / Media / Preview / Thống kê / Cài đặt**, cùng mục Hỗ trợ.

- 27 ô thành phần: văn bản, H1/H2/H3, đoạn văn, ảnh, album, video MP4, biểu tượng, hình dạng, mạng xã hội; nút, thu gọn/xem thêm, chỉ đường, bản đồ Google, lịch, gọi điện, chat qua link, đếm ngược; sổ lưu bút, RSVP, tên khách, đăng ký, đặt hàng, đăng nhập quản trị, quà mừng và lịch trình. Chọn khối để sửa cấu hình và bố cục ở Thuộc tính.
- Stock dùng các ảnh trang trí đã có trong dự án. Media cho tải nhiều file, xem ảnh có sẵn, nhãn đã dùng, thêm lên thiệp và dọn file chưa sử dụng. File thuộc bản nháp, bản đã áp dụng, lịch sử hoặc preset được bảo vệ. Video MP4 tối đa 20 MB.
- Preset có bốn bảng màu và lưu/nạp/xóa các bản mẫu của riêng bạn. Thao tác dùng preset chỉ thay bản nháp.
- Hiệu ứng cho bật/tắt biểu tượng bay, đổi biểu tượng, mở mục phong bì và đổi màu toàn thiệp. Nền cho chọn màu/ảnh nền.
- Cài đặt có tên khách mặc định, slug, tự chạy nhạc sau thao tác mở thiệp, phóng to trên màn PC và QR chia sẻ xuất PNG. Link `/i/<slug>?guest=<tên>` dùng slug **đã áp dụng**. Link trên localhost chỉ mở ở máy hiện tại; khi hosting có domain, QR dùng origin domain đó.
- Preview trên editor có thử nút/video/thu gọn nhưng chặn gửi form. `/admin/preview` mở bản nháp đã lưu ở tab riêng, cần đăng nhập.
- Khối đăng nhập dùng mật khẩu quản trị hiện có, không tạo tài khoản khách hay lưu mật khẩu trong dữ liệu biểu mẫu.
- Khối đăng ký và đặt hàng dùng `POST /api/submissions`, chỉ nhận widget đã áp dụng và đang hiển thị; chống gửi trùng, kiểm tra dữ liệu. Đặt hàng là yêu cầu để chủ thiệp xác nhận; không xử lý thanh toán. Giá/tổng tiền được tính ở backend từ cấu hình widget, không nhận giá từ khách.
- Thống kê gồm lượt xem/khách truy cập, RSVP, lời chúc, đăng ký/đặt hàng; đổi trạng thái/xóa và xuất CSV. Tối đa 500 đăng ký/đặt hàng gần nhất trong một lần tải. Lượt xem local bao gồm các lần mở thử trang; chế độ chỉnh sửa không tính lượt xem. Không lưu địa chỉ IP, chỉ mã khách băm và ngày để tính lượt xem.

Bảng bổ sung: `editor_presets`, `visit_events`, `widget_submissions`. Nội dung cũ được nâng cấp với giá trị mặc định khi đọc, không xóa bản nháp hoặc lịch sử hiện có.

`npm run test:studio` kiểm tra thư viện, media, preset, hiệu ứng, QR, slug, video thực, tương tác, đăng ký/đặt hàng, đăng nhập và thống kê. Báo cáo `.local/studio-verification.json`. Lần chạy đầu có thể tải video mẫu từ Mozilla vào `.local/test-flower.mp4`; dùng `STUDIO_VIDEO_FIXTURE` để chỉ định video MP4 sẵn có. Test khôi phục bản nháp/bản đang áp dụng và dọn dữ liệu của chính nó, tránh ghi đè khi phát hiện phiên lưu khác.
