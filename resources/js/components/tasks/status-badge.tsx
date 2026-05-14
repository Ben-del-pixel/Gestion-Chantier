import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function StatusBadge({ status }: { status: string }) {
    const variants: Record<string, string> = {
        en_cours: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800',
        initialisation: 'bg-muted/50 text-foreground border-border',
        termine: 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800',
        planifie: 'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800',
        retard: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800',
    };

    const label = status.replaceAll('_', ' ');

    return (
        <Badge
            variant="outline"
            className={cn(
                'h-6 rounded-md px-2 py-0 text-[11px] font-medium capitalize',
                variants[status] ?? variants.initialisation,
            )}
        >
            {label}
        </Badge>
    );
}
