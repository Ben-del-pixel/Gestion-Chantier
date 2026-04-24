import { Link } from '@inertiajs/react';
import {
    Bell,
    CircleGauge,
    Database,
    Shield,
    User,
} from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useCurrentUrl } from '@/hooks/use-current-url';
import { cn, toUrl } from '@/lib/utils';
import { edit as editAppearance } from '@/routes/appearance';
import { edit } from '@/routes/profile';
import { edit as editSecurity } from '@/routes/security';
import type { NavItem } from '@/types';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Profil',
        href: edit(),
        icon: User,
    },
    {
        title: 'Notifications',
        href: '/settings/notifications',
        icon: Bell,
    },
    {
        title: 'Affichage',
        href: editAppearance(),
        icon: CircleGauge,
    },
    {
        title: 'Sécurité',
        href: editSecurity(),
        icon: Shield,
    },
    {
        title: 'Données',
        href: '/settings/data',
        icon: Database,
    },
];

export default function SettingsLayout({ children }: PropsWithChildren) {
    const { isCurrentUrl } = useCurrentUrl();

    return (
        <div className="space-y-5 px-3 py-5 sm:px-5 sm:py-6">
            <div className="rounded-2xl border border-border/60 bg-card/80 p-5 shadow-sm">
                <h1 className="text-3xl font-bold tracking-tight text-foreground">Paramètres</h1>
                <p className="mt-1 text-sm text-muted-foreground">Gérez vos préférences et paramètres de l'application</p>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
                <aside className="rounded-2xl border border-border/60 bg-card/80 p-3 shadow-sm">
                    <nav className="space-y-1" aria-label="Settings">
                        {sidebarNavItems.map((item, index) => (
                            <Link
                                key={`${toUrl(item.href)}-${index}`}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                                    isCurrentUrl(item.href)
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'text-slate-700 hover:bg-muted/70 dark:text-slate-200'
                                )}
                            >
                                {item.icon && <item.icon className="h-4 w-4" />}
                                {item.title}
                            </Link>
                        ))}
                    </nav>
                </aside>

                <section className="rounded-2xl border border-border/60 bg-card/80 p-4 sm:p-5 shadow-sm">
                    {children}
                </section>
            </div>
        </div>
    );
}
