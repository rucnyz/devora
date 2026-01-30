import { useRef } from 'react'
import { Editor, rootCtx, defaultValueCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { nord } from '@milkdown/theme-nord'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { listenerCtx, listener } from '@milkdown/plugin-listener'
import { history } from '@milkdown/plugin-history'
import { listItemBlockComponent } from '@milkdown/components/list-item-block'
import '@milkdown/theme-nord/style.css'

interface MilkdownEditorInnerProps {
  value: string
  onChange: (value: string) => void
}

function MilkdownEditorInner({ value, onChange }: MilkdownEditorInnerProps) {
  const initialValueRef = useRef(value)

  useEditor(
    (root) =>
      Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, root)
          ctx.set(defaultValueCtx, initialValueRef.current)
          ctx.set(editorViewOptionsCtx, {
            attributes: {
              class: 'milkdown-editor prose prose-sm max-w-none',
              spellcheck: 'false',
            },
          })
          ctx.get(listenerCtx).markdownUpdated((_ctx, markdown) => {
            onChange(markdown)
          })
        })
        .config(nord)
        .use(commonmark)
        .use(gfm)
        .use(listItemBlockComponent)
        .use(history)
        .use(listener),
    [onChange]
  )

  return <Milkdown />
}

interface MilkdownEditorProps {
  value: string
  onChange: (value: string) => void
}

export default function MilkdownEditor({ value, onChange }: MilkdownEditorProps) {
  return (
    <div className="h-full overflow-y-auto p-4 milkdown-container">
      <MilkdownProvider>
        <MilkdownEditorInner value={value} onChange={onChange} />
      </MilkdownProvider>
    </div>
  )
}
