import { useState, useRef, useEffect } from 'react'
import { List } from '@react95/core'

export interface MenuItemSpec {
  label: string
  onClick?: () => void
  divider?: boolean
  disabled?: boolean
}

export interface MenuSpec {
  name: string  // prefix a letter with `&` to underline it (e.g. "&Game" → underlined G)
  items: MenuItemSpec[]
}

interface MenuBarProps {
  menus: MenuSpec[]
}

// Standalone Win95 menu bar. Reuses the class names that React95's Modal applies
// to its built-in menu so the visuals match exactly (border, hover invert, etc.).
// Click a top-level item to open; click another to switch; click outside or pick
// an item to close.
export function MenuBar({ menus }: MenuBarProps) {
  const [opened, setOpened] = useState<string>('')
  const ref = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (!opened) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpened('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [opened])

  return (
    <ul ref={ref} className="r95_1txblt66" style={{ flexShrink: 0 }}>
      {menus.map(menu => {
        const active = opened === menu.name
        return (
          <li
            key={menu.name}
            className={active ? 'r95_1txblt67 r95_1txblt68' : 'r95_1txblt67'}
            onMouseEnter={() => {
              // Once a menu is open, hovering over another should switch — Win95 behavior
              if (opened) setOpened(menu.name)
            }}
          >
            <span
              onMouseDown={(e) => {
                e.preventDefault()
                setOpened(prev => (prev === menu.name ? '' : menu.name))
              }}
              style={{ display: 'inline-block', cursor: 'default' }}
            >
              {renderAccelerator(menu.name)}
            </span>
            {active && (
              <List
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  minWidth: 160,
                  whiteSpace: 'nowrap',
                  zIndex: 1000,
                }}
              >
                {menu.items.map((item, i) =>
                  item.divider ? (
                    <List.Divider key={i} />
                  ) : (
                    <List.Item
                      key={i}
                      onClick={() => {
                        if (item.disabled) return
                        setOpened('')
                        item.onClick?.()
                      }}
                      style={item.disabled ? { color: '#888', cursor: 'default' } : undefined}
                    >
                      {renderAccelerator(item.label)}
                    </List.Item>
                  )
                )}
              </List>
            )}
          </li>
        )
      })}
    </ul>
  )
}

function renderAccelerator(label: string) {
  const i = label.indexOf('&')
  if (i < 0 || i === label.length - 1) return label
  return (
    <>
      {label.slice(0, i)}
      <u>{label[i + 1]}</u>
      {label.slice(i + 2)}
    </>
  )
}
