import { Head } from '@inertiajs/react';
import { Save } from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { useAppearance } from '@/hooks/use-appearance';
import { edit as editAppearance } from '@/routes/appearance';

export default function Appearance() {
    const { appearance, updateAppearance } = useAppearance();
    const [language, setLanguage] = useState('fr');
    const [currency, setCurrency] = useState('usd');

    return (
        <>
            <Head title="Paramètres - Affichage" />

            <h1 className="sr-only">Paramètres d'affichage</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Affichage"
                    description="Personnalisez l'apparence de l'application"
                />

                <div className="space-y-4">
                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Thème</label>
                        <select
                            value={appearance}
                            onChange={(event) => updateAppearance(event.target.value as 'light' | 'dark' | 'system')}
                            className="h-11 w-full rounded-xl border border-border/60 bg-background/90 px-3 text-sm"
                        >
                            <option value="light">Clair</option>
                            <option value="dark">Sombre</option>
                            <option value="system">Système</option>
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Langue</label>
                        <select
                            value={language}
                            onChange={(event) => setLanguage(event.target.value)}
                            className="h-11 w-full rounded-xl border border-border/60 bg-background/90 px-3 text-sm"
                        >
                            <option value="fr">Français</option>
                            <option value="en">English</option>
                        </select>
                    </div>

                    <div className="grid gap-2">
                        <label className="text-sm font-medium">Devise</label>
                        <select
                            value={currency}
                            onChange={(event) => setCurrency(event.target.value)}
                            className="h-11 w-full rounded-xl border border-border/60 bg-background/90 px-3 text-sm"
                        >
                            <option value="usd">USD ($)</option>
                            <option value="cdf">CDF (FC)</option>
                            <option value="eur">EUR (€)</option>
                        </select>
                    </div>

                    <Button type="button" className="gap-2 rounded-xl bg-blue-600 hover:bg-blue-700">
                        <Save className="h-4 w-4" />
                        Sauvegarder
                    </Button>
                </div>
            </div>
        </>
    );
}

Appearance.layout = {
    breadcrumbs: [
        {
            title: 'Paramètres affichage',
            href: editAppearance(),
        },
    ],
};
