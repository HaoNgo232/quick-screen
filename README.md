# quick-screen 📸

> Browser Extension chụp toàn bộ trang web (Full Page), tự động lưu file vào `/tmp/quick-screen/` và nạp đường dẫn tuyệt đối (kèm dữ liệu ảnh) vào Clipboard để gửi ngay cho AI.

## Tính năng nổi bật

- ⚡ **Chụp Full Page (1-Click)**: Cuộn và ghép toàn bộ trang từ đầu đến chân trang bằng Canvas thông minh, tự động ẩn menu fixed/sticky không bị lặp.
- 🚀 **Zero-Prompt Auto Save (/tmp)**: Sử dụng Native Messaging Host ghi thẳng file vào `/tmp/quick-screen/`, **hoàn toàn tự động 100% không bao giờ hiện hộp thoại hỏi lưu**, bất kể cài đặt download của Chrome như thế nào.
- 📑 **Chụp hàng loạt Tab (Batch)**: Lần lượt chụp tất cả các tab đang mở trong cửa sổ và copy toàn bộ danh sách đường dẫn file (mỗi tab một dòng) vào clipboard.
- 📋 **Dual Clipboard**: Nạp đồng thời cả đường dẫn tuyệt đối (`text/plain`) và binary image (`image/png`). Dán vào terminal AI thì ra path, dán vào web ChatGPT/Claude thì ra ảnh.
- 📐 **Adaptive Scaling**: Tự động scale tỷ lệ nếu trang web quá dài vượt ngưỡng an toàn Canvas (16,000px), đảm bảo không crash trình duyệt.
- 🖼️ **Side Panel & Lịch sử**: Giao diện sidebar hiển thị danh sách ảnh vừa chụp, preview thumbnail, nút copy path và copy image tiện lợi.
- 🍞 **Toast Banner trực quan**: Thông báo xác nhận nhẹ nhàng trên trang web khi chụp và copy thành công.

## Cài đặt & Sử dụng

### 1. Kích hoạt Native Host (để lưu tự động vào /tmp không hiện popup)
Chạy script cài đặt 1 lần duy nhất trên máy:
```bash
./install-native-host.sh
```

### 2. Build extension
```bash
npm run build
```

### 3. Cập nhật / Tải vào Chrome
1. Mở `chrome://extensions/`
2. Bấm nút **Reload** (icon mũi tên xoay tròn) ở extension **quick-screen** (hoặc chọn *Load unpacked* trỏ vào `dist/chromium`).

### 4. Sử dụng
- Bấm vào icon **quick-screen** trên thanh công cụ để mở **Side Panel**.
- Bấm **"⚡ Chụp trang này (Full Page)"** hoặc **"📑 Chụp tất cả các tab (Batch)"**.
- Ảnh tự động lưu vào `/tmp/quick-screen/...` và đường dẫn đã có sẵn trong clipboard, dán ngay vào AI!

## Tài liệu kiến trúc
- [Thuật ngữ miền (CONTEXT.md)](./CONTEXT.md)
- [ADR 0001: Scroll & Stitch Capture](./docs/adr/0001-scroll-and-stitch-capture.md)
- [ADR 0002: Download API for Local Artifacts](./docs/adr/0002-download-api-for-local-artifacts.md)
- [ADR 0003: Native Messaging Host for /tmp](./docs/adr/0003-native-messaging-for-tmp-storage.md)
