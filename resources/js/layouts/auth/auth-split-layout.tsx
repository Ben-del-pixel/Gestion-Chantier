import { Link } from '@inertiajs/react';
import AppLogoIcon from '@/components/app-logo-icon';
import { login } from '@/routes';
import type { AuthLayoutProps } from '@/types';

export default function AuthSplitLayout({
    children,
    title,
    description,
}: AuthLayoutProps) {
    return (
        <div className="relative grid h-dvh flex-col items-center justify-center px-8 sm:px-0 lg:max-w-none lg:grid-cols-2 lg:px-0 bg-background">
            <div className="relative hidden h-full flex-col p-10 text-white lg:flex">
                <div
                    className="absolute inset-0 bg-cover bg-center brightness-[0.4] bg-zinc-900"
                    style={{ backgroundImage: 'url("/images/login-bg.png")' }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />

                <div className="relative z-20 flex flex-1 items-center justify-center p-0">
                    <Link href={login()} className="m-0 block p-0 leading-none">
                        <AppLogoIcon className="m-0 block h-auto max-h-44 w-auto max-w-[min(90vw,320px)] border-0 p-0 shadow-none" />
                    </Link>
                </div>

                <div className="relative z-20 shrink-0">
                    <blockquote className="space-y-3">
                        <p className="text-xl font-medium leading-relaxed italic text-slate-100">
                            "La gestion de chantier n'a jamais été aussi fluide. Une vue d'ensemble en temps réel pour bâtir l'avenir avec précision."
                        </p>
                        <footer className="text-sm font-semibold uppercase tracking-widest text-slate-400">
                            Équipe de Gestion du Chantier
                        </footer>
                    </blockquote>
                </div>
            </div>

            <div className="w-full lg:p-12">
                <div className="mx-auto flex w-full flex-col justify-center space-y-8 sm:w-[400px]">
                    <div className="flex justify-center p-0 lg:hidden">
                        <Link href={login()} className="m-0 block p-0 leading-none">
                            <AppLogoIcon className="m-0 block h-auto max-h-36 w-auto max-w-[min(85vw,280px)] border-0 p-0 shadow-none" />
                        </Link>
                    </div>

                    <div className="flex flex-col space-y-2 text-left sm:items-center sm:text-center">
                        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">{title}</h1>
                        <p className="text-base text-slate-500 max-w-[320px] mx-auto">
                            {description}
                        </p>
                    </div>
                    <div className="p-1">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}
