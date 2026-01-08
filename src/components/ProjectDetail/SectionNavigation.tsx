interface NavItem {
  id: string
  label: string
  color: string
}

interface SectionNavigationProps {
  items: NavItem[]
}

export default function SectionNavigation({ items }: SectionNavigationProps) {
  if (items.length === 0) return null

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <nav className="fixed right-2 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-1 p-1.5 rounded-lg bg-(--bg-surface)/80 backdrop-blur-sm border border-(--border-subtle)">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => scrollToSection(item.id)}
          className="group flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-(--bg-elevated) transition-colors"
          title={item.label}
        >
          <span
            className="w-2 h-2 rounded-full transition-transform group-hover:scale-125"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-xs font-mono text-(--text-muted) group-hover:text-(--text-secondary) transition-colors hidden lg:inline">
            {item.label}
          </span>
        </button>
      ))}
    </nav>
  )
}
