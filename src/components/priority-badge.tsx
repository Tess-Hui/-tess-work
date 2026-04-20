import type { Priority } from "@/db/schema";
import { priorityClassNames, priorityLabels } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";

export function PriorityBadge({ priority }: { priority: Priority }) {
  return (
    <Badge className={priorityClassNames[priority]}>
      {priorityLabels[priority]} priority
    </Badge>
  );
}
