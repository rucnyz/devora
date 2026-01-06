import { spawn } from 'child_process'

export type IdeType = 'pycharm' | 'cursor' | 'vscode' | 'zed' | 'obsidian'

const LOCALAPPDATA = process.env.LOCALAPPDATA || ''

export const launchers: Record<IdeType | 'file', (path: string) => { command: string; args: string[] }> = {
  pycharm: (path: string) => ({
    command: `${LOCALAPPDATA}\\JetBrains\\Toolbox\\scripts\\pycharm.cmd`,
    args: [path],
  }),
  cursor: (path: string) => ({
    command: 'cursor',
    args: [path],
  }),
  vscode: (path: string) => ({
    command: 'code',
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
    args: ['/c', 'start', '', path],
  }),
}

export async function openWithIde(ideType: IdeType, path: string): Promise<void> {
  const launcher = launchers[ideType]
  if (!launcher) {
    throw new Error(`Unknown IDE type: ${ideType}`)
  }

  const { command, args } = launcher(path)

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      detached: true,
      stdio: 'ignore',
      shell: true,
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
