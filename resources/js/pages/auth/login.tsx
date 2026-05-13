import { Form, Head } from '@inertiajs/react';
import { Mail, Lock, UserPlus } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
    canRegister: boolean;
};

export default function Login({
    status,
    canResetPassword,
    canRegister,
}: Props) {
    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <Head title="Connexion" />

            {status && (
                <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-sm font-medium text-emerald-600 text-center">
                    {status}
                </div>
            )}

            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-8"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="space-y-5">
                            <div className="grid gap-2.5">
                                <Label htmlFor="email" className="text-sm font-bold text-slate-800 ml-1">Email professionnel</Label>
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                                        <Mail size={18} />
                                    </div>
                                    <Input
                                        id="email"
                                        type="email"
                                        name="email"
                                        required
                                        autoFocus
                                        tabIndex={1}
                                        autoComplete="email"
                                        placeholder="votre@entreprise.com"
                                        className="h-12 pl-10 pr-4 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                    />
                                </div>
                                <InputError message={errors.email} className="ml-1" />
                            </div>

                            <div className="grid gap-2.5">
                                <div className="relative group">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors z-10">
                                        <Lock size={18} />
                                    </div>
                                    <PasswordInput
                                        id="password"
                                        name="password"
                                        required
                                        tabIndex={2}
                                        autoComplete="current-password"
                                        placeholder="••••••••"
                                        className="h-12 pl-10 pr-4 bg-slate-50 border-slate-200 rounded-xl focus:bg-white focus:ring-4 focus:ring-blue-50 transition-all font-medium"
                                    />
                                </div>
                                <InputError message={errors.password} className="ml-1" />
                            </div>

                            

                            <Button
                                type="submit"
                                className="h-14 w-full rounded-xl bg-blue-600 font-bold text-base shadow-xl shadow-blue-100 hover:bg-blue-700 active:scale-[0.98] transition-all"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing ? (
                                    <>
                                        <Spinner className="mr-2" />
                                        Authentification...
                                    </>
                                ) : (
                                    "Se connecter"
                                )}
                            </Button>
                        </div>

                    
                    </>
                )}
            </Form>
        </div>
    );
}

Login.layout = {
    title: 'Connexion Espace Chantier',
    description: 'Accédez à vos outils de gestion de terrain et de suivi administratif.',
};
