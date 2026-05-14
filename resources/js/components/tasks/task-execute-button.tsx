import { router, usePage } from '@inertiajs/react';
import { Button } from '@/components/ui/button';
import { markExecuted } from '@/actions/App/Http/Controllers/Api/TaskController';

export function TaskExecuteButton({ task }: { task: any }) {
    const page = usePage().props as any;
    const user = page?.auth?.user;
    const uid = user?.id as number | undefined;
    const role = user?.role as string | undefined;

    if (!uid || !role || !['worker', 'chef_chantier'].includes(role)) {
        return null;
    }

    const assigned = task.workers?.some((w: any) => w.id === uid);

    if (!assigned) {
        return null;
    }

    const self = task.workers?.find((w: any) => w.id === uid);
    const done = Boolean(self?.pivot?.executed_at ?? task.pivot?.executed_at);

    return (
        <Button
            type="button"
            size="sm"
            variant={done ? 'outline' : 'default'}
            disabled={done}
            className="h-8 shrink-0 rounded-md px-3 text-xs font-medium"
            onClick={() => {
                if (done) {
                    return;
                }

                router.post(markExecuted.url({ task: task.id }), {}, { preserveScroll: true });
            }}
        >
            {done ? 'Exécution confirmée' : 'Confirmer l’exécution'}
        </Button>
    );
}
