import type { TreeItem } from "~/lib/navigation"
import { AllDocumentation } from "~/collections"
import { DocsSidebar } from "~/components/docs-sidebar"
import { Sidebar, SidebarContent, SidebarInset, SidebarProvider } from "~/components/ui/sidebar"
import { getTree } from "~/lib/navigation"

export function AppSidebar({ items }: { items: TreeItem[] }) {
  return (
    <Sidebar variant="sidebar" className="sticky top-[65px] h-screen">
      <SidebarContent className="p-4">
        <DocsSidebar items={items} />
      </SidebarContent>
    </Sidebar>
  )
}

export default async function DocsLayout(props: LayoutProps<"/">) {
  const recursiveCollections = await AllDocumentation.getEntries({
    recursive: true,
  })

  // here we're generating the items for the dropdown menu in the sidebar
  // it's used to provide a short link for the user to switch easily between the different collections
  // it expects an `index.mdx` file in each collection at the root level ( e.g. `aria-docs/index.mdx`)

  const tree = recursiveCollections.filter((ele) => ele.getDepth() === 0)

  const sidebarItems = await getTree(tree)

  return (
    <div>
      <SidebarProvider>
        <AppSidebar items={sidebarItems} />
        <SidebarInset className="bg-white dark:bg-secondary">
          <div className="flex flex-1 flex-col gap-4 pb-[calc(var(--footer-height)+1rem)]">
            <main className="flex w-full flex-1 flex-col transition-all duration-300 ease-in-out">
              {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                props.children
              }
            </main>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
