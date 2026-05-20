import AppLogoIcon from '@/components/app-logo-icon';

export default function AppLogo() {
    return (
        <div className="flex items-center gap-3">
            <div className="flex aspect-square size-10 items-center justify-center">
                <AppLogoIcon className="size-8" />
            </div>
            <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[15px] font-semibold text-white">
                    Gestion Chantier
                </span>
                <span className="truncate text-[11px] text-slate-400">
                    Suivi des projets
                </span>
            </div>
        </div>
    );
}
