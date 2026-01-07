import { spawn } from 'child_process'

export type IdeType = 'pycharm' | 'cursor' | 'vscode' | 'zed' | 'antigravity'
export type RemoteIdeType = 'cursor' | 'vscode'

const LOCALAPPDATA = process.env.LOCALAPPDATA || ''
const isWindows = process.platform === 'win32'

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
  file: (path: string) => ({
    command: 'explorer.exe',
    args: [path],
  }),
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

export async function selectFolder(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // Use modern IFileOpenDialog (Windows Vista+) for native Windows 11 file picker
    // With DPI awareness and foreground window support for proper display
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
  return new Promise((resolve, reject) => {
    // Use modern IFileOpenDialog for native Windows 11 file picker
    // With DPI awareness and foreground window support for proper display
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
