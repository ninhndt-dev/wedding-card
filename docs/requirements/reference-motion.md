# Hiệu ứng theo video tham chiếu

Tham chiếu: Screen Recording 2026-11-09 at 23.48.51.mov (55,73 giây, 494 × 1058, 60 fps), đối chiếu với file preview HTML gốc đã lưu trên máy.

- Màn mở dùng hai lớp phong bì nguyên vẹn, trượt theo trục dọc tới -115% và +115%, 1000 ms, cubic-bezier(.22,.61,.36,1). Nền giấy giữ nguyên đến khi kết thúc. Không lật nắp hay kéo con dấu riêng.
- Con dấu nhịp 900 ms, scale 1 → 1.12 → 1. Nút gợi ý nhịp 700 ms, opacity .25 → 1 → .25, scale 1 → 1.08 → 1.
- Các khối giữ nguyên preset, thời lượng, delay, easing, khoảng cách và vòng lặp từ preview gốc. Fixture `tests/fixtures/invitation-motion.json` ghi metadata để đối chiếu bằng Playwright.
- Hiệu ứng cuộn bắt đầu khi khối đi vào vùng quan sát (rootMargin đáy -12%, threshold .08/.15/.22), khởi động một lần cho mỗi node. Album dựng lại sau khi tải dữ liệu cũng được quan sát; các ảnh giữ đúng hướng trái/phải của mẫu.
- Dấu tim ở ngày cưới giữ nhịp 1200 ms. Các nút có preset heartBeat tiếp tục lặp theo thông số gốc.
- Hiệu ứng rơi mặc định giữ 10 phần tử với chuỗi biểu tượng, kích thước, độ trễ và đường rơi gốc. Biểu tượng tùy chỉnh trong editor vẫn được hỗ trợ.
- Chế độ reduced motion bỏ chuyển động cuộn và hạt rơi, mở thiệp bằng fade 140 ms. Editor hiển thị nội dung tĩnh để chỉnh vị trí.

Kiểm tra: `npm test` gồm đối chiếu toàn bộ metadata, hướng dịch chuyển hai phong bì, thời gian mở, sự kiện một lần, không nhảy bố cục, cuộn/album/lịch và reduced motion. Giữ nguyên việc gỡ watermark trước đó.

Giới hạn: việc khớp thông số chuyển động không đồng nghĩa khớp từng pixel của bản ghi; vị trí hạt rơi tại thời điểm quay và nhịp cuộn phụ thuộc thời điểm mở trang, thao tác người dùng và kích thước cửa sổ.
