import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getTemplates } from "@/lib/templates"

export async function TemplateList() {
  const templates = await getTemplates()

  return (
    <div className="border-border my-4 rounded-md border bg-white dark:bg-transparent">
      <div className="w-full overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Template</TableHead>
              <TableHead>Description</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((template) => (
              <TableRow key={template.alias}>
                <TableCell className="align-top font-mono text-sm font-medium">
                  {template.alias}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm whitespace-normal">
                  {template.description}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
