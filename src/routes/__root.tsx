import type { ReactNode } from 'react'
import {
    Outlet,
    createRootRoute,
    HeadContent,
    Scripts,
} from '@tanstack/react-router'
import '../styles.css'

export const Route = createRootRoute({
    head: () => ({
        meta: [
            {
                charSet: 'utf-8',
            },
            {
                name: 'viewport',
                content: 'width=device-width, initial-scale=1',
            },
            {
                name: 'color-scheme',
                content: 'dark',
            },
            {
                title: 'Bendahara - Keuangan Kelas',
            },
        ],
        links: [
            // Font disajikan lokal via @fontsource-variable (tanpa request pihak ketiga).
        ],
    }),
    component: RootComponent,
})

function RootComponent() {
    return (
        <RootDocument>
            <a
                href="#main-content"
                className="sr-only rounded-lg bg-primary px-4 py-2 text-button-sm font-medium text-on-primary focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
            >
                Lewati ke konten utama
            </a>
            <Outlet />
        </RootDocument>
    )
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <html lang="id" className="dark" style={{ colorScheme: 'dark' }}>
            <head>
                <HeadContent />
            </head>
            <body className="min-h-screen bg-background text-foreground antialiased">
                {children}
                <Scripts />
            </body>
        </html>
    )
}
