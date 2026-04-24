import { Head } from '@inertiajs/react';
import { AlertTriangle, Download, Trash2, Upload } from 'lucide-react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';

export default function DataSettings() {
    return (
        <>
            <Head title="Paramètres - Données" />

            <div className="space-y-5">
                <Heading
                    variant="small"
                    title="Gestion des données"
                    description="Exportez, importez ou supprimez vos données"
                />

                <div className="space-y-3">
                    <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-emerald-100 p-2 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                                <Download className="h-4 w-4" />
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">Exporter les données</p>
                                    <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80">
                                        Téléchargez toutes vos données (chantiers, matériaux, main-d'oeuvre, équipements, coûts).
                                    </p>
                                </div>
                                <Button type="button" className="h-9 rounded-lg bg-emerald-600 hover:bg-emerald-700">
                                    Exporter maintenant
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-blue-200/70 bg-blue-50/40 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
                                <Upload className="h-4 w-4" />
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Importer les données</p>
                                    <p className="text-xs text-blue-800/80 dark:text-blue-200/80">
                                        Restaurez vos données depuis un fichier de sauvegarde JSON.
                                    </p>
                                </div>
                                <Button type="button" variant="outline" className="h-9 rounded-lg border-blue-300/80 bg-white/70 hover:bg-blue-100/70 dark:border-blue-700 dark:bg-slate-900/50">
                                    Choisir un fichier
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-rose-200/70 bg-rose-50/40 p-4 dark:border-rose-900/50 dark:bg-rose-950/20">
                        <div className="flex items-start gap-3">
                            <div className="rounded-lg bg-rose-100 p-2 text-rose-700 dark:bg-rose-900/60 dark:text-rose-300">
                                <Trash2 className="h-4 w-4" />
                            </div>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Supprimer toutes les données</p>
                                    <p className="text-xs text-rose-800/80 dark:text-rose-200/80">
                                        Attention: cette action est irréversible et supprimera définitivement les données de l'application.
                                    </p>
                                </div>
                                <Button type="button" variant="destructive" className="h-9 rounded-lg">
                                    Supprimer toutes les données
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4" />
                    <p>Créez des sauvegardes régulières avant toute importation ou suppression massive.</p>
                </div>
            </div>
        </>
    );
}

DataSettings.layout = {
    breadcrumbs: [
        {
            title: 'Paramètres données',
            href: '/settings/data',
        },
    ],
};
