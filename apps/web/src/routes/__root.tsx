import {mutators, schema} from '@curved/zero'
import type {ZeroOptions} from '@rocicorp/zero'
import {ZeroProvider} from '@rocicorp/zero/react'
import {createRootRoute, Outlet} from '@tanstack/react-router'

const zeroOptions: ZeroOptions = {
  cacheURL: import.meta.env.VITE_ZERO_CACHE_URL,
  schema,
  mutators,
}

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <ZeroProvider {...zeroOptions}>
      <Outlet />
    </ZeroProvider>
  )
}
