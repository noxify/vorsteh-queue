import { Calendar, Home, Inbox, Search, Settings } from "lucide-react"

import type { TreeItem } from "~/lib/navigation"
import { AllDocumentation, DocumentationDirectory } from "~/collections"
import { DocsSidebar } from "~/components/docs-sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "~/components/ui/sidebar"
import { getTree } from "~/lib/navigation"

const items = [
  {
    title: "Home",
    url: "#",
    icon: Home,
  },
  {
    title: "Inbox",
    url: "#",
    icon: Inbox,
  },
  {
    title: "Calendar",
    url: "#",
    icon: Calendar,
  },
  {
    title: "Search",
    url: "#",
    icon: Search,
  },
  {
    title: "Settings",
    url: "#",
    icon: Settings,
  },
]
export function AppSidebar({ items }: { items: TreeItem[] }) {
  return (
    <Sidebar variant="sidebar" className="sticky top-[65px] h-screen">
      <SidebarContent className="p-4">
        <DocsSidebar items={items} />
      </SidebarContent>
    </Sidebar>
  )
}

export default async function DocsLayout(
  props: Readonly<{
    params: Promise<{
      slug: string[]
    }>
    children: React.ReactNode
  }>,
) {
  const params = await props.params

  const recursiveCollections = await DocumentationDirectory.getEntries({
    recursive: true,
  })

  // here we're generating the items for the dropdown menu in the sidebar
  // it's used to provide a short link for the user to switch easily between the different collections
  // it expects an `index.mdx` file in each collection at the root level ( e.g. `aria-docs/index.mdx`)

  const tree = recursiveCollections
    // to get only the relevant menu entries, we have to filter the list of collections
    // based on the provided slug ( via `params.slug` ) and the path segments for the current source in the iteration
    .filter((collection) => {
      return collection.getPathnameSegments()[0] === params.slug[0]
    })
    // since we generated the nested tree later in the code ( via `getTree` )
    // we can filter the list of collections based on the depth which should be shown as "root"
    // in our case, we filter the list of collections based on depth 2
    .filter((ele) => ele.getDepth() === 0)

  const sidebarItems = await getTree(tree)

  return (
    <div>
      <SidebarProvider>
        <AppSidebar items={sidebarItems} />
        <SidebarInset className="bg-white dark:bg-secondary">
          <div className="flex flex-1 flex-col gap-4 p-4 pb-[calc(var(--footer-height)+1rem)]">
            <main className="flex w-full flex-1 flex-col transition-all duration-300 ease-in-out">
              {props.children}
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
