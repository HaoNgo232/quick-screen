# Hướng dẫn Cài đặt & Vận hành Native Host trên Windows

Tài liệu này hướng dẫn chi tiết cách cài đặt, vận hành và khắc phục sự cố cho thành phần **Native Messaging Host** của `quick-screen` trên hệ điều hành **Windows**.

---

## 1. Tại sao cần Native Host trên Windows?

Mặc định, tiện ích mở rộng Chrome chạy trong môi trường bảo mật (Sandbox) của trình duyệt. Khi lưu ảnh qua API download tiêu chuẩn của Chrome:
- Nếu trình duyệt của bạn bật cài đặt *"Hỏi vị trí lưu từng tệp trước khi tải xuống"*, Chrome sẽ **mở hộp thoại Save As cho từng ảnh** (nếu chụp 5 tab, bạn phải bấm Save 5 lần).
- Trình duyệt chỉ cho phép lưu vào thư mục `Downloads`.

**Native Messaging Host** giải quyết triệt để các hạn chế này:
- **Zero-Prompt Auto Save**: Ảnh chụp được lưu ngầm 100% thẳng vào thư mục tạm của Windows (`%TEMP%\quick-screen`), không bao giờ mở hộp thoại hỏi vị trí.
- **Dual Clipboard**: Tự động nạp cả đường dẫn tuyệt đối (`C:\Users\...\AppData\Local\Temp\quick-screen\...png`) và dữ liệu nhị phân ảnh trực tiếp vào Clipboard Windows qua Win32 API / PowerShell, giúp dán ngay vào các công cụ AI (Antigravity, Cursor, ChatGPT, Claude) hoặc Discord, Slack, Figma.

---

## 2. Yêu cầu hệ thống

- **Hệ điều hành**: Windows 10 hoặc Windows 11 (64-bit).
- **Trình duyệt**: Google Chrome, Microsoft Edge, Brave hoặc Chromium.
- **Python**: Đã cài đặt **Python 3.8+** và đã tích chọn tùy chọn **"Add Python to PATH"** khi cài đặt.
  > *Kiểm tra bằng cách mở Command Prompt / PowerShell và gõ: `python --version`.*

---

## 3. Cài đặt nhanh (1 click)

Bạn có thể chọn một trong hai cách cài đặt:

### Cách 1: Dùng Command Prompt / File Batch (Khuyên dùng)
1. Mở thư mục dự án `quick-screen`.
2. Click đúp vào file:
   ```cmd
   install-native-host.bat
   ```
3. Màn hình console sẽ hiển thị thông báo `[+] Registered` cho các trình duyệt tương ứng.

### Cách 2: Dùng PowerShell
Mở PowerShell tại thư mục dự án và chạy:
```powershell
powershell -ExecutionPolicy Bypass -File .\install-native-host.ps1
```

Sau khi cài đặt:
1. Mở `chrome://extensions/` trên Chrome.
2. Bật **Developer mode** -> Bấm **Load unpacked** và chọn thư mục `dist/chromium`.
3. (Khuyên dùng) Khởi động lại trình duyệt Chrome 1 lần để Chrome nhận diện Registry mới.

---

## 4. Chi tiết kỹ thuật & Vị trí cài đặt

Khi bạn chạy script cài đặt, hệ thống sẽ tự động cấu hình các thành phần sau:

### A. Thư mục cài đặt Host
Script sẽ copy các file cần thiết vào thư mục người dùng:
```text
%USERPROFILE%\.quick-screen\
  ├── quick_screen_host.py     (Code Python xử lý IPC stdio & OS adapter)
  ├── quick-screen-host.bat    (Wrapper thực thi Python không hiển thị console)
  └── com.quickscreen.host.json (Manifest khai báo với Chrome)
```

### B. Vị trí lưu ảnh chụp
Toàn bộ ảnh chụp được lưu tự động tại:
```text
%TEMP%\quick-screen\
(Ví dụ: C:\Users\<Username>\AppData\Local\Temp\quick-screen\<filename>.png)
```

### C. Đăng ký Windows Registry
Script tự động thêm key `com.quickscreen.host` trỏ tới file manifest JSON trong Registry của các trình duyệt:
- **Google Chrome**: `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quickscreen.host`
- **Chromium**: `HKCU\Software\Chromium\NativeMessagingHosts\com.quickscreen.host`
- **Microsoft Edge**: `HKCU\Software\Microsoft\Edge\NativeMessagingHosts\com.quickscreen.host`
- **Brave Browser**: `HKCU\Software\BraveSoftware\Brave-Browser\NativeMessagingHosts\com.quickscreen.host`

---

## 5. Kiến trúc `WindowsAdapter` (Bên trong Python Host)

File `native-host/quick_screen_host.py` sử dụng `WindowsAdapter` đáp ứng interface `PlatformAdapter`:

1. **Phân giải thư mục**: Dùng `os.environ.get('TEMP')` kết hợp `tempfile.gettempdir()`.
2. **Copy Text vào Clipboard**: 
   - Ưu tiên gọi Win32 API trực tiếp qua `ctypes` (`OpenClipboard`, `CF_UNICODETEXT`).
   - Tự động fallback sang `clip.exe` hoặc lệnh PowerShell `Set-Clipboard`.
3. **Copy Image vào Clipboard**:
   - Dùng `ctypes.windll.user32.RegisterClipboardFormatW("PNG")` để nạp dữ liệu PNG nguyên bản vào Clipboard Windows.
   - Fallback sang PowerShell Single-Threaded Apartment (STA): `powershell -Sta ... [System.Windows.Forms.Clipboard]::SetImage(...)`.
   - **100% Standard Library**: Không yêu cầu `pip install` bất kỳ thư viện ngoài nào (không cần Pillow hay pywin32).
4. **Mở file (Preview)**: Gọi trực tiếp hàm Windows API `os.startfile(filepath)`.

---

## 6. Khắc phục sự cố (Troubleshooting)

### Lỗi 1: Tiện ích vẫn hỏi popup tải về của Chrome
- **Nguyên nhân**: Chrome chưa kết nối được với Native Host nên tự động fallback về `chrome.downloads`.
- **Cách xử lý**:
  1. Kiểm tra Python đã có trong PATH chưa: Mở `cmd` gõ `python --version`.
  2. Đảm bảo đã khởi động lại Chrome sau khi chạy `install-native-host.bat`.
  3. Kiểm tra Registry: Mở `regedit`, kiểm tra xem đường dẫn `HKCU\Software\Google\Chrome\NativeMessagingHosts\com.quickscreen.host` đã có giá trị trỏ tới file JSON chưa.

### Lỗi 2: Extension ID không khớp
- File manifest `com.quickscreen.host.json` cấu hình danh sách extension ID được phép truy cập (`allowed_origins`).
- Nếu bạn đóng gói extension với ID khác, hãy cập nhật thêm ID đó vào mảng `allowed_origins` trong file `%USERPROFILE%\.quick-screen\com.quickscreen.host.json`.

---

## 7. Gỡ cài đặt (Uninstall)

Nếu bạn không muốn sử dụng Native Host nữa, chỉ cần chạy file:
```cmd
uninstall-native-host.bat
```
Script sẽ tự động:
1. Xóa các key đã đăng ký trong Windows Registry của tất cả các trình duyệt.
2. Xóa sạch thư mục `%USERPROFILE%\.quick-screen\`.
