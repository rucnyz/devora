import { spawn } from 'child_process'

export type IdeType = 'pycharm' | 'cursor' | 'vscode' | 'zed' | 'antigravity'
export type RemoteIdeType = 'cursor' | 'vscode'

const LOCALAPPDATA = process.env.LOCALAPPDATA || ''
const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const isLinux = process.platform === 'linux'

export const launchers: Record<IdeType | 'file', (path: string) => { command: string; args: string[] }> = {
  pycharm: (path: string) => ({
    command: `${LOCALAPPDATA}\\JetBrains\\Toolbox\\scripts\\pycharm.cmd`,
    args: [path],
  }),
  cursor: (path: string) => ({
    command: isWindows ? 'cursor.cmd' : 'cursor',
    args: [path],
  }),
  vscode: (path: string) => ({
    command: isWindows ? 'code.cmd' : 'code',
    args: [path],
  }),
  zed: (path: string) => ({
    command: 'zed',
    args: [path],
  }),
  antigravity: (path: string) => ({
    command: 'antigravity',
    args: [path],
  }),
  file: (path: string) => {
    if (isWindows) {
      return { command: 'explorer.exe', args: [path] }
    } else if (isMac) {
      return { command: 'open', args: [path] }
    } else {
      // Linux
      return { command: 'xdg-open', args: [path] }
    }
  },
}

export async function openWithIde(ideType: IdeType, path: string): Promise<void> {
  const launcher = launchers[ideType]
  if (!launcher) {
    throw new Error(`Unknown IDE type: ${ideType}`)
  }

  const { command, args } = launcher(path)

  if (isWindows) {
    // On Windows, use PowerShell Start-Process to ensure window comes to foreground
    // Escape single quotes by doubling them for PowerShell single-quoted strings
    return new Promise((resolve, reject) => {
      const escapedCommand = command.replace(/'/g, "''")
      const quotedArgs = args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(',')
      const psCommand = `Start-Process -FilePath '${escapedCommand}' -ArgumentList ${quotedArgs} -WindowStyle Normal`

      const child = spawn('powershell', ['-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })

      child.on('error', reject)
      child.unref()
      setTimeout(resolve, 100)
    })
  }

  // Non-Windows: use direct spawn
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', reject)
    child.unref()
    setTimeout(resolve, 100)
  })
}

export async function openFile(path: string): Promise<void> {
  const { command, args } = launchers.file(path)

  if (isWindows) {
    // On Windows, use PowerShell Start-Process to ensure window comes to foreground
    // Escape single quotes by doubling them for PowerShell single-quoted strings
    return new Promise((resolve, reject) => {
      const escapedCommand = command.replace(/'/g, "''")
      const quotedArgs = args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(',')
      const psCommand = `Start-Process -FilePath '${escapedCommand}' -ArgumentList ${quotedArgs} -WindowStyle Normal`

      const child = spawn('powershell', ['-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })

      child.on('error', reject)
      child.unref()
      setTimeout(resolve, 100)
    })
  }

  // Mac and Linux: use direct spawn with platform-specific command
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', reject)
    child.unref()
    setTimeout(resolve, 100)
  })
}

export async function selectFolder(): Promise<string | null> {
  if (isMac) {
    // macOS: Use AppleScript via osascript
    return new Promise((resolve, reject) => {
      const child = spawn('osascript', ['-e', 'POSIX path of (choose folder with prompt "Select folder")'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      child.on('close', (code) => {
        // osascript returns non-zero if user cancels
        if (code !== 0) {
          resolve(null)
          return
        }
        const path = stdout.trim().replace(/\/$/, '') // Remove trailing slash
        resolve(path || null)
      })

      child.on('error', reject)
    })
  }

  if (isLinux) {
    // Linux: Use zenity (GTK) or kdialog (KDE) for native file picker
    return new Promise((resolve, reject) => {
      // Try zenity first (most common on GTK-based desktops)
      const child = spawn('zenity', ['--file-selection', '--directory', '--title=Select folder'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.on('close', (code) => {
        // zenity returns non-zero if user cancels
        if (code !== 0) {
          resolve(null)
          return
        }
        const path = stdout.trim()
        resolve(path || null)
      })

      child.on('error', () => {
        // If zenity fails, try kdialog as fallback
        const kdialogChild = spawn('kdialog', ['--getexistingdirectory', process.env.HOME || '/'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        let kdialogStdout = ''

        kdialogChild.stdout?.on('data', (data) => {
          kdialogStdout += data.toString()
        })

        kdialogChild.on('close', (kdialogCode) => {
          if (kdialogCode !== 0) {
            resolve(null)
            return
          }
          const kdialogPath = kdialogStdout.trim()
          resolve(kdialogPath || null)
        })

        kdialogChild.on('error', () => {
          reject(new Error('No file picker available. Please install zenity or kdialog.'))
        })
      })
    })
  }

  // Windows: Use modern IFileOpenDialog (Windows Vista+) for native Windows 11 file picker
  return new Promise((resolve, reject) => {
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
internal class FileOpenDialog { }

[ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IFileOpenDialog {
    [PreserveSig] int Show([In] IntPtr parent);
    void SetFileTypes();
    void SetFileTypeIndex([In] uint iFileType);
    void GetFileTypeIndex(out uint piFileType);
    void Advise();
    void Unadvise();
    void SetOptions([In] uint fos);
    void GetOptions(out uint pfos);
    void SetDefaultFolder(IShellItem psi);
    void SetFolder(IShellItem psi);
    void GetFolder(out IShellItem ppsi);
    void GetCurrentSelection(out IShellItem ppsi);
    void SetFileName([In, MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([In, MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult(out IShellItem ppsi);
    void AddPlace(IShellItem psi, int alignment);
    void SetDefaultExtension([In, MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
    void Close(int hr);
    void SetClientGuid();
    void ClearClientData();
    void SetFilter([MarshalAs(UnmanagedType.Interface)] IntPtr pFilter);
    void GetResults();
    void GetSelectedItems();
}

[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IShellItem {
    void BindToHandler();
    void GetParent();
    void GetDisplayName([In] uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
    void GetAttributes();
    void Compare();
}

public class FolderPicker {
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("shcore.dll")]
    private static extern int SetProcessDpiAwareness(int awareness);

    public static string Show() {
        // Set Per-Monitor DPI awareness for crisp rendering on Windows 10/11
        try { SetProcessDpiAwareness(2); } catch { }

        var dialog = (IFileOpenDialog)new FileOpenDialog();
        dialog.SetOptions(0x20); // FOS_PICKFOLDERS
        dialog.SetTitle("Select folder");

        // Get foreground window handle to ensure dialog appears on top
        IntPtr hwnd = GetForegroundWindow();
        int hr = dialog.Show(hwnd);
        if (hr != 0) return "";

        IShellItem item;
        dialog.GetResult(out item);
        string path;
        item.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
        return path ?? "";
    }
}
"@
[FolderPicker]::Show()
`
    const child = spawn('powershell', ['-Command', psScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PowerShell exited with code ${code}: ${stderr}`))
        return
      }
      const path = stdout.trim()
      resolve(path || null)
    })

    child.on('error', reject)
  })
}

export async function selectFile(): Promise<string | null> {
  if (isMac) {
    // macOS: Use AppleScript via osascript
    return new Promise((resolve, reject) => {
      const child = spawn('osascript', ['-e', 'POSIX path of (choose file with prompt "Select file")'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.on('close', (code) => {
        // osascript returns non-zero if user cancels
        if (code !== 0) {
          resolve(null)
          return
        }
        const path = stdout.trim()
        resolve(path || null)
      })

      child.on('error', reject)
    })
  }

  if (isLinux) {
    // Linux: Use zenity (GTK) or kdialog (KDE) for native file picker
    return new Promise((resolve, reject) => {
      // Try zenity first (most common on GTK-based desktops)
      const child = spawn('zenity', ['--file-selection', '--title=Select file'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stdout = ''

      child.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      child.on('close', (code) => {
        // zenity returns non-zero if user cancels
        if (code !== 0) {
          resolve(null)
          return
        }
        const path = stdout.trim()
        resolve(path || null)
      })

      child.on('error', () => {
        // If zenity fails, try kdialog as fallback
        const kdialogChild = spawn('kdialog', ['--getopenfilename', process.env.HOME || '/'], {
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        let kdialogStdout = ''

        kdialogChild.stdout?.on('data', (data) => {
          kdialogStdout += data.toString()
        })

        kdialogChild.on('close', (kdialogCode) => {
          if (kdialogCode !== 0) {
            resolve(null)
            return
          }
          const kdialogPath = kdialogStdout.trim()
          resolve(kdialogPath || null)
        })

        kdialogChild.on('error', () => {
          reject(new Error('No file picker available. Please install zenity or kdialog.'))
        })
      })
    })
  }

  // Windows: Use modern IFileOpenDialog for native Windows 11 file picker
  return new Promise((resolve, reject) => {
    const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("DC1C5A9C-E88A-4dde-A5A1-60F82A20AEF7")]
internal class FileOpenDialog { }

[ComImport, Guid("42f85136-db7e-439c-85f1-e4075d135fc8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IFileOpenDialog {
    [PreserveSig] int Show([In] IntPtr parent);
    void SetFileTypes();
    void SetFileTypeIndex([In] uint iFileType);
    void GetFileTypeIndex(out uint piFileType);
    void Advise();
    void Unadvise();
    void SetOptions([In] uint fos);
    void GetOptions(out uint pfos);
    void SetDefaultFolder(IShellItem psi);
    void SetFolder(IShellItem psi);
    void GetFolder(out IShellItem ppsi);
    void GetCurrentSelection(out IShellItem ppsi);
    void SetFileName([In, MarshalAs(UnmanagedType.LPWStr)] string pszName);
    void GetFileName([MarshalAs(UnmanagedType.LPWStr)] out string pszName);
    void SetTitle([In, MarshalAs(UnmanagedType.LPWStr)] string pszTitle);
    void SetOkButtonLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszText);
    void SetFileNameLabel([In, MarshalAs(UnmanagedType.LPWStr)] string pszLabel);
    void GetResult(out IShellItem ppsi);
    void AddPlace(IShellItem psi, int alignment);
    void SetDefaultExtension([In, MarshalAs(UnmanagedType.LPWStr)] string pszDefaultExtension);
    void Close(int hr);
    void SetClientGuid();
    void ClearClientData();
    void SetFilter([MarshalAs(UnmanagedType.Interface)] IntPtr pFilter);
    void GetResults();
    void GetSelectedItems();
}

[ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
internal interface IShellItem {
    void BindToHandler();
    void GetParent();
    void GetDisplayName([In] uint sigdnName, [MarshalAs(UnmanagedType.LPWStr)] out string ppszName);
    void GetAttributes();
    void Compare();
}

public class FilePicker {
    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("shcore.dll")]
    private static extern int SetProcessDpiAwareness(int awareness);

    public static string Show() {
        // Set Per-Monitor DPI awareness for crisp rendering on Windows 10/11
        try { SetProcessDpiAwareness(2); } catch { }

        var dialog = (IFileOpenDialog)new FileOpenDialog();
        dialog.SetTitle("Select file");

        // Get foreground window handle to ensure dialog appears on top
        IntPtr hwnd = GetForegroundWindow();
        int hr = dialog.Show(hwnd);
        if (hr != 0) return "";

        IShellItem item;
        dialog.GetResult(out item);
        string path;
        item.GetDisplayName(0x80058000, out path); // SIGDN_FILESYSPATH
        return path ?? "";
    }
}
"@
[FilePicker]::Show()
`
    const child = spawn('powershell', ['-Command', psScript], {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: false,
    })

    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`PowerShell exited with code ${code}: ${stderr}`))
        return
      }
      const path = stdout.trim()
      resolve(path || null)
    })

    child.on('error', reject)
  })
}

// Remote IDE launchers (Cursor and VS Code only)
// Using --folder-uri format to avoid MSYS/Git Bash path conversion issues on Windows
// On Windows, use .cmd scripts for proper PATH resolution
const remoteLaunchers: Record<RemoteIdeType, (host: string, path: string) => { command: string; args: string[] }> = {
  cursor: (host: string, path: string) => ({
    command: isWindows ? 'cursor.cmd' : 'cursor',
    args: ['--folder-uri', `vscode-remote://ssh-remote+${host}${path}`],
  }),
  vscode: (host: string, path: string) => ({
    command: isWindows ? 'code.cmd' : 'code',
    args: ['--folder-uri', `vscode-remote://ssh-remote+${host}${path}`],
  }),
}

export async function openRemoteIde(ideType: RemoteIdeType, host: string, path: string): Promise<void> {
  const launcher = remoteLaunchers[ideType]
  if (!launcher) {
    throw new Error(`Unknown remote IDE type: ${ideType}`)
  }

  const { command, args } = launcher(host, path)

  if (isWindows) {
    // On Windows, use PowerShell Start-Process to ensure window comes to foreground
    // Set MSYS env vars to prevent path conversion issues
    // Escape single quotes by doubling them for PowerShell single-quoted strings
    return new Promise((resolve, reject) => {
      const escapedCommand = command.replace(/'/g, "''")
      const quotedArgs = args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(',')
      const psCommand = `$env:MSYS_NO_PATHCONV='1'; $env:MSYS2_ARG_CONV_EXCL='*'; Start-Process -FilePath '${escapedCommand}' -ArgumentList ${quotedArgs} -WindowStyle Normal`

      const child = spawn('powershell', ['-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })

      child.on('error', (err) => {
        reject(new Error(`Failed to spawn ${command}: ${err.message}`))
      })
      child.unref()
      setTimeout(resolve, 200)
    })
  }

  // Non-Windows: use direct spawn
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stderr = ''
    child.stderr?.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to spawn ${command}: ${err.message}`))
    })

    child.on('close', (code) => {
      if (code !== 0 && stderr) {
        console.error(`${command} exited with code ${code}: ${stderr}`)
      }
    })

    child.unref()
    setTimeout(resolve, 200)
  })
}

/**
 * Open any application with optional arguments
 * Cross-platform support for Windows, macOS, and Linux
 *
 * @param app - Application name or path
 * @param args - Optional arguments to pass to the application
 */
export async function openApp(app: string, args: string[] = []): Promise<void> {
  if (isWindows) {
    // Windows: Use PowerShell Start-Process
    return new Promise((resolve, reject) => {
      const escapedApp = app.replace(/'/g, "''")
      const quotedArgs = args.length > 0 ? args.map((arg) => `'${arg.replace(/'/g, "''")}'`).join(',') : ''
      const psCommand = quotedArgs
        ? `Start-Process -FilePath '${escapedApp}' -ArgumentList ${quotedArgs} -WindowStyle Normal`
        : `Start-Process -FilePath '${escapedApp}' -WindowStyle Normal`

      const child = spawn('powershell', ['-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })

      child.on('error', (err) => {
        reject(new Error(`Failed to open ${app}: ${err.message}`))
      })
      child.unref()
      setTimeout(resolve, 100)
    })
  }

  if (isMac) {
    // macOS: Use 'open' command
    // If app looks like an application name (not a path), use -a flag
    return new Promise((resolve, reject) => {
      const isAppPath = app.includes('/') || app.endsWith('.app')
      const openArgs = isAppPath ? [app, ...args] : ['-a', app, ...args]

      const child = spawn('open', openArgs, {
        detached: true,
        stdio: 'ignore',
      })

      child.on('error', (err) => {
        reject(new Error(`Failed to open ${app}: ${err.message}`))
      })
      child.unref()
      setTimeout(resolve, 100)
    })
  }

  // Linux: Try to execute directly or use xdg-open for files/URLs
  return new Promise((resolve, reject) => {
    const child = spawn(app, args, {
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to open ${app}: ${err.message}`))
    })
    child.unref()
    setTimeout(resolve, 100)
  })
}

/**
 * Open a URL in the default browser
 * Cross-platform support for Windows, macOS, and Linux
 *
 * @param url - URL to open
 */
export async function openUrl(url: string): Promise<void> {
  if (isWindows) {
    return new Promise((resolve, reject) => {
      const escapedUrl = url.replace(/'/g, "''")
      const psCommand = `Start-Process '${escapedUrl}'`

      const child = spawn('powershell', ['-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        shell: false,
      })

      child.on('error', (err) => {
        reject(new Error(`Failed to open URL: ${err.message}`))
      })
      child.unref()
      setTimeout(resolve, 100)
    })
  }

  if (isMac) {
    return new Promise((resolve, reject) => {
      const child = spawn('open', [url], {
        detached: true,
        stdio: 'ignore',
      })

      child.on('error', (err) => {
        reject(new Error(`Failed to open URL: ${err.message}`))
      })
      child.unref()
      setTimeout(resolve, 100)
    })
  }

  // Linux: Use xdg-open
  return new Promise((resolve, reject) => {
    const child = spawn('xdg-open', [url], {
      detached: true,
      stdio: 'ignore',
    })

    child.on('error', (err) => {
      reject(new Error(`Failed to open URL: ${err.message}`))
    })
    child.unref()
    setTimeout(resolve, 100)
  })
}
