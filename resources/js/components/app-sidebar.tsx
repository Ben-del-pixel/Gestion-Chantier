import { Link, usePage } from '@inertiajs/react';
import {
    LayoutGrid,
    CalendarDays,
    Users,
    Package,
    ClipboardCheck,
    TrendingUp,
    History,
    Settings,
    HelpCircle,
    BarChart3,
    Clock
} from 'lucide-react';
import { index as activityLogsIndex } from '@/actions/App/Http/Controllers/ActivityLogController';
import { index as materialsIndex } from '@/actions/App/Http/Controllers/Api/MaterialController';
import { index as projectsIndex } from '@/actions/App/Http/Controllers/Api/ProjectController';
import { index as attendanceIndex } from '@/actions/App/Http/Controllers/AttendanceController';
import { index as reportsIndex } from '@/actions/App/Http/Controllers/ReportController';
import { index as usersIndex } from '@/actions/App/Http/Controllers/UserController';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuItem,
    SidebarMenuButton,
    SidebarRail,
} from '@/components/ui/sidebar';
import { UserRole } from '@/Enums/UserRole';
import { dashboard } from '@/routes';
import type { NavItem } from '@/types';

const roleNavItems: Record<string, NavItem[]> = {
    [UserRole.Manager.value]: [
        { title: "Vue d'ensemble", href: dashboard(), icon: LayoutGrid },
        { title: 'Chantiers', href: projectsIndex(), icon: TrendingUp },
        { title: 'Matériaux', href: materialsIndex(), icon: Package },
        { title: "Main-d'oeuvre", href: usersIndex(), icon: Users },
        { title: 'Présence', href: attendanceIndex(), icon: Clock },
        { title: 'Rapports', href: reportsIndex(), icon: BarChart3 },
        { title: 'Audit & Logs', href: activityLogsIndex(), icon: History },
    ],
    [UserRole.Engineer.value]: [
        { title: 'Mes Projets', href: dashboard(), icon: LayoutGrid },
        { title: 'Chantiers', href: projectsIndex(), icon: TrendingUp },
        { title: 'Matériaux', href: materialsIndex(), icon: Package },
        { title: 'Rapports', href: reportsIndex(), icon: BarChart3 },
    ],
    [UserRole.Worker.value]: [
        { title: 'Ma Mission', href: dashboard(), icon: CalendarDays },
        { title: 'Présence', href: attendanceIndex(), icon: Clock },
        { title: 'Historique', href: activityLogsIndex(), icon: History },
    ],
    [UserRole.Magasinier.value]: [
        { title: 'Stock Matériaux', href: materialsIndex(), icon: Package },
        { title: 'Inventaire', href: '#', icon: ClipboardCheck },
    ],
};

const systemNavItems: NavItem[] = [
    { title: 'Paramètres', href: '#', icon: Settings },
    { title: 'Centre d\'Aide', href: '#', icon: HelpCircle },
];

export function AppSidebar({ className, ...props }: React.ComponentProps<typeof Sidebar>) {
    const { auth } = usePage().props as any;
    const userRole = (auth.user?.role as string) || UserRole.Worker.value;
    const mainNavItems = roleNavItems[userRole] || roleNavItems[UserRole.Worker.value];

    return (
        <Sidebar collapsible="icon" className={className} {...props}>
            <SidebarHeader className="border-b border-white/10 px-5 py-5">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild className="h-auto rounded-none px-0 py-0 hover:bg-transparent">
                            <Link href={dashboard()} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent className="px-3 py-4">
                <NavMain items={mainNavItems} label="Navigation" />
                <NavMain items={systemNavItems} label="Système" />
            </SidebarContent>

            <SidebarFooter className="border-t border-white/10 px-3 py-4">
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}
