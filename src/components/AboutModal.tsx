import { useEffect } from 'react'
import { Frame, TitleBar } from '@react95/core'
import { Button } from 'react95'
import { palette } from '../palette'

interface AboutModalProps {
  onClose: () => void
}

export function AboutModal({ onClose }: AboutModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={backdropStyle} onClick={onClose}>
      <Frame
        bgColor="$material"
        boxShadow="$out"
        p="$2"
        style={{ width: '100%', maxWidth: 480, maxHeight: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column' }}
        onClick={e => e.stopPropagation()}
      >
        <TitleBar title="About Texas Flush'em" active>
          <TitleBar.OptionsBox>
            <TitleBar.Close onClick={onClose} />
          </TitleBar.OptionsBox>
        </TitleBar>

        <Frame
          bgColor="$inputBackground"
          boxShadow="$in"
          p="$8"
          style={{ overflowY: 'auto', flex: 1, fontSize: 12, lineHeight: 1.5 }}
        >
          <Section title="Texas Flush'em">
            <p style={{ margin: '0 0 6px' }}>
              <b>Deck Poker</b> for 2-4 players. Version 0.1.0.
            </p>
            <p style={{ margin: 0 }}>
              A shedding card game where every play has to outrank the last one. Build pairs,
              flushes, and full houses from your own deck and try to be the first to empty
              your hand.
            </p>
          </Section>

          <Section title="The project">
            <p>
              Built in a weekend to playtest the rules with friends. Real-time multiplayer
              over WebSockets, server-authoritative game state, hidden hands, reconnects,
              and CPU opponents. Open source under MIT.
            </p>
            <p>
              The Win95 chrome is unironic - it kept the visual scope small so the rules and
              the engine could be the focus.
            </p>
          </Section>

          <Section title="Links">
            <ul style={listStyle}>
              <li>
                Source code:{' '}
                <Link href="https://github.com/jesse-stewart/texas-flush-em">
                  github.com/jesse-stewart/texas-flush-em
                </Link>
              </li>
              <li>
                Author:{' '}
                <Link href="https://jessestewart.com">jessestewart.com</Link>
              </li>
            </ul>
          </Section>

          <Divider />

          <Section title="Credits">
            <p style={{ margin: '0 0 4px' }}>
              UI components by <Link href="https://react95.io/">react95</Link> - a React
              component library for that authentic Windows 95 look.
            </p>
            <p style={{ margin: 0, color: palette.dkGray, fontSize: 11 }}>
              Multiplayer powered by PartyKit. Built with Vite, React, and TypeScript.
            </p>
          </Section>

          <Divider />

          <p style={{ margin: 0, fontSize: 11, color: palette.dkGray }}>
            (c) {new Date().getFullYear()}{' '}
            <Link href="https://jessestewart.com">Jesse Stewart</Link>. All rights reserved.
          </p>
        </Frame>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 4px 0' }}>
          <Button onClick={onClose} style={{ minWidth: 75 }}>OK</Button>
        </div>
      </Frame>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ margin: '0 0 6px', fontSize: 12, fontWeight: 700, color: palette.navy }}>
        {title}
      </h3>
      <div>{children}</div>
    </section>
  )
}

function Link({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: palette.navy, textDecoration: 'underline' }}
    >
      {children}
    </a>
  )
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #888', borderBottom: '1px solid #fff', margin: '8px 0 16px' }} />
}

const backdropStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 200,
  backgroundColor: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '40px 16px',
}

const listStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 20,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
