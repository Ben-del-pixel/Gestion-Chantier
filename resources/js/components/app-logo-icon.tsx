import type { ImgHTMLAttributes } from 'react';

export default function AppLogoIcon(props: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            {...props}
            src="/images/logo.jpeg"
            alt="Gestion Chantier Logo"
            className={`${props.className} object-contain`}
        />
    );
}
