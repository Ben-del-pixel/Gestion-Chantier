import { router, usePage } from '@inertiajs/react';
import { Bell, Search } from 'lucide-react';
import markNotificationRead from '@/actions/App/Http/Controllers/DatabaseNotificationReadController';
import { show as projectShow } from '@/actions/App/Http/Controllers/Api/ProjectController';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

type DeadlineNotificationItem = {
    id: string;
    title: string;
    message: string;
    project_id: number;
    kind: string;
};

type DeadlineNotifications = {
    unread_count: number;
    items: DeadlineNotificationItem[];
};

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const page = usePage().props as {
        deadlineNotifications?: DeadlineNotifications;
    };
    const deadlineNotifications = page.deadlineNotifications ?? { unread_count: 0, items: [] };
    const unread = deadlineNotifications.unread_count;
    const items = deadlineNotifications.items;

    function openDeadlineNotification(item: DeadlineNotificationItem): void {
        if (!item.project_id) {
            return;
        }

        router.post(
            markNotificationRead.url({ notification: item.id }),
            {},
            {
                preserveScroll: true,
                onSuccess: () => router.visit(projectShow.url({ project: item.project_id })),
            },
        );
    }

    return (
        <header className="flex h-16 shrink-0 items-center justify-between px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 border-b border-sidebar-border/50">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator orientation="vertical" className="mr-2 h-4" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            <div className="flex items-center gap-2">
                <div className="relative hidden lg:block group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground transition-colors" />
                    <input
                        type="text"
                        placeholder="Rechercher..."
                        className="h-8 pl-9 pr-4 bg-muted/30 border-none rounded-lg text-xs font-medium w-[200px] focus:ring-1 ring-primary/20 transition-all"
                    />
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 relative text-muted-foreground hover:text-foreground"
                            aria-label="Alertes échéances chantiers"
                        >
                            <Bell className="h-4 w-4" />
                            {unread > 0 && (
                                <span
                                    className={cn(
                                        'absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full border border-background',
                                        'bg-primary text-[10px] font-bold leading-4 text-primary-foreground flex items-center justify-center',
                                    )}
                                >
                                    {unread > 9 ? '9+' : unread}
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-80 sm:w-96">
                        <DropdownMenuLabel className="font-semibold">Échéances chantiers</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {items.length === 0 ? (
                            <p className="px-2 py-3 text-sm text-muted-foreground">Aucune alerte non lue.</p>
                        ) : (
                            <div className="max-h-72 overflow-y-auto">
                                {items.map((item) => (
                                    <DropdownMenuItem
                                        key={item.id}
                                        className="flex cursor-pointer flex-col items-start gap-1 py-3"
                                        onSelect={() => {
                                            openDeadlineNotification(item);
                                        }}
                                    >
                                        <span className="text-xs font-bold text-foreground">{item.title}</span>
                                        <span className="line-clamp-2 text-xs text-muted-foreground">{item.message}</span>
                                    </DropdownMenuItem>
                                ))}
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
