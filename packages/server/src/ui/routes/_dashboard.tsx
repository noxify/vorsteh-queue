import { createFileRoute, Outlet } from "@tanstack/react-router"

import { AppLayout } from "~/components/layout/app-layout"

export const Route = createFileRoute("/_dashboard")({
  component: DashboardLayout,
})

function DashboardLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  )
}
