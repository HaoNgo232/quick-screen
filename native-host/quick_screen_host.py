#!/usr/bin/env python3
import sys
import json
import struct
import base64
import os
import subprocess
import tempfile

class PlatformAdapter:
    """Interface for OS-specific operations."""
    def get_storage_dir(self) -> str:
        raise NotImplementedError

    def copy_text(self, text: str) -> bool:
        raise NotImplementedError

    def copy_image(self, filepath: str) -> bool:
        raise NotImplementedError

    def open_file(self, filepath: str) -> bool:
        raise NotImplementedError


class LinuxAdapter(PlatformAdapter):
    """Adapter for Linux (X11 & Wayland)."""
    def get_storage_dir(self) -> str:
        return "/tmp/quick-screen"

    def copy_text(self, text: str) -> bool:
        try:
            subprocess.run(['xclip', '-selection', 'clipboard'], input=text.encode('utf-8'), check=False)
            return True
        except Exception:
            try:
                subprocess.run(['wl-copy'], input=text.encode('utf-8'), check=False)
                return True
            except Exception:
                return False

    def copy_image(self, filepath: str) -> bool:
        try:
            subprocess.run(['xclip', '-selection', 'clipboard', '-t', 'image/png', '-i', filepath], check=False)
            return True
        except Exception:
            try:
                with open(filepath, 'rb') as img_f:
                    subprocess.run(['wl-copy', '-t', 'image/png'], input=img_f.read(), check=False)
                return True
            except Exception:
                return False

    def open_file(self, filepath: str) -> bool:
        try:
            subprocess.Popen(['xdg-open', filepath])
            return True
        except Exception:
            return False


class WindowsAdapter(PlatformAdapter):
    """Adapter for Windows (NTFS, clip.exe, Win32 / PowerShell clipboard, os.startfile)."""
    def get_storage_dir(self) -> str:
        temp_base = os.environ.get('TEMP') or os.environ.get('TMP') or tempfile.gettempdir()
        return os.path.join(temp_base, "quick-screen")

    def copy_text(self, text: str) -> bool:
        # 1. Try ctypes Win32 clipboard
        try:
            import ctypes
            from ctypes import wintypes
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            GMEM_MOVEABLE = 0x0002
            CF_UNICODETEXT = 13

            if user32.OpenClipboard(None):
                try:
                    user32.EmptyClipboard()
                    data = text.encode('utf-16le') + b'\x00\x00'
                    h_glob = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(data))
                    if h_glob:
                        ptr = kernel32.GlobalLock(h_glob)
                        ctypes.memmove(ptr, data, len(data))
                        kernel32.GlobalUnlock(h_glob)
                        user32.SetClipboardData(CF_UNICODETEXT, h_glob)
                        return True
                finally:
                    user32.CloseClipboard()
        except Exception:
            pass

        # 2. Fallback to clip.exe
        try:
            subprocess.run(['clip'], input=text.encode('utf-16le'), check=False)
            return True
        except Exception:
            pass

        # 3. Fallback to PowerShell
        try:
            cmd = f"Set-Clipboard -Value @'\n{text}\n'@"
            subprocess.run(['powershell', '-NoProfile', '-Command', cmd], check=False)
            return True
        except Exception:
            return False

    def copy_image(self, filepath: str) -> bool:
        if not os.path.exists(filepath):
            return False

        # 1. Try Win32 RegisterClipboardFormatW("PNG") via ctypes
        try:
            import ctypes
            user32 = ctypes.windll.user32
            kernel32 = ctypes.windll.kernel32

            GMEM_MOVEABLE = 0x0002
            CF_PNG = user32.RegisterClipboardFormatW("PNG")

            with open(filepath, 'rb') as f:
                png_bytes = f.read()

            if user32.OpenClipboard(None):
                try:
                    user32.EmptyClipboard()
                    h_glob = kernel32.GlobalAlloc(GMEM_MOVEABLE, len(png_bytes))
                    if h_glob:
                        ptr = kernel32.GlobalLock(h_glob)
                        ctypes.memmove(ptr, png_bytes, len(png_bytes))
                        kernel32.GlobalUnlock(h_glob)
                        user32.SetClipboardData(CF_PNG, h_glob)
                        user32.CloseClipboard()
                        return True
                finally:
                    try:
                        user32.CloseClipboard()
                    except Exception:
                        pass
        except Exception:
            pass

        # 2. Fallback to PowerShell Windows.Forms.Clipboard
        try:
            abs_path = os.path.abspath(filepath).replace("'", "''")
            ps_cmd = (
                f"Add-Type -AssemblyName System.Windows.Forms; "
                f"$img = [System.Drawing.Image]::FromFile('{abs_path}'); "
                f"[System.Windows.Forms.Clipboard]::SetImage($img); "
                f"$img.Dispose()"
            )
            res = subprocess.run(['powershell', '-Sta', '-NoProfile', '-Command', ps_cmd], check=False)
            return res.returncode == 0
        except Exception:
            return False

    def open_file(self, filepath: str) -> bool:
        if hasattr(os, 'startfile'):
            try:
                os.startfile(filepath)
                return True
            except Exception:
                pass
        try:
            subprocess.Popen(['cmd.exe', '/c', 'start', '', filepath])
            return True
        except Exception:
            return False


def get_platform_adapter() -> PlatformAdapter:
    if sys.platform.startswith('win') or sys.platform == 'cygwin':
        return WindowsAdapter()
    return LinuxAdapter()


def read_message():
    raw_length = sys.stdin.buffer.read(4)
    if len(raw_length) < 4:
        return None
    message_length = struct.unpack('@I', raw_length)[0]
    message = sys.stdin.buffer.read(message_length).decode('utf-8')
    return json.loads(message)


def send_message(response):
    encoded = json.dumps(response).encode('utf-8')
    sys.stdout.buffer.write(struct.pack('@I', len(encoded)))
    sys.stdout.buffer.write(encoded)
    sys.stdout.buffer.flush()


def main():
    adapter = get_platform_adapter()
    target_dir = adapter.get_storage_dir()
    os.makedirs(target_dir, exist_ok=True)

    while True:
        try:
            msg = read_message()
            if msg is None:
                break

            action = msg.get('action')
            if action == 'ping':
                send_message({'status': 'ok', 'pong': True})
            elif action == 'copy_text':
                text = msg.get('text', '')
                adapter.copy_text(text)
                send_message({'status': 'ok'})
            elif action == 'copy_image':
                filepath = msg.get('filepath', '')
                if not filepath or not os.path.exists(filepath):
                    filename = msg.get('filename', '')
                    filepath = os.path.join(target_dir, filename)

                if os.path.exists(filepath):
                    success = adapter.copy_image(filepath)
                    if success:
                        send_message({'status': 'ok', 'filepath': filepath})
                    else:
                        send_message({'status': 'error', 'error': 'Failed to copy image to clipboard'})
                else:
                    send_message({'status': 'error', 'error': 'File not found'})
            elif action == 'save':
                filename = msg.get('filename', 'screenshot.png')
                base64_data = msg.get('base64Data', '')
                should_copy = msg.get('copyClipboard', True)
                if ',' in base64_data:
                    base64_data = base64_data.split(',', 1)[1]

                raw_bytes = base64.b64decode(base64_data)
                filepath = os.path.join(target_dir, filename)
                with open(filepath, 'wb') as f:
                    f.write(raw_bytes)

                if should_copy:
                    adapter.copy_text(filepath)

                send_message({
                    'status': 'ok',
                    'absolutePath': filepath,
                    'filename': filename,
                    'size': len(raw_bytes)
                })
            elif action == 'save_batch':
                items = msg.get('items', [])
                paths = []
                for it in items:
                    fname = it.get('filename', 'tab.png')
                    b64 = it.get('base64Data', '')
                    if ',' in b64:
                        b64 = b64.split(',', 1)[1]
                    b = base64.b64decode(b64)
                    fpath = os.path.join(target_dir, fname)
                    with open(fpath, 'wb') as f:
                        f.write(b)
                    paths.append(fpath)

                combined_paths = '\n'.join(paths)
                adapter.copy_text(combined_paths)

                send_message({
                    'status': 'ok',
                    'paths': paths,
                    'combinedPaths': combined_paths
                })
            elif action == 'open_file':
                filepath = msg.get('filepath', '')
                if not filepath or not os.path.exists(filepath):
                    filename = msg.get('filename', '')
                    filepath = os.path.join(target_dir, filename)

                if os.path.exists(filepath):
                    adapter.open_file(filepath)
                    send_message({'status': 'ok', 'filepath': filepath})
                else:
                    send_message({'status': 'error', 'error': 'File not found'})
            elif action == 'read_file':
                filepath = msg.get('filepath', '')
                if not filepath or not os.path.exists(filepath):
                    filename = msg.get('filename', '')
                    filepath = os.path.join(target_dir, filename)

                if os.path.exists(filepath):
                    with open(filepath, 'rb') as img_f:
                        raw = img_f.read()
                        b64 = base64.b64encode(raw).decode('utf-8')
                    send_message({'status': 'ok', 'dataUrl': f'data:image/png;base64,{b64}'})
                else:
                    send_message({'status': 'error', 'error': 'File not found'})
            elif action == 'read_file_chunk':
                filepath = msg.get('filepath', '')
                if not filepath or not os.path.exists(filepath):
                    filename = msg.get('filename', '')
                    filepath = os.path.join(target_dir, filename)

                if os.path.exists(filepath):
                    offset = msg.get('offset', 0)
                    chunk_size = msg.get('chunkSize', 512 * 1024)
                    total_size = os.path.getsize(filepath)
                    with open(filepath, 'rb') as f:
                        f.seek(offset)
                        chunk = f.read(chunk_size)
                        b64_chunk = base64.b64encode(chunk).decode('utf-8')
                    send_message({
                        'status': 'ok',
                        'totalSize': total_size,
                        'offset': offset,
                        'data': b64_chunk,
                        'eof': (offset + len(chunk)) >= total_size
                    })
                else:
                    send_message({'status': 'error', 'error': 'File not found'})
            else:
                send_message({'status': 'error', 'error': f'Unknown action: {action}'})
        except Exception as e:
            send_message({'status': 'error', 'error': str(e)})


if __name__ == '__main__':
    main()
