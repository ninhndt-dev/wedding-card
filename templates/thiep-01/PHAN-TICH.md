# Thiệp 01 — Minimalism Đỏ Đậm

## Nguồn tham chiếu

- https://chungdoi.com/vi/mau-thiep/minimalism-do-dam
- https://chungdoi.com/vi/mau-thiep/minimalism-do-dam/demo
- https://chungdoi.com/vi/mau-thiep/minimalism-do-dam/demo?open=1
- Ảnh toàn cảnh được trang giới thiệu liên kết: https://assets.chungdoi.com/template-showcase/vi/minimalism_darkred.7cbed48a.webp

## Đã xác minh từ nội dung trang

1. Màn chào tên đôi bạn, ngày cưới và nút mở thiệp.
2. Phần mở đầu Save the Date, phong bì lồng ảnh, con dấu trái tim vàng.
3. Thông tin lễ cưới: hai gia đình, tên đầy đủ, vai vế, giờ/ngày, ngày âm, địa điểm.
4. Album bảy ảnh; hộp xem ảnh có trước/sau, ảnh thu nhỏ và đóng.
5. Panel thông tin tiệc; giờ đón khách và khai tiệc.
6. Đếm ngược; lịch tháng đánh dấu ngày cưới; thêm lịch; xác nhận tham dự.
7. Địa điểm, bản đồ Google Maps và chỉ đường.
8. Dress code và lịch trình năm mốc giờ.
9. Sổ lưu bút có form và danh sách lời chúc.
10. Hộp quà mở modal thông tin hai tài khoản/QR, thao tác lưu QR.
11. Lời cảm ơn và nút điều khiển đóng modal.

Màu sắc được mô tả trên trang giới thiệu: đỏ burgundy, nền kem, điểm nhấn vàng. Họa tiết: mẫu đơn đỏ, dinh thự mờ, giấy, ruy băng.

## Chưa xác minh

Chưa tải được HTML nguyên bản, stylesheet, JavaScript bundle, font, ảnh và âm thanh. Công cụ đọc web cung cấp văn bản cùng liên kết, không phải toàn bộ mã nguồn. Chưa có ảnh chụp viewport để đo spacing, kích thước, màu hex, breakpoint, animation, thời gian chuyển cảnh. Không có source backend của nhà cung cấp và không suy đoán rằng có thể lấy source này từ URL công khai.

## Trạng thái bản dựng

Đã có khung FE/BE, SQLite, RSVP, quản trị và duyệt lời chúc. Giao diện hiện là bản dựng sơ bộ, chưa hoàn thành toàn bộ phần của mẫu tham chiếu. Không coi là clone chính xác hoặc hoàn thành. Tên/ngày/địa điểm là placeholder. Không dùng số tài khoản hoặc QR demo làm thông tin nhận tiền thật.

## Điều kiện nghiệm thu độ giống

Cần HTML/CSS/JS/assets tải hợp lệ hoặc ảnh chụp toàn trang và video tương tác của mẫu. Đối chiếu desktop và mobile cùng kích thước viewport, font/ảnh thực, từng section, trạng thái phong bì, mở album, RSVP, hộp quà và responsive. Chỉ đánh dấu đạt sau khi có bằng chứng đối chiếu. Không bảo đảm “100%” hoặc “1000%” từ văn bản trích xuất.

## Cập nhật sau khi bật Full access — 05/11/2026

Playwright đã chạy được qua Chromium headless. Trang mẫu trả HTTP 200. Đã lưu HTML sau render, 80 response tài nguyên (CSS, JS, font, ảnh/media), ảnh desktop 1440px, mobile 390px, màn mở đầu và sau mở thiệp trong `reference/`. Đây là mã/tài nguyên phía trình duyệt, không phải source backend. Các phần ghi chưa lấy được tài nguyên bên trên mô tả tình trạng trước khi cấp quyền.

Bố cục thực tế là một cột thiệp hẹp giữa nền trắng trên desktop, không phải trang landing hai cột. Ảnh desktop chụp có chiều cao tài liệu 6262px. Đã thao tác mở thiệp, mở RSVP và hộp quà, lưu ảnh trạng thái; không submit form. Lần thử click ảnh album chưa xác nhận được lightbox mở (nút đóng chưa visible), cần kiểm tra lại sau khi carousel ổn định. Không tuyên bố animation/album đã xác minh đầy đủ.

Dự án Next.js build thành công sau khi thêm SQLite busy timeout; ba bài kiểm tra auth, Origin và lưu bền dữ liệu đều đạt. Giao diện bản dựng chưa được cập nhật khớp toàn bộ mẫu và chưa đạt nghiệm thu so sánh ảnh.
