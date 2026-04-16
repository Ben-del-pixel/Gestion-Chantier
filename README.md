                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                # Gestion Chantier - Système de Gestion des Chantiers

Application Laravel + React pour la gestion complète des chantiers, incluant gestion des présences, assignation des ouvriers, notifications d'absence, et génération de rapports.

## 📋 Table des matières

- [Prérequis](#prérequis)
- [Installation](#installation)
- [Configuration](#configuration)
- [Démarrage](#démarrage)
- [Accès à l'application](#accès-à-lapplication)
- [Commandes utiles](#commandes-utiles)
- [Structure du projet](#structure-du-projet)
- [Technologies](#technologies)

## 🔧 Prérequis

Avant de commencer, assurez-vous d'avoir installé:

- **PHP 8.4+** ([Télécharger](https://www.php.net/downloads))
- **Composer** ([Télécharger](https://getcomposer.org/download/))
- **Node.js 18+** et **npm** ([Télécharger](https://nodejs.org/))
- **Git** ([Télécharger](https://git-scm.com/))

Vérifiez les installations:
```bash
php --version
composer --version
node --version
npm --version
```

## 📦 Installation

### 1. Cloner le projet

```bash
git clone <repo-url>
cd Gestion-Chantier
```

### 2. Installer les dépendances PHP

```bash
composer install
```

### 3. Installer les dépendances Node.js

```bash
npm install
```

### 4. Copier le fichier d'environnement

```bash
cp .env.example .env
```

### 5. Générer la clé d'application

```bash
php artisan key:generate
```

## ⚙️ Configuration

### Base de données

Modifiez le fichier `.env` avec vos paramètres de base de données:

```env
DB_CONNECTION=sqlite
# ou pour MySQL:
# DB_CONNECTION=mysql
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=gestion_chantier
# DB_USERNAME=root
# DB_PASSWORD=
```

**Pour SQLite (recommandé pour le développement):**
```bash
touch database/database.sqlite
```

### Exécuter les migrations

```bash
php artisan migrate
```

### Remplir la base de données (optionnel)

```bash
php artisan db:seed
```

## 🚀 Démarrage

L'application nécessite **deux serveurs séparés** à tournant en même temps:
1. **Serveur Laravel Backend** (port 8000)
2. **Serveur Vite Frontend** (port 5173)

### Terminal 1 - Serveur Laravel (Backend)

```bash
php artisan serve
```

Le serveur backend démarre sur: **http://localhost:8000**

### Terminal 2 - Serveur Vite (Frontend)

```bash
npm run dev
```

Le serveur frontend démarre sur: **http://localhost:5173**

L'application communique entre:
- Backend: http://localhost:8000
- Frontend: http://localhost:5173

## 🌍 Accès à l'application

Ouvrez votre navigateur et allez à:

**→ http://localhost:5173**

Ou si vous démarrez uniquement le serveur Laravel:

**→ http://localhost:8000**

## 💾 Commandes utiles

### PHP / Laravel

| Commande | Description |
|----------|-------------|
| `php artisan serve` | Démarrer le serveur Laravel |
| `php artisan migrate` | Exécuter les migrations |
| `php artisan db:seed` | Remplir la base de données |
| `php artisan tinker` | Shell PHP interactif |
| `php artisan test` | Exécuter les tests |
| `php artisan test --filter=NomDuTest` | Exécuter un test spécifique |
| `vendor/bin/pint` | Formater le code PHP |
| `php artisan make:model Nom` | Créer un model |
| `php artisan make:migration nom_migration` | Créer une migration |
| `php artisan make:controller NomController` | Créer un controller |
| `php artisan route:list` | Lister toutes les routes |

### Node.js / Frontend

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarrer Vite en mode développement |
| `npm run build` | Compiler les assets pour la production |
| `npm run preview` | Prévisualiser la build de production |
| `npm run format` | Formater le code avec Prettier |
| `npm run lint` | Vérifier le code avec ESLint |

### Git - Gestion du code

| Commande | Description |
|----------|-------------|
| `git status` | Voir l'état actuel du repository |
| `git pull origin main` | Récupérer et fusionner les changements du serveur |
| `git fetch origin` | Récupérer les changements (sans fusionner) |
| `git add .` | Ajouter tous les fichiers modifiés à la staging area |
| `git add nom_du_fichier` | Ajouter un fichier spécifique |
| `git commit -m "Message"` | Créer un commit avec un message |
| `git push origin main` | Envoyer les commits vers le serveur |
| `git log` | Voir l'historique des commits |
| `git branch` | Lister les branches locales |
| `git checkout -b nom_branche` | Créer et basculer vers une nouvelle branche |
| `git checkout nom_branche` | Basculer vers une branche existante |

#### Workflow typique pour modifier le code:

```bash
# 1. Récupérer les derniers changements
git pull origin main

# 2. Créer une nouvelle branche pour vos modifications
git checkout -b feature/ma-fonctionnalite

# 3. Faire vos changements...

# 4. Vérifier les fichiers modifiés
git status

# 5. Ajouter les fichiers modifiés
git add .

# 6. Créer un commit
git commit -m "Ajouter une nouvelle fonctionnalité"

# 7. Envoyer votre branche
git push origin feature/ma-fonctionnalite

# 8. Créer une Pull Request depuis GitHub/GitLab/Gitea
```

## 📁 Structure du projet

```
Gestion-Chantier/
├── app/
│   ├── Http/Controllers/      # Controllers Laravel
│   ├── Models/                # Models Eloquent
│   ├── Actions/               # Actions Fortify
│   ├── Enums/                 # Énumérations PHP
│   └── Services/              # Services métier
├── database/
│   ├── migrations/            # Migrations
│   ├── factories/             # Factories pour les tests
│   └── seeders/               # Seeders
├── resources/
│   ├── js/
│   │   ├── pages/             # Pages React
│   │   ├── components/        # Composants React
│   │   ├── layouts/           # Layouts
│   │   └── hooks/             # Hooks personnalisés
│   ├── css/                   # Styles Tailwind
│   └── views/
│       └── app.blade.php      # Template principal
├── routes/
│   ├── web.php                # Routes web
│   └── console.php            # Routes console
├── tests/
│   ├── Feature/               # Tests fonctionnels
│   └── Unit/                  # Tests unitaires
├── storage/                   # Fichiers temporaires
├── public/                    # Fichiers publics
├── .env                       # Variables d'environnement
├── composer.json              # Dépendances PHP
├── package.json               # Dépendances Node
├── vite.config.ts             # Configuration Vite
└── tsconfig.json              # Configuration TypeScript
```

## 🛠 Technologies

### Backend
- **Laravel 13** - Framework PHP moderne
- **PHP 8.4** - Langage de programmation
- **Eloquent ORM** - Object-Relational Mapping
- **Pest 4** - Framework de test PHP
- **SQLite** - Base de données

### Frontend
- **React 19** - Bibliothèque UI
- **TypeScript** - Typage statique JavaScript
- **Inertia.js v3** - Routing côté serveur
- **Tailwind CSS v4** - Framework CSS
- **Vite** - Build tool ultra-rapide
- **shadcn/ui** - Composants UI

### Bonus
- **Fortify** - Authentification
- **Wayfinder** - Routes typées
- **Pint** - Formatage PHP
- **ESLint + Prettier** - Formatage JavaScript

## 📚 Fonctionnalités principales

- ✅ Gestion des utilisateurs (Manager, Engineer, Worker)
- ✅ Gestion des projets/chantiers
- ✅ Suivi des présences en temps réel
- ✅ Initialisation des présences par projet
- ✅ Assignation des ouvriers aux chantiers
- ✅ Statuts de présence: Présent, Absent, Retard, Malade
- ✅ Détection automatique des absences
- ✅ Notifications email des absences
- ✅ Rapports et statistiques
- ✅ Authentification et autorisation
- ✅ Tests automatisés

## 🐛 Dépannage

### Le port 8000 est déjà en utilisation
```bash
php artisan serve --port=8001
```

### Le port 5173 est déjà en utilisation
```bash
npm run dev -- --port 5174
```

### Base de données verrouillée (SQLite)
```bash
rm database/database.sqlite
php artisan migrate
```

### Dépendances PHP manquantes
```bash
composer install --no-interaction
composer update
```

### Dépendances Node manquantes
```bash
rm -rf node_modules package-lock.json
npm install
```

## 📖 Documentation utile

- [Laravel Documentation](https://laravel.com/docs)
- [React Documentation](https://react.dev)
- [Inertia.js Documentation](https://inertiajs.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev)

## 📝 Notes de développement

- Le serveur Laravel DOIT toujours être actif
- Le serveur Vite est optionnel (il compile à la demande)
- Pour la production, exécutez `npm run build` et déployez le dossier `public`
- Les migrations sont automatiques au démarrage en développement

## 📧 Support

Pour toute question ou problème, consultez la documentation officielle ou créez une issue.
