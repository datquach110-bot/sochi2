# Sổ Chi: hướng dẫn cài lên iPhone

## 1. Đưa app lên GitHub Pages (làm một lần, khoảng 10 phút)
1. Tạo tài khoản miễn phí tại github.com (nếu chưa có).
2. Bấm **New repository**, đặt tên `so-chi`, chọn **Public**, bấm **Create repository**.
3. Bấm **uploading an existing file**, kéo toàn bộ file và thư mục trong gói này vào (index.html, app.js, style.css, vietqr.js, sw.js, manifest.webmanifest, thư mục vendor, thư mục icons). Bấm **Commit changes**.
4. Vào **Settings > Pages**. Ở mục Branch chọn `main`, thư mục `/ (root)`, bấm **Save**.
5. Đợi 1–2 phút, trang sẽ có địa chỉ dạng `https://ten-ban.github.io/so-chi/`.

Repo Public chỉ công khai mã nguồn. Dữ liệu chi tiêu của bạn nằm trên điện thoại, không bao giờ lên GitHub.

## 2. Cài lên iPhone
1. Mở địa chỉ trên bằng **Safari**.
2. Bấm nút **Chia sẻ**, chọn **Thêm vào MH chính**, bấm **Thêm**.
3. Từ giờ luôn mở Sổ Chi bằng icon trên màn hình chính.
4. Lần đầu quét mã, cho phép dùng camera.

## 3. Việc cần nhớ
- Không đổi địa chỉ trang (tên tài khoản, tên repo). Đổi địa chỉ = app mới, dữ liệu cũ không đi theo.
- Mỗi tháng vào **Cài đặt > Xuất bản sao lưu**, lưu vào Tệp hoặc iCloud Drive.
- Vào **Cài đặt > App ngân hàng của bạn** để chọn đúng các app đã cài.

## 4. Cập nhật app sau này
Sửa file, tải lên đè trong GitHub, và **tăng số VERSION trong sw.js** (ví dụ `sochi-v2`). Mở app, đóng hẳn rồi mở lại để nhận bản mới. Dữ liệu vẫn giữ nguyên.
