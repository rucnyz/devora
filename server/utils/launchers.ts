import { spawn } from 'child_process'

export type IdeType = 'pycharm' | 'cursor' | 'vscode' | 'zed' | 'obsidian'
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
  obsidian: (vault: string) => ({
    command: 'cmd',
    args: ['/c', 'start', `obsidian://open?vault=${encodeURIComponent(vault)}`],
  }),
  file: (path: string) => ({
    command: 'cmd',
    args: ['/c', 'start', '""', `"${path}"`],
  }),
}

export async function openWithIde(ideType: IdeType, path: string): Promise<void> {
  const launcher = launchers[ideType]
  if (!launcher) {
    throw new Error(`Unknown IDE type: ${ideType}`)
  }

  const { command, args } = launcher(path)

  // On Windows, .cmd files and cmd-based launchers need shell: true
  const useShell = command === 'cmd' || command.endsWith('.cmd')

  // When using shell, quote args that contain spaces
  const finalArgs = useShell ? args.map(arg => arg.includes(' ') ? `"${arg}"` : arg) : args

  return new Promise((resolve, reject) => {
    const child = spawn(command, finalArgs, {
      detached: true,
      stdio: 'ignore',
      shell: useShell,
    })

    child.on('error', reject)
    child.unref()

    // Resolve immediately since we're launching in background
    setTimeout(resolve, 100)
  })
}

export async function openFile(path: string): Promise<void> {
  const { command, args } = launchers.file(path)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      shell: true,
    })

    child.on('error', reject)
    child.unref()

    setTimeout(resolve, 100)
  })
}

export async function selectFolder(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    // Use modern IFileOpenDialog (Windows Vista+) for native Windows 11 file picker
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
    public static string Show() {
        var dialog = (IFileOpenDialog)new FileOpenDialog();
        dialog.SetOptions(0x20); // FOS_PICKFOLDERS
        dialog.SetTitle("Select folder");
        int hr = dialog.Show(IntPtr.Zero);
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
    public static string Show() {
        var dialog = (IFileOpenDialog)new FileOpenDialog();
        dialog.SetTitle("Select file");
        int hr = dialog.Show(IntPtr.Zero);
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

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: isWindows, // Need shell on Windows to run .cmd files
      env: {
        ...process.env,
        // Prevent MSYS/Git Bash from converting Unix paths to Windows paths
        MSYS_NO_PATHCONV: '1',
        MSYS2_ARG_CONV_EXCL: '*',
      },
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

    // Resolve after a short delay - if spawn fails, error event fires quickly
    setTimeout(resolve, 200)
  })
}

// Generic app launcher - opens any executable with optional arguments
export async function openApp(executable: string, args?: string, cwd?: string): Promise<void> {
  // Parse args string into array (split by spaces, respecting quotes)
  const argList: string[] = []
  if (args) {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g
    let match
    while ((match = regex.exec(args)) !== null) {
      argList.push(match[1] || match[2] || match[0])
    }
  }

  return new Promise((resolve, reject) => {
    const spawnOptions: any = {
      detached: true,
      stdio: 'ignore',
      shell: false,
    }

    if (cwd) {
      spawnOptions.cwd = cwd
    }

    // On Windows, use shell for better compatibility
    if (isWindows) {
      spawnOptions.shell = true
    }

    const child = spawn(executable, argList, spawnOptions)

    child.on('error', (err) => {
      reject(new Error(`Failed to launch app: ${err.message}`))
    })

    child.unref()

    // Resolve immediately since we're launching in background
    setTimeout(resolve, 100)
  })
}
