import { Head } from '@inertiajs/react';
import { Bell, Save } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';

type NotificationState = {
    email: boolean;
    push: boolean;
    budgetAlerts: boolean;
    deadlineAlerts: boolean;
};

function ToggleRow({
    title,
    description,
    checked,
    onToggle,
}: {
    title: string;
    description: string;
    checked: boolean;
    onToggle: () => void;
}) {
    return (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
            <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="text-xs text-muted-foreground">{description}</p>
            </div>
            <button
                type="button"
                onClick={onToggle}
                aria-pressed={checked}
                className={`relative h-6 w-11 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
            >
                <span
                    className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`}
                />
            </button>
        </div>
    );
}

export default function Notifications() {
    const [form, setForm] = useState<NotificationState>({
        email: true,
        push: true,
        budgetAlerts: true,
        deadlineAlerts: true,
    });

    const toggle = (key: keyof NotificationState) => {
        setForm((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <>
            <Head title="Paramètres - Notifications" />

            <div className="space-y-5">
                <Heading
                    variant="small"
                    title="Notifications"
                    description="Configurez vos préférences de notification"
                />

                <div className="space-y-3">
                    <ToggleRow
                        title="Notifications par email"
                        description="Recevez des mises à jour par email"
                        checked={form.email}
                        onToggle={() => toggle('email')}
                    />
                    <ToggleRow
                        title="Notifications push"
                        description="Recevez des notifications en temps réel"
                        checked={form.push}
                        onToggle={() => toggle('push')}
                    />
                    <ToggleRow
                        title="Alertes de budget"
                        description="Avertissement quand le budget dépasse 80%"
                        checked={form.budgetAlerts}
                        onToggle={() => toggle('budgetAlerts')}
                    />
                    <ToggleRow
                        title="Alertes de délais"
                        description="Rappels avant les dates d'échéance"
                        checked={form.deadlineAlerts}
                        onToggle={() => toggle('deadlineAlerts')}
                    />
                </div>

                <Button type="button" className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700">
                    <Save className="h-4 w-4" />
                    Sauvegarder
                </Button>
            </div>
        </>
    );
}

Notifications.layout = {
    breadcrumbs: [
        {
            title: 'Paramètres notifications',
            href: '/settings/notifications',
        },
    ],
};
