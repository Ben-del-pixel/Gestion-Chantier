# Documentation fonctionnelle

## Objectif

Cette application permet de gérer un chantier de construction de bout en bout. Elle rassemble les informations utiles pour organiser les équipes, suivre les projets, contrôler le matériel, enregistrer les présences et garder une trace des actions importantes.

## Rôles métier

- **Manager** : pilote les projets et consulte la vision globale
- **Engineer** : organise le suivi opérationnel et les équipes
- **Worker** : consulte ses tâches, ses sous-étapes assignées et déclare sa présence
- **Magasinier** : gère le stock et les mouvements de matériel de son chantier assigné ; gère également la présence sur son chantier
- **ChefChantier** : supervise le terrain, décompose les étapes en sous-étapes et les attribue à ses ouvriers

---

## Fonctionnalités principales

### Gestion des utilisateurs

- Création, modification et suppression des utilisateurs
- Attribution d'un rôle métier à chaque utilisateur
- Gestion des informations de base du personnel (nom, email, numéro de téléphone, compétences, etc.)

---

### Gestion des projets

- **Création du projet par le Manager uniquement**, avec : nom, description, budget, dates (validation de cohérence entre date de début et de fin)
- Au moment de la création du projet, le Manager **affecte un Ingénieur** au projet
- L'Ingénieur, une fois affecté, peut à son tour **affecter un Magasinier** et **un Chef de Chantier** au projet
- **Liaison automatique de l'équipe ouvrière** : lorsqu'un Chef de Chantier est affecté à un chantier, son équipe d'ouvriers est automatiquement associée à ce même chantier — il n'est pas nécessaire d'affecter les ouvriers individuellement
- Consultation de la liste et du détail des projets
- Définition et suivi de l'état d'avancement manuel (en %)
- Affectation d'un statut, avec notamment le statut "terminé" pour clôturer un projet

---

### Gestion des étapes et sous-étapes (Chef de Chantier)

- Le Chef de Chantier consulte les **étapes de construction** de son chantier
- Pour chaque étape, il peut créer des **sous-étapes**
- Chaque sous-étape peut être **attribuée à un ou plusieurs ouvriers** (1, 2 ou 3 ouvriers selon le besoin)
- Un ouvrier voit uniquement les sous-étapes qui lui sont assignées et peut les **marquer comme exécutées** (bouton "Exécuté" ou case à cocher)
- **Clôture automatique d'une étape** : dès que tous les ouvriers ont marqué leurs sous-étapes comme exécutées, l'étape parente est automatiquement clôturée et une **notification est envoyée** au Chef de Chantier, à l'Ingénieur et au Manager pour les informer que l'étape a été finalisée avec succès

---

### Gestion du matériel

#### Règles d'affectation

- **Chaque Magasinier gère uniquement les matériaux du chantier auquel il est affecté** — un Magasinier n'a pas accès aux matériaux des autres chantiers
- Si le **Manager crée un matériel**, il doit l'assigner à un Magasinier ; ce Magasinier doit lui-même être affecté à un chantier
- Si le **Magasinier crée un matériel**, ce matériel est automatiquement affecté au chantier du Magasinier qui l'a créé

#### Fonctionnalités

- Création et modification du matériel
- Attribution de matériel à un chantier (via le Magasinier ou le Manager selon les règles ci-dessus)
- Enregistrement des entrées et sorties de stock
- Consultation de l'historique des mouvements

#### Vue Manager sur les matériaux

- Depuis l'onglet ou bouton **Matériel**, le Manager consulte les matériaux **filtrés par chantier**
- Pour chaque chantier (ex : *Chantier Salama*), il voit :
  - Les matériaux consommables et les quantités utilisées (ex : sable utilisé, ciment utilisé, etc.)
  - Les matériaux réutilisables avec l'historique des entrées/sorties
- Les matériaux de différents chantiers ne sont **jamais mélangés** dans cette vue — l'affichage est toujours segmenté par chantier

---

### Présences et absences

- **Pointage journalier uniquement** (pas de présence nuit)
- Le pointage se fait **une seule fois par 24 heures** par utilisateur pour assurer l'intégrité des données
- **Gestion de la présence confiée au Magasinier** : c'est le Magasinier qui enregistre les présences pour son chantier — les ouvriers n'ont pas d'option de gestion de présence autonome
- Restriction par chantier : un Magasinier ou un Ouvrier ne peut interagir que sur son chantier assigné
- Mise à jour du statut de présence (ex : En congé, Malade, etc.)
- Consultation des présences par ouvrier ou par période
- Historique et traçabilité des pointages enregistrés dans un journal central (logs)

---

### Rapports et incidents

- Génération de rapports sur-mesure (globaux, par projet ou par ouvrier)
- **Routage précis des rapports** :
  - L'Ingénieur soumet un rapport → il est transmis directement au Manager principal
  - Les Ouvriers et Magasiniers soumettent un rapport → il est transmis à leur Ingénieur référent
- Déclaration d'incidents sur le chantier

---

### Pilotage et suivi

- Affichage d'un tableau de bord adapté au rôle connecté
- Vision des indicateurs utiles au suivi du chantier
- Gestion locale du type de devise (CDF ou USD) avec un contrôle manuel du taux de change intégré dans les tableaux de bord
- **Journalisation (Audit & Historique)** accessible depuis les paramètres : enregistrement de la traçabilité des modifications (créations de chantiers, éditions de tâches, actions de présence, etc.) avec filtres par types d'action

---

## Parcours utilisateur

### Manager

Le Manager crée les projets et affecte un Ingénieur à chacun. Il consulte les indicateurs globaux, suit la situation générale du chantier et visualise les matériaux **par chantier** (matériaux consommables utilisés + mouvements des matériaux réutilisables).

### Engineer

L'Ingénieur, une fois affecté à un projet par le Manager, affecte un Magasinier et un Chef de Chantier au chantier. Il organise le suivi des équipes, reçoit les notifications de clôture d'étapes et utilise les informations de présence pour le pilotage quotidien.

### Worker

L'Ouvrier consulte les sous-étapes qui lui sont assignées, suit son planning et marque ses sous-étapes comme exécutées. Sa présence est gérée par le Magasinier de son chantier.

### Magasinier

Le Magasinier est affecté à un chantier. Il gère **uniquement les matériaux de ce chantier**, enregistre les mouvements de stock et **gère la présence** des membres de son chantier. Tout matériel qu'il crée est automatiquement rattaché à son chantier.

### ChefChantier

Le Chef de Chantier est affecté à un chantier avec son équipe d'ouvriers (liaison automatique). Il supervise l'exécution terrain, décompose les étapes en sous-étapes, les attribue à ses ouvriers et reçoit les notifications de clôture d'étapes.

---

## Règles métier

- Un utilisateur agit selon son rôle et son chantier assigné
- **Chaîne d'affectation** : Manager → crée le projet et affecte l'Ingénieur → l'Ingénieur affecte le Magasinier et le Chef de Chantier → l'équipe du Chef de Chantier est automatiquement liée au chantier
- Un projet doit rester cohérent dans son cycle de vie
- Les mouvements de stock doivent pouvoir être tracés, par chantier
- La présence est journalière uniquement et gérée par le Magasinier
- Quand tous les ouvriers d'une étape ont exécuté leurs sous-étapes, l'étape se clôture automatiquement avec notification au Chef de Chantier, à l'Ingénieur et au Manager
- Les rapports et incidents doivent rester consultables
- Les matériaux sont toujours rattachés à un chantier via un Magasinier

---

## Résultat attendu

L'application doit offrir une vue claire de l'activité du chantier, limiter les erreurs de suivi et centraliser l'information utile à chaque métier. La chaîne de responsabilité (Manager → Ingénieur → Magasinier / Chef de Chantier → Ouvriers) doit être respectée à chaque niveau de l'application.