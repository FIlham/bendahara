import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
    // Data loader selalu dianggap basi: navigasi pindah halaman wajib
    // refetch (tanpa jendela reuse hasil preload 30 detik bawaan).
    defaultStaleTime: 0,
    defaultPreloadStaleTime: 0,
  })

  return router
}
