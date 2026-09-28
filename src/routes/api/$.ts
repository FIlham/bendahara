import { Elysia } from 'elysia'
import { treaty } from '@elysia/eden'

import { createFileRoute } from '@tanstack/react-router'
import { createIsomorphicFn } from '@tanstack/react-start'

const app = new Elysia({ prefix: '/api' }).get('/', 'Hello Elysia!')

const handle = ({ request }: { request: Request }) => app.fetch(request)

export const Route = createFileRoute('/api/$')({
    server: {
        handlers: {
            GET: handle,
            POST: handle,
            PUT: handle,
            PATCH: handle,
            DELETE: handle,
        },
    },
})

export const getTreaty = createIsomorphicFn()
    .server(() => treaty(app).api)
    .client(() =>
        treaty<typeof app>(
            typeof window !== 'undefined'
                ? window.location.origin
                : 'http://localhost:3000',
        ).api,
    )
